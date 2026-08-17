import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adapters = readFileSync(new URL("../lib/profile-feed/adapters.ts", import.meta.url), "utf8");
const types = readFileSync(new URL("../lib/profile-feed/types.ts", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../lib/notification-navigation.ts", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/movies/[id]/page.tsx", import.meta.url), "utf8");
const commentsList = readFileSync(new URL("../components/social/CommentsList.tsx", import.meta.url), "utf8");

test("bell normalization preserves canonical public and video reaction fields", () => {
  assert.match(adapters, /public_comment_reaction[\s\S]*toRecord\(toRecord\(record\.object\)\?\.comment\)\?\.id/);
  assert.match(adapters, /video_comment_reaction[\s\S]*toRecord\(record\.object\)\?\.video_comment_id/);
  assert.match(adapters, /pickFirst\(record\.reaction_type, record\.reaction_value\)/);
  assert.match(types, /type: string \| null;[\s\S]*directedCommentId:[\s\S]*commentId:[\s\S]*videoCommentId:[\s\S]*reactionType:/);
});

test("notification routing adds exact targets and retains previous fallbacks", () => {
  assert.match(navigation, /target=public-comment&targetId=/);
  assert.match(navigation, /reaction = item\.reactionType \? `&reaction=/);
  assert.match(navigation, /target=video-reaction&targetId=/);
  assert.match(navigation, /section=directed-comments[\s\S]*item\.directedCommentId/);
  assert.match(navigation, /friend_requests_pending[\s\S]*friendsTab=pending/);
  assert.match(navigation, /private_inbox[\s\S]*tab=private_inbox[\s\S]*tab=activity/);
});

test("Detail Movie targets stable canonical DOM ids and consumes query once", () => {
  assert.match(commentsList, /data-public-comment-id=/);
  assert.match(detail, /querySelector<HTMLElement>\(`\[data-public-comment-id=/);
  assert.match(detail, /querySelector<HTMLElement>\(`\[data-video-comment-card=/);
  assert.match(detail, /container\.scrollTo\([\s\S]*commentRect\.top/);
  assert.match(detail, /processedNotificationTargetRef/);
  assert.match(detail, /cleaned\.delete\("target"\)[\s\S]*router\.replace/);
  assert.match(detail, /notification-video-reaction-overlay/);
});

test("notification positioning waits for the mounted tab and both scroll surfaces", () => {
  assert.match(detail, /data-video-reaction-section/);
  assert.match(detail, /section\.getBoundingClientRect\(\)\.top/);
  assert.match(detail, /await waitForNotificationScroll\(window, reducedMotion\)[\s\S]*container\.scrollTo\(\{ left:/);
  assert.match(detail, /const chooseVisibleHistoryVideo[\s\S]*notificationPositioningRef\.current/);
  assert.match(detail, /commentInputMode !== "text-comment" \|\| activeCommentsTab !== "public"/);
  assert.match(detail, /publicCommentsSectionRef\.current\?\.scrollIntoView[\s\S]*hasInternalScroll[\s\S]*container\.scrollTo/);
  assert.match(detail, /comment\.classList\.add\("notification-public-comment-highlight"\)[\s\S]*processedPublicTargetRef\.current = targetKey[\s\S]*consumeNotificationTarget\(\)/);
});
