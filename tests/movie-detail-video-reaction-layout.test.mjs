import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const detail = fs.readFileSync("app/movies/[id]/page.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");

test("desktop video reactions center only while the carousel is underfilled", () => {
  assert.match(detail, /container\.scrollWidth <= container\.clientWidth \+ tolerance/);
  assert.match(detail, /data-history-underfilled=\{isHistoryUnderfilled\}/);
  assert.match(css, /data-history-underfilled="true"\][\s\S]*justify-content: center/);
});

test("desktop empty video state is centered and has stronger hierarchy", () => {
  assert.match(detail, /data-video-history-empty/);
  assert.match(css, /data-video-history-empty\][\s\S]*min-height: 16rem[\s\S]*align-items: center[\s\S]*font-size: 1\.125rem/);
});

test("REC keeps its button handler and uses the established blue-violet text gradient", () => {
  assert.match(detail, /onClick=\{\(\) => setRecorderState[\s\S]*bg-gradient-to-r from-\[#168BFF\] via-\[#6558F5\] to-\[#A63DFF\][\s\S]*>Rec<\/span>/);
});

test("mobile detail keeps the existing upper block sticky in both tabs and uses one page scroller", () => {
  assert.match(detail, /data-mobile-detail-layout="true"/);
  assert.match(detail, /data-detail-movie-content/);
  assert.match(css, /@media \(max-width: 1279px\)[\s\S]*data-mobile-detail-layout="true"[\s\S]*height: 100dvh;[\s\S]*overflow: hidden/);
  assert.match(css, /data-detail-movie-content\][\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior-y: contain;[\s\S]*touch-action: pan-y/);
  assert.match(css, /data-mobile-detail-sticky="true"\][\s\S]*position: sticky;[\s\S]*top: 0/);
  assert.doesNotMatch(css, /data-mobile-detail-layout="true"\][^{]*\{[^}]*position: fixed/);
});

test("both mobile tabs scroll only the detail content without a nested reaction scroller", () => {
  assert.match(detail, /target\.closest<HTMLElement>\("\[data-detail-movie-content\]"\)/);
  assert.match(detail, /if \(mobileDetailScroller\) return mobileDetailScroller/);
  assert.match(detail, /if \(commentInputMode === mode\) \{\s*scrollCommentStartIntoView\(mode\)/);
  assert.match(css, /data-mobile-video-reaction-scroll-container="true"\][\s\S]*max-height: none;[\s\S]*overflow-y: visible/);
});

test("inactive-trailer guest touchmove immediately locks the shared mobile detail scroller", () => {
  assert.match(detail, /if \(!desktopGuest \|\| !active \|\| trailerCompanionOpen \|\| !mobileViewport\) return/);
  assert.match(detail, /history\?\.closest<HTMLElement>\("\[data-detail-movie-content\]"\)/);
  assert.match(detail, /detailScroller\.dataset\.guestVideoReactionScrollLocked = "true"/);
  assert.match(detail, /detailScroller\.addEventListener\("touchmove", handleTouchMove, \{ passive: false \}\)/);
  assert.match(detail, /const handleTouchMove[\s\S]*event\.preventDefault\(\);\s*restoreLockedPosition\(\);[\s\S]*blockGuestAdvance\(\)/);
  assert.match(detail, /if \(!touchGateShown\)[\s\S]*touchGateShown = true;[\s\S]*blockGuestAdvance\(\)/);
  assert.match(detail, /const restoreLockedPosition[\s\S]*detailScroller\.scrollTop = lockedScrollTop/);
  assert.match(detail, /showGuestGate\(guestVideoGateId, "more"\)/);
});

test("inactive-trailer guest wheel immediately locks the shared mobile detail scroller", () => {
  assert.match(detail, /if \(!desktopGuest \|\| !active \|\| trailerCompanionOpen \|\| !mobileViewport\) return/);
  assert.match(detail, /detailScroller\.addEventListener\("wheel", handleWheel, \{ passive: false \}\)/);
  assert.match(detail, /const handleWheel[\s\S]*event\.preventDefault\(\);\s*restoreLockedPosition\(\);\s*blockGuestAdvance\(\)/);
  assert.match(detail, /detailScroller\.addEventListener\("scroll", restoreLockedPosition, \{ passive: true \}\)/);
  assert.match(detail, /showGuestGate\(guestVideoGateId, "more"\)/);
  assert.doesNotMatch(detail, /getAllowedScrollTop|clampToAllowedContent/);
});

test("the inactive-trailer guest lock preserves authenticated, comments, trailer, and sticky behavior", () => {
  assert.match(detail, /if \(!desktopGuest \|\| !active \|\| trailerCompanionOpen \|\| !mobileViewport\) return/);
  assert.match(detail, /delete detailScroller\.dataset\.guestVideoReactionScrollLocked/);
  assert.doesNotMatch(css, /data-guest-video-reaction-scroll-locked[\s\S]*position:\s*fixed/);
  assert.match(css, /data-mobile-detail-sticky="true"\][\s\S]*position: sticky/);
});
