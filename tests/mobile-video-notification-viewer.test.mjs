import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const feed = readFileSync(new URL("../app/feed/page.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/movies/[id]/page.tsx", import.meta.url), "utf8");
const viewer = readFileSync(new URL("../components/VideoReactionViewer.tsx", import.meta.url), "utf8");
const resolver = readFileSync(new URL("../lib/video-reactions.ts", import.meta.url), "utf8");

test("received video reactions are intercepted on mobile and desktop before existing navigation", () => {
  assert.match(feed, /item\.type === "video_comment_reaction"[\s\S]*item\.reactionType === "like"[\s\S]*item\.reactionType === "dislike"[\s\S]*item\.videoCommentId !== null/);
  assert.doesNotMatch(feed, /isMobileVideoReaction/);
  assert.doesNotMatch(feed.slice(feed.indexOf("const isReceivedVideoReaction"), feed.indexOf("if (item.type === \"public_comment_reaction\")")), /matchMedia/);
  assert.match(feed, /if \(isReceivedVideoReaction\)[\s\S]*resolveVideoReactionComment[\s\S]*setNotificationVideo[\s\S]*return;/);
  assert.match(feed, /finally \{[\s\S]*router\.push\(destination\)/);
});

test("notification resolver follows the canonical paginated video-comments collection", () => {
  assert.match(resolver, /\/movies\/\$\{encodeURIComponent\(movieId\)\}\/video-comments\//);
  assert.match(resolver, /page\.results\?\.find\(\(video\) => String\(video\.id\) === videoCommentId\)/);
  assert.match(resolver, /endpoint = normalizeNextEndpoint\(page\.next\)/);
});

test("shared fullscreen viewer keeps controls, metadata, close-only context and one-shot animation", () => {
  assert.match(viewer, /animationStartedRef/);
  assert.match(viewer, /setTimeout\(\(\) => setShowReaction\(false\), 2200\)/);
  assert.match(viewer, /notification-video-reaction-overlay--\$\{reaction\}/);
  assert.match(viewer, /VideoReactionMovieMetadata/);
  assert.match(viewer, /onClick=\{onClose\}/);
  assert.match(feed, /onClose=\{\(\) => setNotificationVideo\(null\)\}/);
  assert.doesNotMatch(viewer, /lg:hidden/);
});

test("Detail Movie adds the same localized fullscreen metadata on mobile and desktop", () => {
  assert.match(detail, /VideoReactionMovieMetadata poster=\{moviePoster\} title=\{movieTitle\}/);
  assert.match(detail, /resolveMovieTitles\(locale, movie\?\.titleSpanish, movie\?\.titleEnglish, movie\?\.displayTitle\)\.primary/);
  assert.match(detail, /closeExpandedVideo\(\); router\.push\(`\/movies\/\$\{encodeURIComponent\(movieId\)\}`\)/);
  assert.doesNotMatch(readFileSync(new URL("../components/VideoReactionMovieMetadata.tsx", import.meta.url), "utf8"), /lg:hidden/);
});
