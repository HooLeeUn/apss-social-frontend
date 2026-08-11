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

test("camera settings are verified and portrait constraints use a stable backoff", () => {
  has(/cameraTrack\.getSettings\(\)/);
  has(/CAMERA_SETTINGS/);
  has(/CAMERA_CAPABILITIES/);
  has(/CAMERA_PREVIEW_DIMENSIONS/);
  has(/width: settings\.width/);
  has(/height: settings\.height/);
  has(/aspectRatio: settings\.aspectRatio/);
  has(/resizeMode: settings\.resizeMode/);
  has(/portraitBackoff/);
  has(/cameraTrack\.applyConstraints\(constraints\)/);
  has(/capabilities\?\.zoom\?\.min/);
});

test("landscape source fallback fills portrait output without contain bars or stretching", () => {
  has(/calculateCoverSourceRect/);
  has(/sourceRatio > targetRatio/);
  has(/context\.drawImage\(preview, sx, sy, sw, sh, 0, 0, canvas\.width, canvas\.height\)/);
  assert.doesNotMatch(page, /calculateContainRect/);
  assert.doesNotMatch(page, /context\.fillRect\(0, 0, canvas\.width, canvas\.height\)/);
});

test("front preview and recorded canvas have exactly one matching mirror", () => {
  has(/<canvas ref={canvasRef} className="h-full w-full object-contain"/);
  has(/<video ref={livePreviewRef} autoPlay muted playsInline className="hidden"/);
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
  has(/if \(isLandscapeViewport\(\)\) \{/);
  has(/if \(recorderRef\.current\?\.state === "recording"\) recorderRef\.current\.pause\(\)/);
  assert.ok(page.indexOf("if (isLandscapeViewport())") < page.indexOf("context.drawImage(preview"));
});

test("orientation overlay is translated, responsive, and animated", () => {
  assert.match(i18n, /Gira tu teléfono a posición vertical para continuar grabando\./);
  assert.match(i18n, /Rotate your phone to portrait to continue recording\./);
  assert.match(css, /@keyframes video-reaction-rotate-phone/);
  has(/orientationPaused \? <div className="fixed inset-0 z-\[200\] flex h-\[100dvh\] w-\[100dvw\]/);
});

test("video reaction is first and default while directed deep links select text comments", () => {
  has(/useState<CommentInputMode>\("video-comment"\)/);
  has(/\{\(\["video-comment", "text-comment"\] as const\)\.map/);
  has(/section"\) !== "directed-comments"/);
  has(/setCommentInputMode\("text-comment"\)/);
  assert.match(i18n, /movieDetailVideoCommentTitle: "Video reacción"/);
  assert.match(i18n, /movieDetailVideoCommentTitle: "Video Reaction"/);
});

test("recorded preview is 9:16 with only custom volume and expand controls", () => {
  has(/previewOrigin === "recorded" \? 9 \/ 16/);
  has(/muted={previewMuted} controls={false}/);
  has(/setPreviewMuted\(video\.muted\)/);
  has(/bottom-3 left-3[\s\S]*movieDetailVideoSoundOn/);
  has(/bottom-3 right-3[\s\S]*setPreviewExpanded\(true\)/);
  has(/previewExpanded && previewUrl/);
  has(/aspect-\[9\/16\] h-\[calc\(100dvh-1\.5rem\)\] w-auto/);
  assert.doesNotMatch(page, /src={previewUrl}[^>]*controls={true}/);
});

test("saved cards only render volume and expand controls and tap toggles playback", () => {
  const card = page.slice(page.indexOf('data-video-comment-card={id}'), page.indexOf('loadingMore ?'));
  assert.match(card, /onClick=\{\(\) => toggleHistoryPlayback\(id\)\}/);
  assert.match(card, /movieDetailVideoSoundOn/);
  assert.match(card, /movieDetailVideoExpand/);
  assert.doesNotMatch(card, /movieDetailVideoRestart/);
  assert.doesNotMatch(card, /movieDetailVideoPlay/);
  assert.match(card, /h-auto max-h-\[calc\(100dvh-12rem\)\] w-auto max-w-full object-contain/);
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
  has(/previewOrigin === "recorded" \? 9 \/ 16 : event\.currentTarget\.videoWidth \/ Math\.max\(1, event\.currentTarget\.videoHeight\)/);
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
