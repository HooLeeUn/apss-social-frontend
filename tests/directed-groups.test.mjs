import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const detail = readFileSync("app/movies/[id]/page.tsx", "utf8");
const modal = readFileSync("components/NotificationCommentViewer.tsx", "utf8");
function load(source) {
  const exports = {};
  const context = { exports, process, console };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return exports;
}
const social = load(readFileSync("lib/social.ts", "utf8"));
const ast = ts.createSourceFile("page.tsx", detail, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helpers = ast.statements.filter(node => ts.isFunctionDeclaration(node) && !node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.DefaultKeyword)).map(node => node.getText(ast)).join("\n");
const context = vm.createContext({ ...social, console, process, URL });
vm.runInContext(ts.transpileModule(helpers, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText, context);
const group = (...args) => context.groupDirectedConversations(...args);
const users = [{ id: 1, username: "Alice" }, { id: 2, username: "Bob" }, { id: 3, username: "Carol" }];
const key = "movie:10:participants:1-2-3";
function message(id, author = users[0], participants = users, conversationKey = key) {
  return { id, author, movie: { id: 10 }, target_user: users[1], recipients: participants.filter(user => user.id !== author.id), participants, conversation_key: conversationKey, is_group: participants.length > 2, body: "plain reply without mentions", visibility: "mentioned", created_at: `2026-10-25T10:00:0${id}Z` };
}

test("three participants and different reply authors produce one thread", () => {
  const result = group([message(1), message(2, users[1]), message(3, users[2])], "Alice", "10");
  assert.equal(result.length, 1);
  assert.equal(result[0].messages.length, 3);
  assert.equal(result[0].conversationKey, key);
});

test("group label excludes the authenticated user for every participant", () => {
  for (const viewer of users) {
    const conversation = group([message(1)], viewer.username, "10")[0];
    assert.equal(conversation.isGroup, true);
    assert.ok(!conversation.otherDisplayName.includes(viewer.username));
    for (const other of users.filter(user => user.id !== viewer.id)) assert.ok(conversation.otherDisplayName.includes(other.username));
  }
});

test("participant order does not split a canonical thread", () => {
  assert.equal(group([message(1), message(2, users[0], [...users].reverse())], "Bob", "10").length, 1);
});

test("a pair and a group with the same author remain separate", () => {
  const pair = message(2, users[0], users.slice(0, 2), "movie:10:participants:1-2");
  const result = group([message(1), pair], "Bob", "10");
  assert.equal(result.length, 2);
  const conversation = result.find(item => !item.isGroup);
  assert.equal(conversation.otherDisplayName, "Alice");
});

test("legacy one-to-one messages still group without new fields", () => {
  const legacy = { id: 1, author: users[0], target_user: users[1], body: "legacy", visibility: "mentioned", movie: 10 };
  const result = group([legacy], "Bob", "10");
  assert.equal(result.length, 1);
  assert.equal(result[0].otherDisplayName, "Alice");
  assert.equal(result[0].isGroup, false);
});

test("structured groups belonging to other users are excluded", () => {
  assert.equal(group([message(1)], "Outside", "10").length, 0);
  assert.equal(group([message(1)], "Alice", "99").length, 0);
});

test("backend conversation previews retain canonical identity and pagination endpoint", () => {
  const endpoint = "/movies/10/comments/directed/conversations/Bob/messages/?conversation_key=" + key;
  const result = group({ results: [{ other_user: users[1], messages_preview: [message(1)], messages_endpoint: endpoint }] }, "Alice", "10");
  assert.equal(result[0].conversationKey, key);
  assert.equal(result[0].messagesEndpoint, endpoint);
});

test("group labels truncate on narrow screens without hiding the toggle", () => {
  assert.match(detail, /min-w-0[\s\S]*truncate text-sm font-semibold text-zinc-100/);
  assert.match(detail, /shrink-0 text-xs text-zinc-400/);
  assert.match(detail, /conversation\.isGroup \? \(locale === "en" \? "Group" : "Grupal"\)/);
});

test("group toggle retains the existing open and close behavior", () => {
  assert.match(detail, /setExpandedConversationKey\(isExpanded \? null : conversation\.key\)/);
  assert.match(detail, /handleToggleConversation\(conversation\)/);
  assert.match(detail, /isExpanded \? t\("movieDetailHide"\)/);
});

test("Detail and notification replies send original comment identity and canonical key", () => {
  assert.match(detail, /conversation_key: conversation\.conversationKey \?\? undefined/);
  assert.match(detail, /reply_to_comment_id: conversation\.messages\[0\]\?\.id/);
  assert.match(modal, /conversation_key: displayedComment\.conversationKey \?\? undefined/);
  assert.match(modal, /reply_to_comment_id: displayedComment\.id/);
});

test("notification route carries canonical key and old notifications resolve their comment", () => {
  const routes = load(readFileSync("lib/notification-navigation.ts", "utf8"));
  const route = routes.buildNotificationTargetRoute({ targetTab: "private_inbox", movieId: 10, type: "private_message", directedCommentId: 7, actorId: 1, actorUsername: "Alice", conversationKey: key });
  assert.equal(new URL(route, "https://example.test").searchParams.get("conversationKey"), key);
  assert.match(detail, /candidate\.conversationKey === target\.canonicalKey/);
  assert.match(detail, /apiFetch\(buildCommentDetailEndpoint\(target\.commentId\)\)/);
});

async function submitNotificationReply(raw) {
  const requests = [];
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState: initial => [initial === "" ? "reply to everyone" : initial, () => {}],
    useRef: initial => ({ current: initial }), useEffect() {},
  };
  vm.runInNewContext(ts.transpileModule(modal, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, console, window: { setTimeout: () => 1 },
    require: name => name === "react" ? react : name === "react/jsx-runtime" ? { jsx, jsxs: jsx } :
      name.endsWith("/api") ? { apiFetch: async (endpoint, options) => { requests.push({ endpoint, payload: JSON.parse(options.body) }); }, ApiError: Error } :
      name.endsWith("/social") ? social : name.endsWith("/i18n") ? { t: () => "Reply {username}" } : { default: () => null },
  });
  const tree = exports.default({ comment: social.parseComments([raw], "directed")[0], movie: { id: 10 }, movieTitle: "Movie", locale: "es", canDirectReply: true, replyRecipient: users[0], authenticatedUserId: 2, onClose() {}, onMovieOpen() {} });
  function find(node, type) {
    if (!node || typeof node !== "object") return null;
    if (node.type === type) return node;
    const children = node.props?.children;
    return (Array.isArray(children) ? children : [children]).map(child => find(child, type)).find(Boolean);
  }
  find(tree, "form").props.onSubmit({ preventDefault() {} });
  await Promise.resolve();
  assert.equal(requests.length, 1);
  return requests[0].payload;
}

