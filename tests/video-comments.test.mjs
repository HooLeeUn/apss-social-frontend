import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/movies/[id]/page.tsx", import.meta.url), "utf8");
const i18n = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const has = (pattern) => assert.match(page, pattern);

test("camera recording is composed into a real 720x1280 portrait canvas", () => {
  has(/VIDEO_REACTION_WIDTH = 720/);
  has(/VIDEO_REACTION_HEIGHT = 1280/);
  has(/canvas\.width = VIDEO_REACTION_WIDTH/);
  has(/canvas\.height = VIDEO_REACTION_HEIGHT/);
  has(/canvas\.captureStream\(30\)/);
  has(/new MediaStream\(\[\.\.\.canvasStream\.getVideoTracks\(\), \.\.\.stream\.getAudioTracks\(\)\]\)/);
  assert.doesNotMatch(page, /orientation_timeline/);
});

test("contain calculation preserves the complete camera field without source crop", () => {
  has(/Math\.min\(targetWidth \/ sourceWidth, targetHeight \/ sourceHeight\)/);
  has(/context\.drawImage\(preview, dx, dy, dw, dh\)/);
  has(/aspectRatio: \{ ideal: 9 \/ 16 \}/);
  has(/capabilities\?\.zoom\?\.min/);
  has(/object-contain/);
});

test("front preview and recorded canvas have exactly one matching mirror", () => {
  has(/className="h-full w-full -scale-x-100 object-contain"/);
  has(/context\.translate\(canvas\.width, 0\)/);
  has(/context\.scale\(-1, 1\)/);
});

test("landscape pauses recorder and counter, then portrait resumes the same recording", () => {
  has(/matchMedia\("\(orientation: landscape\)"\)/);
  has(/recorder\.pause\(\)/);
  has(/recorder\.resume\(\)/);
  has(/if \(orientationPausedRef\.current\) return seconds/);
  has(/window\.addEventListener\("orientationchange"/);
  has(/screen\.orientation\?\.addEventListener/);
  has(/recorderState === "recording" && !orientationPaused/);
});

test("orientation overlay is translated, responsive, and animated", () => {
  assert.match(i18n, /Gira tu teléfono a posición vertical para continuar grabando\./);
  assert.match(i18n, /Rotate your phone to portrait to continue recording\./);
  assert.match(css, /@keyframes video-reaction-rotate-phone/);
  has(/orientationPaused \? <div className="absolute inset-0/);
});

test("video reaction is first and default while directed deep links select text comments", () => {
  has(/useState<CommentInputMode>\("video-comment"\)/);
  has(/\{\(\["video-comment", "text-comment"\] as const\)\.map/);
  has(/section"\) !== "directed-comments"/);
  has(/setCommentInputMode\("text-comment"\)/);
  assert.match(i18n, /movieDetailVideoCommentTitle: "Video reacción"/);
  assert.match(i18n, /movieDetailVideoCommentTitle: "Video Reaction"/);
});

test("preview and saved reactions avoid native controls and expose one custom expand action", () => {
  assert.doesNotMatch(page, /src=\{previewUrl\} controls(?:\s|>)/);
  has(/controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback/);
  has(/setPreviewExpanded\(true\)/);
  has(/previewExpanded && previewUrl/);
  has(/max-h-\[calc\(100dvh-1\.5rem\)\] max-w-full object-contain/);
});

test("saved cards only render volume and expand controls and tap toggles playback", () => {
  const card = page.slice(page.indexOf('data-video-comment-card={id}'), page.indexOf('loadingMore ?'));
  assert.match(card, /onClick=\{\(\) => toggleHistoryPlayback\(id\)\}/);
  assert.match(card, /movieDetailVideoSoundOn/);
  assert.match(card, /movieDetailVideoExpand/);
  assert.doesNotMatch(card, /movieDetailVideoRestart/);
  assert.doesNotMatch(card, /movieDetailVideoPlay/);
  assert.match(card, /object-contain/);
});

test("one observer selects the dominant dynamic video with hysteresis and resets every loser", () => {
  has(/new IntersectionObserver/);
  has(/historyObserverRef\.current\?\.observe\(video\)/);
  has(/bestRatio - currentRatio < VIDEO_COMMENT_DOMINANCE_MARGIN/);
  has(/if \(id === candidate\) return;\s+video\.pause\(\);\s+video\.currentTime = 0/);
  has(/pausedByUserRef\.current\.delete\(id\)/);
  has(/!pausedByUserRef\.current\.has\(candidate\)/);
  has(/reloadFirstPage/);
});

test("background and route cleanup pauses all videos before viewport reevaluation", () => {
  has(/document\.addEventListener\("visibilitychange", handleVisibility\)/);
  has(/window\.addEventListener\("pagehide", pauseAll\)/);
  has(/visible \/ Math\.max\(1, rect\.height\)/);
  has(/chooseVisibleHistoryVideo\(\)/);
  has(/return \(\) => \{[\s\S]*pauseAll\(\)/);
});

test("library videos preserve intrinsic aspect ratio through preview, card, and modal", () => {
  has(/setPreviewAspectRatio\(event\.currentTarget\.videoWidth \/ Math\.max\(1, event\.currentTarget\.videoHeight\)\)/);
  has(/processSelectedVideo/);
  has(/data\.append\("video", file, file\.name\)/);
  has(/max-w-full object-contain/);
  assert.doesNotMatch(page, /drawImage\([^\n]*selectedFile/);
});

test("touch landscape keeps the mobile Detail Movie layout", () => {
  assert.match(css, /@media \(orientation: landscape\) and \(pointer: coarse\)/);
  has(/data-mobile-video-reaction/);
  has(/data-mobile-comment-tabs/);
});
