import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const read = (path) => readFileSync(path, "utf8");
function load(path, dependencies = {}) {
  const code = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)((id) => dependencies[id] ?? require(id), loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const i18n = load("lib/i18n.ts");
const translation = (locale) => ({ useI18n: () => ({ locale, t: (key) => i18n.t(locale, key) }) });
const requests = [];
const helpers = load("lib/comment-reactions.ts", {
  "./api": { apiFetch: async (...args) => { requests.push(args); return { comment_id: 7, likes_count: 6, dislikes_count: 2, my_reaction: "like" }; } },
  "./social": { buildReactionEndpoint: (id) => `/comments/${id}/reaction/` },
});

test("Reacciones brands exactly Re / a / c / ciones with the established gradient", () => {
  const Label = load("components/profile-feed/ProfileRecommendationsLabel.tsx").default;
  const html = renderToStaticMarkup(React.createElement(Label, { label: "Reacciones", reactions: true }));
  assert.match(html, />Re<\/span>a<span[^>]+>c<\/span>ciones/);
  assert.equal((html.match(/from-\[#168BFF\]/g) ?? []).length, 2);
  assert.match(renderToStaticMarkup(React.createElement(Label, { label: "Reactions", reactions: true })), />Re<\/span>a<span[^>]+>c<\/span>tions/);
  assert.equal(i18n.t("es", "profileFeedRecordings"), "Reacciones");
  assert.equal(i18n.t("en", "profileFeedRecordings"), "Reactions");
});

test("movie and series reuse public totals and ES/EN zero, singular and plural labels in both tabs", () => {
  for (const locale of ["es", "en"]) {
    for (const count of [0, 1, 12]) {
      const key = count === 1 ? "movieDetailPublicCommentCountSingular" : "movieDetailPublicCommentCountPlural";
      assert.equal(`${count} ${i18n.t(locale, key)}`, `${count} ${locale === "es" ? (count === 1 ? "comentario" : "comentarios") : (count === 1 ? "comment" : "comments")}`);
    }
  }
  const detail = read("app/movies/[id]/page.tsx");
  assert.equal((detail.slice(detail.indexOf("<div data-desktop-comment-tabs") - 2200, detail.indexOf("<MobileVideoComments currentUserId")).match(/data-public-comment-count/g) ?? []).length, 2);
  assert.match(detail, /setPublicCommentsTotal\(parsed.total \?\? parsed.comments.length\)/);
  assert.match(detail, /movieDetailSeriesCommentTitle/);
  assert.match(detail, /movieDetailCommentTitle/);
});

test("canonical optimistic transitions cover neutral, like, dislike and authoritative response", async () => {
  for (const mine of [null, "like", "dislike"]) {
    for (const next of [null, "like", "dislike"]) {
      const comment = { id: 7, likesCount: 5, dislikesCount: 2, myReaction: mine };
      const result = helpers.applyReactionToCollection([comment], 7, next)[0];
      assert.equal(result.likesCount, 5 - Number(mine === "like") + Number(next === "like"));
      assert.equal(result.dislikesCount, 2 - Number(mine === "dislike") + Number(next === "dislike"));
      assert.equal(result.myReaction, next);
      assert.equal(comment.myReaction, mine);
    }
  }
  for (const reaction of ["like", "dislike", null]) await helpers.requestCommentReaction(7, reaction);
  assert.deepEqual(requests.map(([url, options]) => [url, options.method]), [
    ["/comments/7/reaction/", "PUT"], ["/comments/7/reaction/", "PUT"], ["/comments/7/reaction/", "DELETE"],
  ]);
  assert.equal(requests[0][1].body, '{"reaction":"like"}');
  assert.equal(requests[1][1].body, '{"reaction":"dislike"}');
  const result = helpers.applyReactionResultToCollection([{ id: 7 }], 7, { comment_id: 7, likes_count: 6, dislikes_count: 2, my_reaction: "like" })[0];
  assert.deepEqual(result, { id: 7, likesCount: 6, dislikesCount: 2, myReaction: "like" });
});

test("shared buttons render counts and selected states and toggle like/dislike", () => {
  const Buttons = load("components/social/ReactionButtons.tsx", { "../../hooks/useI18n": translation("es") }).default;
  for (const mine of [null, "like", "dislike"]) {
    const calls = [];
    const element = Buttons({ comment: { id: 7, likesCount: 5, dislikesCount: 2, myReaction: mine }, onReact: async (...args) => calls.push(args) });
    const [like, dislike] = element.props.children;
    like.props.onClick(); dislike.props.onClick();
    assert.deepEqual(calls, [[7, mine === "like" ? null : "like"], [7, mine === "dislike" ? null : "dislike"]]);
    assert.equal(like.props.className.includes("bg-emerald-500/20"), mine === "like");
    assert.equal(dislike.props.className.includes("bg-rose-500/20"), mine === "dislike");
    const html = renderToStaticMarkup(element);
    assert.match(html, /👍 5/); assert.match(html, /👎 2/);
  }
});

test("visited comment submits once, updates immediately and rolls back API failures", async () => {
  const state = [], refs = []; let cursor = 0, refCursor = 0, reject, resolve, authenticated = true;
  const fakeReact = {
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial; return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; },
    useRef(initial) { const index = refCursor++; return refs[index] ??= { current: initial }; },
    useEffect() {},
  };
  let submissions = 0;
  const Component = load("components/profile-feed/VisitedProfileCommentReactions.tsx", {
    react: fakeReact,
    "../../hooks/useI18n": translation("es"),
    "../../hooks/useAuthState": { useAuthState: () => ({ isAuthenticated: authenticated }) },
    "../social/ReactionButtons": { default: () => null },
    "../../lib/comment-reactions": { ...helpers, requestCommentReaction: () => { submissions++; return new Promise((yes, no) => { resolve = yes; reject = no; }); } },
  }).default;
  const item = { commentId: 7, commentLikesCount: 5, commentDislikesCount: 2, commentMyReaction: null };
  const render = () => { cursor = refCursor = 0; return Component({ item }); };
  const controls = () => render().props.children[0].props;
  const first = controls().onReact(7, "like");
  assert.equal(controls().comment.likesCount, 6);
  assert.equal(controls().disabled, true);
  await controls().onReact(7, "dislike"); assert.equal(submissions, 1);
  reject(new Error("offline")); await first;
  assert.equal(controls().comment.likesCount, 5);
  assert.equal(controls().comment.myReaction, null);
  assert.ok(render().props.children[1]);
  const second = controls().onReact(7, "dislike");
  assert.equal(controls().comment.dislikesCount, 3);
  resolve({ comment_id: 7, likes_count: 5, dislikes_count: 3, my_reaction: "dislike" }); await second;
  assert.equal(controls().comment.myReaction, "dislike");
  authenticated = false;
  assert.equal(controls().disabled, true);
  await controls().onReact(7, "like"); assert.equal(submissions, 2);
});

test("responsive layout keeps one shared reaction control beside mobile title and below desktop metadata", () => {
  const row = read("components/profile-feed/MyActivityColumn.tsx");
  assert.equal((row.match(/<VisitedProfileCommentReactions item=/g) ?? []).length, 1);
  assert.match(row, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(row, /min-w-0 break-words/);
  assert.match(row, /col-start-2 row-start-1 lg:col-start-1 lg:row-start-3/);
  assert.match(row, /visitedActivityTab === "public_comments" && item.commentId != null/);
  assert.match(read("app/movies/[id]/page.tsx"), /requestCommentReaction\(commentId, reaction\)/);
});

test("visited activity adapter preserves canonical comment ID, counts and each viewer reaction", async () => {
  for (const mine of [null, "like", "dislike"]) {
    const calls = [];
    const adapters = load("lib/profile-feed/adapters.ts", {
      "../directed-presentation": load("lib/directed-presentation.ts"),
      "../api": { ApiError: class extends Error {}, apiFetch: async (endpoint) => {
        calls.push(endpoint);
        return { count: 1, next: null, results: [{
          id: "public_comment:7", activity_type: "public_comment", created_at: "2026-01-01T00:00:00Z",
          actor: { username: "owner" }, movie: { id: 42, title_english: "Long title" },
          payload: { comment_id: 7, content: "Public", likes_count: 5, dislikes_count: 2, my_reaction: mine },
        }] };
      } },
      "../notification-routing-fields": { normalizeNotificationRoutingFields: (value) => value },
      "../movies": { normalizeMovie: (value) => value, parseMovieList: (value) => value, resolveMovieDisplayTitle: () => "Long title", resolveMovieSecondaryTitle: () => "" },
      "./mocks": { favoriteMoviesMock: [] },
    });
    const response = await adapters.getSocialActivity("user:owner", null, undefined, "public_comment");
    assert.equal(calls.length, 1);
    assert.match(calls[0], /activity_type=public_comment/);
    const item = response.items[0];
    assert.equal(item.commentId, 7);
    assert.equal(item.commentLikesCount, 5);
    assert.equal(item.commentDislikesCount, 2);
    assert.equal(item.commentMyReaction, mine);
  }
});