test("submitting a group reply from the notification modal sends the existing group", async () => {
  const payload = await submitNotificationReply(message(1));
  assert.equal(payload.reply_to_comment_id, 1);
  assert.equal(payload.conversation_key, key);
  assert.equal(payload.body, "reply to everyone");
});

test("notification reply to an individual dispatch uses only its pair key", async () => {
  const pairKey = "movie:10:participants:1-2";
  const raw = { ...message(1, users[0], users.slice(0, 2), pairKey), body: "@Bob @Carol original multi-send" };
  const payload = await submitNotificationReply(raw);
  assert.equal(payload.reply_to_comment_id, 1);
  assert.equal(payload.conversation_key, pairKey);
  assert.equal(payload.mentioned_username, "Alice");
  assert.equal(payload.mentioned_usernames, undefined);
});

function individualDispatch() {
  return {
    id: 1,
    conversation_contexts: [
      { ...message(1, users[0], [users[0], users[1]], "movie:10:participants:1-2"), target_user: users[1], body: "@Bob @Carol original multi-send" },
      { ...message(1, users[0], [users[0], users[2]], "movie:10:participants:1-3"), target_user: users[2], body: "@Bob @Carol original multi-send" },
    ],
  };
}

test("one physical comment expands into two ordinary sender conversations from backend metadata", () => {
  const raw = individualDispatch();
  const parsed = social.parseComments([raw], "directed");
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].id, parsed[1].id);
  const conversations = group([raw], "Alice", "10");
  assert.equal(conversations.length, 2);
  assert.deepEqual(new Set(conversations.map(item => item.otherDisplayName)), new Set(["Bob", "Carol"]));
  assert.ok(conversations.every(item => !item.isGroup && item.messages.length === 1));
});

test("each receiving pair excludes the other recipient despite multiple mentions in the body", () => {
  for (const context of individualDispatch().conversation_contexts) {
    const viewer = context.target_user.username;
    const conversations = group([context], viewer, "10");
    assert.equal(conversations.length, 1);
    assert.equal(conversations[0].otherDisplayName, "Alice");
    assert.equal(conversations[0].isGroup, false);
    assert.equal(conversations[0].messages[0].participants.length, 2);
    assert.equal(conversations[0].conversationKey, context.conversation_key);
  }
});

test("notification navigation disambiguates the same comment across individual pair keys", () => {
  const routes = load(readFileSync("lib/notification-navigation.ts", "utf8"));
  const keys = individualDispatch().conversation_contexts.map(context => context.conversation_key);
  const paths = keys.map(conversationKey => routes.buildNotificationTargetRoute({ targetTab: "private_inbox", movieId: 10, type: "private_message", directedCommentId: 1, actorId: 1, actorUsername: "Alice", conversationKey }));
  assert.notEqual(paths[0], paths[1]);
  paths.forEach((path, index) => assert.equal(new URL(path, "https://example.test").searchParams.get("conversationKey"), keys[index]));
});
