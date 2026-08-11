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
  has(/VIDEO_REACTION_SOURCE_WIDTH = 1280/);
  has(/VIDEO_REACTION_SOURCE_HEIGHT = 720/);
  has(/VIDEO_REACTION_SOURCE_ASPECT_RATIO = 16 \/ 9/);
  has(/canvas\.width = VIDEO_REACTION_WIDTH/);
  has(/canvas\.height = VIDEO_REACTION_HEIGHT/);
  has(/canvas\.captureStream\(30\)/);
  has(/new MediaStream\(\[\.\.\.canvasStream\.getVideoTracks\(\), \.\.\.stream\.getAudioTracks\(\)\]\)/);
  assert.doesNotMatch(page, /orientation_timeline/);
});

test("camera settings are verified while the historical wide source stays independent from portrait output", () => {
  has(/cameraTrack\.getSettings\(\)/);
  has(/CAMERA_SETTINGS/);
  has(/CAMERA_CAPABILITIES/);
  has(/CAMERA_PREVIEW_DIMENSIONS/);
  has(/width: settings\.width/);
  has(/height: settings\.height/);
  has(/aspectRatio: settings\.aspectRatio/);
  has(/resizeMode: settings\.resizeMode/);
  has(/CAMERA_REQUESTED_CONSTRAINTS/);
  has(/video: requestedCameraConstraints/);
  assert.doesNotMatch(page, /portraitBackoff/);
  assert.doesNotMatch(page, /native-fov-source/);
  has(/zoomMin: capabilities\?\.zoom\?\.min/);
  has(/zoomMax: capabilities\?\.zoom\?\.max/);
  has(/CAMERA_DEVICE_INVENTORY/);
  has(/CAMERA_CONSTRAINTS/);
  has(/selection: "default-user-facing-camera"/);
  has(/unexpected-non-user-camera/);
  assert.doesNotMatch(page, /deviceId: \{ exact:/);
});

test("minimum physical zoom is applied after source negotiation and verified with a no-zoom fallback", () => {
  has(/const zoomMinimum = capabilities\?\.zoom\?\.min/);
  has(/const finalZoomConstraints/);
  has(/advanced: \[\{ zoom: zoomMinimum \}/);
  has(/cameraTrack\.applyConstraints\(finalZoomConstraints\)/);
  has(/CAMERA_MINIMUM_ZOOM_RESULT/);
  has(/minimum-zoom-retry/);
  has(/Math\.abs\(appliedZoom - zoomMinimum\) < 0\.001/);
  has(/reason: "unsupported"/);
  assert.ok(page.indexOf("const zoomMinimum") < page.indexOf("finalZoomConstraints"));
});

test("camera composition preserves the complete raw frame with contain", () => {
  has(/facingMode: \{ ideal: "user" \}/);
  has(/aspectRatio: \{ ideal: VIDEO_REACTION_SOURCE_ASPECT_RATIO \}/);
  has(/calculateContainDestinationRect/);
  has(/Math\.min\(targetWidth \/ sourceWidth, targetHeight \/ sourceHeight\)/);
  has(/sourceRect: \{ sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight \}/);
  has(/destinationRect: \{ dx, dy, dw, dh \}/);
  has(/retainedWidthRatio: 1/);
  has(/retainedHeightRatio: 1/);
  has(/context\.drawImage\(preview, 0, 0, sourceWidth, sourceHeight, dx, dy, dw, dh\)/);
  has(/context\.fillRect\(0, 0, canvas\.width, canvas\.height\)/);
  assert.doesNotMatch(page, /calculateCoverSourceRect/);
  assert.doesNotMatch(page, /context\.drawImage\(preview, sx, sy, sw, sh/);
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
  has(/if \(orientationUnsafeRef\.current \|\| isLandscapeViewport\(\)\) \{/);
  has(/if \(recorderRef\.current\?\.state === "recording"\) recorderRef\.current\.pause\(\)/);
  assert.ok(page.indexOf("if (orientationUnsafeRef.current || isLandscapeViewport())") < page.indexOf("context.drawImage(preview"));
});

test("device tilt blocks frames early with hysteresis and keeps landscape fallback", () => {
  has(/VIDEO_REACTION_TILT_PAUSE_DEGREES = 18/);
  has(/VIDEO_REACTION_TILT_RESUME_DEGREES = 8/);
  has(/typeof DeviceOrientationEvent === "undefined"/);
  has(/window\.addEventListener\("deviceorientation", handleEarlyOrientation/);
  has(/tilt >= VIDEO_REACTION_TILT_PAUSE_DEGREES/);
  has(/tilt <= VIDEO_REACTION_TILT_RESUME_DEGREES/);
  assert.ok(page.indexOf("orientationUnsafeRef.current = true") < page.indexOf('setOrientationPaused(true)'));
  has(/!tiltUnsafeRef\.current && orientationPausedRef\.current/);
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
  assert.match(card, /relative inline-flex max-w-full shrink-0 overflow-hidden rounded-xl \[contain:layout_paint\]/);
  assert.match(card, /controls=\{false\}/);
  assert.match(card, /block h-auto w-auto max-w-full shrink-0 object-contain \[contain:layout_paint\]/);
  assert.match(card, /maxHeight: VIDEO_COMMENT_CARD_VIDEO_HEIGHT/);
  assert.match(card, /onLoadedMetadata=\{\(event\) => lockHistoryPlayerGeometry\(event\.currentTarget\)\}/);
  has(/wrapper\.style\.width = `\$\{rect\.width\}px`/);
  has(/wrapper\.style\.height = `\$\{rect\.height\}px`/);
  has(/HISTORY_PLAYER_GEOMETRY/);
  assert.doesNotMatch(card, /activeVideoIdRef\.current === id[^\n]*(className|style)/);
  assert.doesNotMatch(card, /playerStates\[id\][^\n]*(className|style)/);
  assert.match(page, /VIDEO_COMMENT_CARD_VIDEO_HEIGHT = "clamp\(14rem, 36dvh, 18rem\)"/);
  assert.match(card, /space-y-1\.5[\s\S]*p-2\.5/);
});

test("expanded video swipe navigates without closing fullscreen and remains distinct from tap", () => {
  has(/VIDEO_COMMENT_EXPANDED_SWIPE_THRESHOLD = 56/);
  has(/const navigateExpandedVideo = useCallback/);
  has(/const target = comments\[currentIndex \+ direction\]/);
  has(/video\.pause\(\);\s+video\.currentTime = 0/);
  has(/VIDEO_COMMENT_EXPANDED_SWIPE_TRANSITION_MS = 200/);
  has(/VIDEO_COMMENT_EXPANDED_SWIPE_EASING = "cubic-bezier\(0\.22, 1, 0\.36, 1\)"/);
  has(/onTouchMove=/);
  has(/setExpandedDragOffset\(hasTarget \? deltaY : deltaY \* 0\.2\)/);
  has(/translateY\(calc\(/);
  has(/Math\.abs\(deltaY\) > Math\.abs\(deltaX\)/);
  has(/suppressExpandedTapRef\.current = true/);
  has(/if \(suppressExpandedTapRef\.current\)/);
  has(/setExpandedVideoId\(String\(target\.id\)\)/);
  has(/adjacentComment\.video_url/);
  has(/muted playsInline preload="metadata"/);
});

test("recorded preview reuses the recording size and overlay while saved card dimensions stay frozen", () => {
  has(/isRecordedPreviewOverlay = previewOrigin === "recorded"/);
  has(/recorderState === "recording" \|\| isRecordedPreviewOverlay \? VIDEO_COMMENT_RECORDING_PREVIEW_HEIGHT/);
  has(/isRecordingOverlay = recorderState === "preparingRecorder" \|\| recorderState === "recording" \|\| isRecordedPreviewOverlay/);
  assert.doesNotMatch(page, /VIDEO_COMMENT_RECORDED_PREVIEW_HEIGHT/);
  has(/absolute right-3 top-3[\s\S]*formatVideoDuration\(previewDuration\)/);
  assert.doesNotMatch(page, /text-center text-xs text-zinc-400[^>]*>\{formatVideoDuration/);
  has(/VIDEO_COMMENT_CARD_VIDEO_HEIGHT = "clamp\(14rem, 36dvh, 18rem\)"/);
  assert.doesNotMatch(page, /intersectionRatio[^\n]*(height|maxHeight|style)/);
});

test("playable visibility is symmetric above and below the sticky boundary", () => {
  has(/calculatePlayableIntersectionRatio/);
  has(/visibleTop = Math\.max\(rect\.top, stickyBottom, 0\)/);
  has(/visibleBottom = Math\.min\(rect\.bottom, viewportHeight\)/);
  has(/data-mobile-detail-sticky="true"/);
  has(/calculatePlayableIntersectionRatio\(video\.getBoundingClientRect\(\), window\.innerHeight, stickyBottom\)/);
  has(/window\.addEventListener\("scroll", reevaluatePlayableViewport/);
  has(/window\.requestAnimationFrame\(\(\) =>/);
  assert.doesNotMatch(page, /scrollDirection|lastScroll|scrollY >|scrollY </);
});

test("multiple inputs do not open temporary cameras or risk selecting a rear device", () => {
  has(/enumerateDevices\(\)/);
  has(/selection: "default-user-facing-camera"/);
  assert.equal((page.match(/navigator\.mediaDevices\.getUserMedia\(/g) ?? []).length, 1);
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
