import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adapters = readFileSync(new URL("../lib/profile-feed/adapters.ts", import.meta.url), "utf8");
const types = readFileSync(new URL("../lib/profile-feed/types.ts", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../lib/notification-navigation.ts", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/movies/[id]/page.tsx", import.meta.url), "utf8");
const commentsList = readFileSync(new URL("../components/social/CommentsList.tsx", import.meta.url), "utf8");
const feed = readFileSync(new URL("../app/feed/page.tsx", import.meta.url), "utf8");
const { normalizeNotificationRoutingFields } = await import(new URL("../lib/notification-routing-fields.ts", import.meta.url));
const { buildNotificationTargetRoute } = await import(new URL("../lib/notification-navigation.ts", import.meta.url));

test("bell normalization preserves canonical public and video reaction fields", () => {
  assert.match(adapters, /normalizeNotificationRoutingFields\(record\)/);
  assert.match(adapters, /type: routingFields\.type/);
  assert.match(adapters, /commentId: routingFields\.commentId/);
  assert.match(adapters, /videoCommentId: routingFields\.videoCommentId/);
  assert.match(adapters, /reactionType: routingFields\.reactionType/);
  assert.match(types, /type: string \| null;[\s\S]*directedCommentId:[\s\S]*commentId:[\s\S]*videoCommentId:[\s\S]*reactionType:/);
});

test("real public reaction payload variants normalize and route canonically", () => {
  for (const object of [{ comment: { id: 22 } }, { comment_id: 22 }]) {
    const fields = normalizeNotificationRoutingFields({
      type: "generic_notification",
      notification_type: "public_comment_reaction",
      object,
      movie: { id: 492436 },
      reaction_type: "dislike",
    });
    assert.deepEqual(fields, {
      type: "public_comment_reaction",
      commentId: 22,
      videoCommentId: null,
      reactionType: "dislike",
    });
    assert.equal(buildNotificationTargetRoute({
      id: 1,
      text: "reaction",
      targetTab: "activity",
      movieId: 492436,
      actorId: null,
      actorUsername: null,
      directedCommentId: null,
      createdAt: null,
      ...fields,
    }), "/movies/492436?section=public-comments&commentId=22&reaction=dislike");
  }
});

test("real video reaction payload keeps its canonical type, id, and target route", () => {
  const fields = normalizeNotificationRoutingFields({
    notification_type: "generic_notification",
    activity_type: "activity",
    type: "video_comment_reaction",
    object: { video_comment_id: 86 },
    movie: { id: 492436 },
    reaction_type: "like",
  });

  assert.deepEqual(fields, {
    type: "video_comment_reaction",
    commentId: null,
    videoCommentId: 86,
    reactionType: "like",
  });
  assert.equal(buildNotificationTargetRoute({
    id: 2,
    text: "video reaction",
    targetTab: "activity",
    movieId: 492436,
    actorId: null,
    actorUsername: null,
    directedCommentId: null,
    createdAt: null,
    ...fields,
  }), "/movies/492436?target=video-reaction&targetId=86&reaction=like");
});

test("public and directed comment routes share movie and canonical comment ids", () => {
  const base = {
    id: 1,
    text: "notification",
    targetTab: "private_inbox",
    movieId: 492436,
    actorId: 1,
    actorUsername: "Julian",
    createdAt: null,
    videoCommentId: null,
  };
  assert.equal(buildNotificationTargetRoute({
    ...base,
    type: "private_message",
    directedCommentId: 32,
    commentId: null,
    reactionType: null,
  }), "/movies/492436?section=directed-comments&actorId=1&actorUsername=Julian&commentId=32");
  assert.equal(buildNotificationTargetRoute({
    ...base,
    type: "public_comment_reaction",
    targetTab: "activity",
    directedCommentId: null,
    commentId: 22,
    reactionType: "like",
  }), "/movies/492436?section=public-comments&commentId=22&reaction=like");
});

test("notification routing adds exact targets and retains previous fallbacks", () => {
  const publicRoute = navigation.slice(navigation.indexOf('item.type === "public_comment_reaction"'), navigation.indexOf('item.type === "video_comment_reaction"'));
  const videoRoute = navigation.slice(navigation.indexOf('item.type === "video_comment_reaction"'), navigation.indexOf('item.targetTab === "private_inbox"'));
  assert.match(publicRoute, /item\.commentId[\s\S]*item\.reactionType[\s\S]*section=public-comments&commentId=/);
  assert.match(videoRoute, /item\.videoCommentId[\s\S]*item\.reactionType[\s\S]*target=video-reaction&targetId=/);
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
  assert.match(detail, /commentInputMode !== "text-comment" \|\| \(!desktop && activeCommentsTab !== "public"\)/);
  assert.match(detail, /publicCommentsSectionRef\.current\?\.scrollIntoView[\s\S]*hasInternalScroll[\s\S]*container\.scrollTo/);
  assert.match(detail, /comment\.classList\.add\("notification-public-comment-highlight"\)[\s\S]*processedPublicTargetRef\.current = targetKey[\s\S]*consumeNotificationTarget\(\)/);
});

