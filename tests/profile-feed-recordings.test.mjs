import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tabs = readFileSync("components/profile-feed/SocialActivityTabsBlock.tsx", "utf8");
const videos = readFileSync("components/profile-feed/VisitedProfileVideoReactions.tsx", "utf8");
const i18n = readFileSync("lib/i18n.ts", "utf8");

test("following activity exposes localized Recordings after the existing tabs", () => {
  assert.match(tabs, /profileFeedRecommendations/);
  assert.match(tabs, /profileFeedActions/);
  assert.match(tabs, /profileFeedRecordings/);
  assert.match(tabs, /source="following"/);
  assert.match(i18n, /profileFeedRecordings: "Recados"/);
  assert.match(i18n, /profileFeedRecordings: "Recordings"/);
  assert.match(i18n, /Aún no hay recados de tus seguidos\./);
  assert.match(i18n, /No recordings from people you follow yet\./);
});

test("Recordings reuse the video player, reaction contract, UGC menu and paginated endpoint", () => {
  assert.match(videos, /following-video-reactions/);
  assert.match(videos, /VisitedProfileVideoPlayer/);
  assert.match(videos, /video-comments\/\$\{encodeURIComponent\(key\)\}\/reaction\//);
  assert.match(videos, /UgcModerationMenu contentKind="video_comment" objectId=\{commentId \?\? item\.id\}/);
  assert.match(videos, /USER_RESTRICTED_EVENT/);
  assert.match(videos, /loadingNextRef\.current/);
  assert.match(videos, /incoming\.filter\(\(item\) => !ids\.has\(String\(item\.id\)\)\)/);
});

test("recommendations only activate their inner scroller when content really overflows", () => {
  assert.match(tabs, /container\.scrollHeight > container\.clientHeight \+ 1/);
  assert.match(tabs, /recommendationsOverflow \? "activity-scrollbar overflow-y-auto" : "overflow-y-visible"/);
  assert.match(tabs, /new ResizeObserver\(update\)/);
});

test("both Rec-prefixed tabs reuse the established gradient label", () => {
  assert.match(tabs, /ProfileRecommendationsLabel label=\{t\("profileFeedRecommendations"\)\}/);
  assert.match(tabs, /ProfileRecommendationsLabel label=\{t\("profileFeedRecordings"\)\}/);
});
