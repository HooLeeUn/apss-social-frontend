import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/movies/[id]/page.tsx", import.meta.url), "utf8");
const i18n = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const trailerModal = readFileSync(new URL("../components/TrailerModal.tsx", import.meta.url), "utf8");
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

test("gravity roll blocks frames early with hysteresis and keeps landscape fallback", () => {
  has(/VIDEO_REACTION_TILT_PAUSE_DEGREES = 65/);
  has(/VIDEO_REACTION_TILT_RESUME_DEGREES = 35/);
  has(/VIDEO_REACTION_TILT_CONFIRMATION_SAMPLES = 2/);
  has(/typeof DeviceMotionEvent === "undefined"/);
  has(/window\.addEventListener\("devicemotion", handleEarlyMotion/);
  has(/!isDesktopRecording && requestMotionPermission/);
  has(/const gravity = event\.accelerationIncludingGravity/);
  has(/Math\.atan2\(gravity\.x, Math\.sqrt\(gravity\.y \* gravity\.y \+ gravity\.z \* gravity\.z\)\)/);
  assert.doesNotMatch(page, /event\.(?:alpha|beta|gamma)/);
  has(/lateralRoll >= VIDEO_REACTION_TILT_PAUSE_DEGREES/);
  has(/lateralRoll <= VIDEO_REACTION_TILT_RESUME_DEGREES/);
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
  assert.match(card, /onLoadedMetadata=\{\(event\) => \{ lockHistoryPlayerGeometry\(event\.currentTarget\)/);
  has(/wrapper\.style\.width = `\$\{rect\.width\}px`/);
  has(/wrapper\.style\.height = `\$\{rect\.height\}px`/);
  has(/HISTORY_PLAYER_GEOMETRY/);
  assert.doesNotMatch(card, /activeVideoIdRef\.current === id[^\n]*(className|style)/);
  assert.doesNotMatch(card, /playerStates\[id\][^\n]*(className|style)/);
  assert.match(page, /VIDEO_COMMENT_CARD_VIDEO_HEIGHT = "clamp\(14rem, 36dvh, 18rem\)"/);
  assert.match(card, /space-y-1\.5[\s\S]*p-2\.5/);
});

test("expanded video swipe navigates without closing fullscreen and remains distinct from tap", () => {
  const expandedPlayer = page.slice(page.indexOf("{expandedVideoId !== null"), page.indexOf("</main>"));
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
  has(/const currentVideo = expandedVideosRef\.current\.get\(expandedVideoId\)/);
  has(/expandedVideosRef\.current\.get\(expandedVideoId\) !== video/);
  has(/video\.readyState >= HTMLMediaElement\.HAVE_CURRENT_DATA/);
  has(/video\.addEventListener\("loadeddata", playActiveExpandedVideo, \{ once: true \}\)/);
  has(/const playPromise = video\.play\(\)/);
  has(/playPromise\.catch/);
  has(/data-expanded-video-id=\{expandedVideoId\}/);
  has(/adjacentComment\.video_url/);
  has(/key=\{String\(adjacentComment\.id\)\}/);
  has(/key=\{expandedVideoId\}/);
  has(/muted playsInline preload="auto"/);
  assert.doesNotMatch(expandedPlayer, /src\s*=\s*""|\.load\(\)/);
});

test("expanded sound changes persist through the shared session preference", () => {
  has(/const applyVideoSoundPreference = useCallback/);
  has(/soundPreferenceRef\.current = preference/);
  has(/sessionStorage\.setItem\(VIDEO_COMMENT_SOUND_SESSION_KEY/);
  has(/applyVideoSoundPreference\(video\.muted \? "sound-on" : "muted", video\)/);
  has(/video\.muted = soundPreferenceRef\.current !== "sound-on"/);
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

test("REC options and the active recorder escape reaction scroll clipping without resizing media", () => {
  has(/createPortal\(<div ref=\{optionsMenuRef\} data-rec-options-menu/);
  has(/className="fixed z-\[100\] w-52/);
  has(/desktop \? rect\.right \+ 12 : rect\.left \+ rect\.width \/ 2 - menuWidth \/ 2/);
  has(/isRecordingOverlay \? "contents" : "max-h-\[50dvh\] overflow-y-auto/);
  has(/isRecordingOverlay && typeof document !== "undefined" \? createPortal\(reactionContent, document\.body\)/);
  has(/isRecordingOverlay \? "fixed inset-0 z-50 overflow-hidden bg-black px-3 py-3"/);
  has(/data-recording-overlay=\{isRecordingOverlay\}/);
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*\[data-mobile-video-reaction\]\[data-recording-overlay="true"\] \{[\s\S]*?position: fixed;\s*inset: 0;\s*z-index: 50;/);
  has(/VIDEO_COMMENT_RECORDING_PREVIEW_HEIGHT = "min\(calc\(100dvh - var\(--video-recording-controls-space, 116px\) - env\(safe-area-inset-bottom\)\), calc\(\(100vw - 24px\) \* 16 \/ 9\)\)"/);
  has(/maxHeight: VIDEO_COMMENT_RECORDING_PREVIEW_HEIGHT/);
  assert.match(css, /data-recording-overlay="true"\] \{\s*--video-recording-controls-space: 104px;/);
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

test("Detail Movie keeps the authenticated avatar beside both tab layouts", () => {
  has(/getMyProfile\(\)\.then/);
  has(/href="\/profile-feed"/);
  has(/movieDetailMyProfileAvatarLabel/);
  assert.equal((page.match(/<AuthenticatedProfileAvatar/g) ?? []).length, 2);
  has(/data-mobile-comment-tabs className="relative/);
  has(/data-desktop-comment-tabs className="relative/);
});

test("mobile Video Reaction tab adds avatar clearance without moving the row or desktop tabs", () => {
  has(/mode === "video-comment" \? "pl-6 pr-2" : "px-2"/);
  assert.match(page, /data-desktop-comment-tabs[\s\S]*className=\{`min-h-11 px-3 py-2/);
});

test("mobile Video Reaction tab resets its real vertical history scroller", () => {
  has(/mode === "video-comment"[\s\S]*\[data-mobile-video-reaction-scroll-container\][\s\S]*scrollTo\(\{ top: 0, behavior: "smooth" \}\)/);
  has(/if \(commentInputMode === mode\)/);
  assert.doesNotMatch(page, /window\.scrollTo\(\{ top: 0/);
});

test("desktop Video Reaction ends at its content without changing shared comment height", () => {
  const reactionRule = css.slice(
    css.indexOf("body:not(.detail-trailer-active) [data-mobile-video-reaction]"),
    css.indexOf("body:not(.detail-trailer-active) [data-video-reaction-rec]"),
  );
  assert.match(reactionRule, /position: relative/);
  assert.doesNotMatch(reactionRule, /min-height|height:|padding-bottom|margin-bottom/);
});

test("trailer overlay exposes the existing reaction list without duplicating players", () => {
  assert.match(css, /body\.detail-trailer-active \[data-desktop-video-reaction-history\]/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.detail-trailer-active \.trailer-modal-card/);
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*transform: translateX\(-13rem\)/);
  assert.equal((page.match(/comments\.map\(\(comment\)/g) ?? []).length, 1);
});

test("trailer and reactions coordinate audio and fullscreen through player refs", () => {
  assert.match(trailerModal, /playerRef\.current\?\.mute\(\)/);
  assert.match(trailerModal, /playerRef\.current\?\.unMute\(\)/);
  assert.match(trailerModal, /qnext:reaction-fullscreen-enter/);
  assert.match(trailerModal, /qnext:trailer-fullscreen-enter/);
  has(/qnext:reaction-muted-change/);
  has(/qnext:trailer-muted-change/);
  has(/historyVideosRef\.current\.forEach\(\(video\) => video\.pause\(\)\)/);
});

test("active trailer loops from the real YouTube ended state without rebuilding its iframe", () => {
  assert.match(trailerModal, /event\.data !== window\.YT\?\.PlayerState\.ENDED/);
  assert.match(trailerModal, /cancelled \|\| !trailerIsActiveRef\.current/);
  assert.match(trailerModal, /event\.target\.seekTo\(0, true\);\s*event\.target\.playVideo\(\);/);
  assert.doesNotMatch(trailerModal, /setInterval\([^)]*seekTo|setTimeout\([^)]*seekTo/);
});

test("trailer companion navigates the three existing views without circular swipes", () => {
  has(/type TrailerCompanionView = "reaction" \| "public-comments" \| "directed-comments"/);
  has(/TRAILER_COMPANION_SWIPE_THRESHOLD_PX = 56/);
  has(/TRAILER_COMPANION_HORIZONTAL_DOMINANCE = 1\.25/);
  has(/Math\.abs\(deltaX\) > Math\.abs\(deltaY\) \* TRAILER_COMPANION_HORIZONTAL_DOMINANCE/);
  has(/nextIndex >= 0 && nextIndex < views\.length/);
  has(/commentInputMode === "video-comment" \? "reaction" : "public-comments"/);
  has(/data-trailer-public-comments/);
  has(/data-trailer-directed-comments/);
  assert.doesNotMatch(page, /filteredPublicComments\.sort|filteredDirectedConversations\.sort/);
});

test("mobile trailer companion follows the horizontal gesture and settles smoothly", () => {
  has(/handleCompanionTouchMove = \(event: React\.TouchEvent<HTMLElement>\)/);
  has(/--trailer-companion-drag-x/);
  has(/TRAILER_COMPANION_SWIPE_TRANSITION_MS = 260/);
  assert.match(css, /trailer-companion-settling[\s\S]*transition: transform 260ms ease-out/);
  assert.match(css, /translateX\(calc\(100% \+ var\(--trailer-companion-drag-x, 0px\)\)\)/);
});

test("desktop trailer companion uses unified headings, separators, and scoped dark scrollbars", () => {
  assert.match(css, /trailer-companion-desktop-title--reaction/);
  assert.match(css, /desktop-video-reaction-card \+ \.desktop-video-reaction-card/);
  assert.match(css, /scrollbar-color: #3f4a5a #09090b/);
  assert.match(css, /data-trailer-public-comments\]::-webkit-scrollbar-thumb/);
});

test("reaction expanded view mounts before the trailer closes and survives companion deactivation", () => {
  has(/setExpandedVideoId\(id\);\s+window\.requestAnimationFrame\(\(\) => window\.dispatchEvent\(new Event\("qnext:reaction-fullscreen-enter"\)\)\)/);
  has(/active \|\| expandedVideoId !== null \? "block" : "hidden"/);
  has(/fixed inset-0 z-\[1100\]/);
});

test("trailer companion has production-level empty states without replacing filtered-empty copy", () => {
  has(/publicComments\.length === 0 \? t\("movieDetailTrailerCompanionEmpty"\) : t\("movieDetailNoPublicComments"\)/);
  has(/directedConversations\.length === 0 \? t\("movieDetailTrailerCompanionEmpty"\)/);
});

test("expanded reaction scroll lock follows trailer cleanup and restores every global scroll value", () => {
  has(/expandedScrollLockRef = useRef<\{ bodyOverflow: string; rootOverflow: string; bodyPosition: string; bodyTop: string \} \| null>/);
  has(/window\.addEventListener\("qnext:detail-trailer-close", syncRestoredTrailerScroll\)/);
  has(/window\.addEventListener\("pagehide", restoreScroll\)/);
  has(/window\.addEventListener\("beforeunload", restoreScroll\)/);
  has(/document\.documentElement\.style\.overflow = previous\.rootOverflow/);
  has(/document\.body\.style\.position = previous\.bodyPosition/);
  has(/document\.body\.style\.top = previous\.bodyTop/);
  has(/document\.body\.classList\.remove\("detail-trailer-active", "trailer-companion-dragging", "trailer-companion-settling"\)/);
});

test("companion overlay centers empty reactions and pins directed conversations to the top", () => {
  assert.match(css, /data-desktop-video-reaction-history\] > p\.text-zinc-500[\s\S]*min-height: 12rem/);
  assert.match(css, /data-trailer-directed-comments\][\s\S]*justify-content: start/);
  assert.match(css, /trailer-companion-navigation[\s\S]*justify-content: space-between/);
});

test("normal desktop reactions use a fixed-control horizontal carousel", () => {
  has(/canScrollHistoryLeft/);
  has(/canScrollHistoryRight/);
  has(/container\.scrollLeft > tolerance/);
  has(/container\.scrollLeft \+ container\.clientWidth < container\.scrollWidth - tolerance/);
  has(/container\.scrollBy\(\{ left: direction \* \(\(firstCard\?\.offsetWidth \?\? 384\) \+ gap\), behavior: "smooth" \}\)/);
  has(/desktopCarousel && rootRect/);
  assert.match(css, /body:not\(\.detail-trailer-active\) \[data-desktop-video-reaction-history\][\s\S]*overflow-x: auto;[\s\S]*overflow-y: hidden/);
  assert.match(css, /body:not\(\.detail-trailer-active\) \[data-video-reaction-rec\][\s\S]*left: 0/);
  assert.match(css, /data-can-scroll-right="true"[\s\S]*linear-gradient/);
});

test("trailer companion preserves the vertical list with an opaque frozen header", () => {
  assert.match(css, /body\.detail-trailer-active \[data-history-carousel-viewport\][\s\S]*display: contents/);
  assert.match(css, /body\.detail-trailer-active \[data-history-carousel-arrow\][\s\S]*display: none/);
  assert.match(css, /body\.detail-trailer-active \[data-trailer-companion-controls\][\s\S]*background: #09090b/);
});

test("recorder flow disables and then remeasures carousel arrows without resetting scroll", () => {
  has(/recorderState !== "idle" \|\| !canScrollHistoryLeft/);
  has(/recorderState !== "idle" \|\| !canScrollHistoryRight/);
  has(/const frame = window\.requestAnimationFrame\(updateHistoryCarouselState\)/);
  assert.doesNotMatch(page, /historyScrollRef\.current\?\.scrollTo\(\{ left:/);
});

test("reaction cards are borderless and owner delete uses a dismissible overflow menu", () => {
  has(/setDeleteMenuId/);
  has(/>⋮<\/button>/);
  has(/setDeleteMenuId\(null\); setDeleteConfirmId\(comment\.id\)/);
  has(/document\.addEventListener\("pointerdown", closeMenu\)/);
  has(/const historyScroller = historyScrollRef\.current/);
  has(/historyScroller\?\.addEventListener\("scroll", closeMenu/);
  has(/event\.target\.closest\("\[data-video-delete-menu\]"\)/);
  assert.doesNotMatch(page, /desktop-video-reaction-card[^"\n]*border border-white/);
});

test("desktop companion header fully occludes reactions and public title sits between arrows", () => {
  assert.match(css, /data-trailer-companion-controls[\s\S]*min-height: 4\.25rem[\s\S]*background: #09090b[\s\S]*box-shadow/);
  has(/trailer-companion-desktop-title--public/);
  has(/!trailerCompanionOpen \? <h2/);
  assert.match(css, /trailer-companion-desktop-title--public[\s\S]*left: 50%[\s\S]*white-space: nowrap/);
  assert.match(css, /desktop-video-reaction-card[\s\S]*width: fit-content;[\s\S]*flex: 0 0 auto/);
});

test("desktop carousel advances through the visible queue and public comments use one scroll surface", () => {
  has(/DESKTOP_CAROUSEL_QUEUE_VISIBILITY_THRESHOLD = 0\.5/);
  has(/visibleWidth \/ Math\.max\(1, rect\.width\)/);
  has(/\.filter\(\(\{ ratio \}\) => ratio >= DESKTOP_CAROUSEL_QUEUE_VISIBILITY_THRESHOLD\)/);
  has(/\.sort\(\(a, b\) => a\.left - b\.left\)/);
  has(/visibleIds\[visibleIds\.indexOf\(endedId\) \+ 1\]/);
  has(/playNextVisibleHistoryVideo\(id\)/);
  has(/carouselScrollTimerRef\.current = window\.setTimeout/);
  assert.match(css, /trailer-companion-desktop-title--public[\s\S]*font-size: 1\.2rem/);
  assert.match(css, /data-trailer-public-comments-list[\s\S]*max-height: none;[\s\S]*overflow-y: visible/);
});
