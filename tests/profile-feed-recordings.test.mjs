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

test("short recommendations grow naturally and long recommendations alone activate the inner scroller", () => {
  assert.match(tabs, /content\.scrollHeight > FOLLOWED_RECOMMENDATIONS_MAX_HEIGHT_REM \* rootFontSize/);
  assert.match(tabs, /recommendationsOverflow \? "activity-scrollbar max-h-\[39rem\] overflow-y-auto" : "max-h-none overflow-y-visible"/);
  assert.match(tabs, /new ResizeObserver\(update\)/);
});

test("the common mobile panel changes overflow with the active tab and clears recordings overflow", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(tabs, /profile-feed-following-activity-panel--\$\{activeTab\}/);
  assert.match(tabs, /data-active-tab=\{activeTab\}/);
  assert.match(css, /activity-panel--recommendations[\s\S]*height: auto;[\s\S]*max-height: none;[\s\S]*overflow-y: visible;/);
  assert.match(css, /activity-panel--recordings[\s\S]*overflow-y: auto;/);
  const commonPanel = css.slice(css.indexOf(".profile-feed-following-activity-panel {"), css.indexOf(".profile-feed-following-activity:has"));
  assert.doesNotMatch(commonPanel, /overflow-y: auto/);
});

test("Recordings use the common mobile activity scroll and never cancel vertical touchmove", () => {
  const inlinePlayer = videos.slice(videos.indexOf("function VisitedProfileVideoPlayer"), videos.indexOf("export default function"));
  const touchMove = inlinePlayer.slice(inlinePlayer.indexOf("onTouchMove="), inlinePlayer.indexOf("onClick=", inlinePlayer.indexOf("onTouchMove=")));
  assert.match(touchMove, /onTouchMove=/);
  assert.doesNotMatch(touchMove, /preventDefault|stopPropagation/);
  assert.match(inlinePlayer, /Math\.hypot[\s\S]*> 8/);
  assert.match(inlinePlayer, /if \(!wasSwipe\) togglePlayback\(\)/);
  assert.match(tabs, /profile-feed-following-recordings/);
});

test("following tab selection contains no viewport repositioning API", () => {
  const handlers = tabs.slice(tabs.indexOf("const handleRecommendationsTabClick"), tabs.indexOf("const getTabClassName"));
  assert.doesNotMatch(handlers, /scrollIntoView|scrollTo|scrollTop|\.focus\(/);
  assert.match(tabs, /xl:min-h-\[49rem\]/);
});

test("both Rec-prefixed tabs reuse the established gradient label", () => {
  assert.match(tabs, /ProfileRecommendationsLabel label=\{t\("profileFeedRecommendations"\)\}/);
  assert.match(tabs, /ProfileRecommendationsLabel label=\{t\("profileFeedRecordings"\)\}/);
});
