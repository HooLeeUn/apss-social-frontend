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

test("mobile Video Reactions freeze Detail Movie and give the remaining viewport to one scroller", () => {
  assert.match(detail, /data-mobile-video-reaction-layout=\{commentInputMode === "video-comment"/);
  assert.match(detail, /data-detail-movie-content/);
  assert.match(css, /@media \(max-width: 1279px\)[\s\S]*data-mobile-video-reaction-layout="true"[\s\S]*position: fixed;[\s\S]*height: 100dvh;[\s\S]*overflow: hidden/);
  assert.match(css, /data-mobile-detail-sticky="true"\][\s\S]*position: static;[\s\S]*data-mobile-video-reaction-scroll-container="true"\][\s\S]*height: 100%;[\s\S]*max-height: none;[\s\S]*overscroll-behavior-y: contain;[\s\S]*touch-action: pan-y/);
});

test("mobile Video Reactions do not hand their tab gesture to document scrolling", () => {
  assert.match(detail, /if \(mode !== "video-comment"\) scrollCommentStartIntoView\(mode\)/);
  assert.match(detail, /commentInputMode === "video-comment" && !window\.matchMedia\("\(min-width: 1280px\)"\)\.matches[\s\S]*pendingCommentInputScrollRef\.current = null;[\s\S]*return;/);
});