test("mobile notification positioning measures the visual video in its real scroll container and uses the real tab handler", () => {
  const mobilePositioning = detail.slice(detail.indexOf("const scrollContainer = historyScrollRef.current"), detail.indexOf("if (notificationTarget.reaction)"));
  assert.match(detail, /data-mobile-video-reaction-scroll-container/);
  assert.match(detail, /card\.querySelector<HTMLElement>\('\[data-video-comment-player="true"\]'/);
  assert.match(mobilePositioning, /scrollContainer\.scrollTop[\s\S]*scrollContainer\.clientHeight[\s\S]*videoRectBefore\.height/);
  assert.match(mobilePositioning, /scrollContainer\.scrollTo\(\{ top: desiredTop, behavior \}\)/);
  assert.doesNotMatch(mobilePositioning, /window\.scrollTo|window\.visualViewport|scrollIntoView/);
  assert.match(detail, /notificationPositioningRef\.current = true[\s\S]*notificationPositioningRef\.current = false/);
  assert.match(detail, /const openCommentMovieSection[\s\S]*setCommentInputMode\("text-comment"\)/);
  assert.match(detail, /if \(mobile && activeCommentsTab !== "public"\) setActiveCommentsTab\("public"\)/);
});

test("explicit notification diagnostics work in production and consumption requires visible target DOM", () => {
  assert.match(detail, /searchParams\.get\("debugNotificationTarget"\) === "1"/);
  assert.match(detail, /if \(!debugNotificationTarget && process\.env\.NODE_ENV === "production"\) return/);
  assert.match(detail, /data-notification-target-debug/);
  assert.match(detail, /data-comment-input-mode=\{mode\}/);
  assert.match(detail, /textContentVisible[\s\S]*if \(!container \|\| !comment \|\| !textContentVisible\)[\s\S]*TARGET NOT CONSUMED/);
  assert.match(detail, /const desktop[\s\S]*\(!desktop && activeCommentsTab !== "public"\)/);
  assert.match(detail, /main tab after two frames[\s\S]*main tab after 500ms/);
});

test("feed propagates explicit target diagnostics and logs its complete destination", () => {
  assert.match(feed, /searchParams\.get\("debugNotificationTarget"\) === "1"/);
  assert.match(feed, /function FeedDebugSearchParamsBridge[\s\S]*useSearchParams\(\)/);
  assert.match(feed, /<Suspense fallback=\{null\}>[\s\S]*<FeedDebugSearchParamsBridge[\s\S]*<\/Suspense>/);
  assert.doesNotMatch(feed, /export default function FeedPage\(\) \{\s*const router = useRouter\(\);\s*const searchParams = useSearchParams\(\)/);
  assert.match(feed, /targetRoute\.startsWith\("\/movies\/"\)[\s\S]*url\.searchParams\.set\("debugNotificationTarget", "1"\)/);
  assert.match(feed, /\[NotificationTarget\]\[NORMALIZED ITEM\][\s\S]*const targetRoute = buildNotificationTargetRoute\(item\)/);
  assert.match(feed, /\[PUBLIC COMMENT NOTIFICATION REAL\][\s\S]*builtRoute: targetRoute/);
  assert.match(feed, /\[PUBLIC COMMENT ROUTING ERROR\] Missing commentId/);
  assert.match(feed, /\[VIDEO COMMENT NOTIFICATION REAL\][\s\S]*videoCommentId:[\s\S]*builtRoute: targetRoute/);
  assert.match(feed, /\[VIDEO COMMENT ROUTING ERROR\] Missing videoCommentId/);
  assert.match(feed, /\[NotificationTarget\]\[FEED CLICK\][\s\S]*notificationObjectCommentId[\s\S]*notificationObjectVideoCommentId[\s\S]*destinationUrl/);
  assert.match(feed, /router\.push\(destination\)/);
});

test("video target diagnostics report desktop and mobile final geometry", () => {
  assert.match(detail, /\[VIDEO NOTIFICATION TARGET\][\s\S]*viewport: "desktop"[\s\S]*carouselScrollLeftAfter/);
  assert.match(detail, /\[VIDEO NOTIFICATION TARGET\][\s\S]*viewport: "mobile"[\s\S]*containerScrollTopAfter[\s\S]*fullyVisible/);
});

test("detail snapshots received query data before processing and retains it after consumption", () => {
  assert.match(detail, /\[NotificationTarget\]\[\$\{event\}\]/);
  assert.match(detail, /DETAIL RECEIVED[\s\S]*source: "query param"[\s\S]*url: window\.location\.href/);
  assert.match(detail, /receivedNotificationTargetRef\.current = received[\s\S]*setReceivedNotificationTarget\(received\)/);
  assert.match(detail, /CONSUME[\s\S]*commentDomFound[\s\S]*videoDomFound[\s\S]*setNotificationDiagnosticStatus\("consumed"\)/);
  assert.match(detail, />RECEIVED<[\s\S]*receivedNotificationTarget\?\.type[\s\S]*>CURRENT<[\s\S]*notificationDiagnosticStatus/);
  assert.match(detail, /MAIN TAB CHANGE[\s\S]*COMMENTS SUBTAB CHANGE/);
});

test("public comment sections reuse the proven directed-comments entry architecture", () => {
  assert.match(detail, /section === "public-comments"[\s\S]*type: "public-comment"/);
  const sharedEntry = detail.slice(detail.indexOf('searchParams.get("section") !== "directed-comments" && section !== "public-comments"'), detail.indexOf('if (notificationTarget?.type !== "public-comment")'));
  assert.match(sharedEntry, /section === "public-comments"[\s\S]*openCommentMovieSection\(\)[\s\S]*setActiveCommentsTab\("directed"\)[\s\S]*openCommentMovieSection\(\)[\s\S]*setPendingDirectedNotificationTarget/);
  assert.match(detail, /if \(mobile && activeCommentsTab !== "public"\) setActiveCommentsTab\("public"\)/);
  assert.match(detail, /received\?\.type === "public-comment"[\s\S]*cleaned\.delete\("section"\)[\s\S]*cleaned\.delete\("commentId"\)/);
});
