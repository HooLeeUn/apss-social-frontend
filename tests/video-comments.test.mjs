import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const page = readFileSync(new URL('../app/movies/[id]/page.tsx', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../lib/i18n.ts', import.meta.url), 'utf8');
const has = (pattern) => assert.match(page, pattern);

test('state machine contains explicit local and remote phases', () => {
  for (const state of ['idle','menu','permissionInfo','requestingPermission','preparingRecorder','recording','validatingSelected','previewRecorded','previewSelected','uploading','error']) has(new RegExp(`"${state}"`));
});

test('REC is hidden during local recording/preview states', () => {
  has(/const isLocalVideoState = recorderState === "preparingRecorder"/);
  has(/\{!isLocalVideoState \? <button type="button" className="flex h-24/);
});

test('recording locks body scroll and restores it', () => {
  has(/document\.body\.style\.overflow = "hidden"/);
  has(/document\.body\.style\.overflow = bodyOverflowRef\.current/);
});

test('cancel returns directly to idle and stops tracks', () => {
  has(/const cancelToIdle = useCallback\(\(\) => \{ cleanupRecorder\(\{ clearPreview: true, nextState: "idle" \}\); setError\(""\); setRecorderState\("idle"\); \}/);
  has(/getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
});

test('MediaRecorder waits for last dataavailable before building Blob', () => {
  has(/recorder\.ondataavailable = \(event\) => \{\s+if \(event\.data\.size > 0\)/);
  has(/chunksRef\.current\.push\(event\.data\)/);
  has(/recorder\.onstop = \(\) => \{/);
  has(/const chunks = \[\.\.\.chunksRef\.current\]/);
  assert.ok(page.indexOf('const chunks = [...chunksRef.current]') < page.indexOf('const blob = new Blob(chunks'));
  assert.ok(page.indexOf('const blob = new Blob(chunks') < page.indexOf('chunksRef.current = []', page.indexOf('const blob = new Blob(chunks')));
});

test('empty recorded Blob shows a recording-specific error', () => {
  has(/chunks\.length === 0/);
  has(/t\("movieDetailVideoRecordedCreateError"\)/);
});

test('recorded preview mounts immediately and valid playable File enables Send', () => {
  has(/mountPreviewImmediately\(file, "recorded"\)/);
  has(/setPreviewDuration\(null\)/);
  has(/disabled=\{recorderState === "uploading" \|\| !previewFile \|\| previewFile\.size <= 0 \|\| previewDuration === null/);
});

test('retake skips QNext modal and calls camera flow directly', () => {
  has(/const retake = useCallback\(\(\) => \{ revokePreview\(\); setError\(""\); void continueToNativePermissions\(\); \}/);
});

test('permission info acceptance is session-only and non audiovisual', () => {
  has(/VIDEO_COMMENT_PERMISSION_SESSION_KEY/);
  has(/sessionStorage\.setItem\(VIDEO_COMMENT_PERMISSION_SESSION_KEY, "1"\)/);
  const sessionWrites = [...page.matchAll(/sessionStorage\.setItem\(([^)]*)\)/g)].map((match) => match[1]);
  assert.ok(sessionWrites.includes('VIDEO_COMMENT_PERMISSION_SESSION_KEY, "1"'));
});

test('file input preserves file before clearing and valid selected file becomes previewSelected', () => {
  const selected = page.indexOf('const selectedFile = input.files?.item(0) ?? undefined');
  const cleared = page.indexOf('input.value = ""', selected);
  assert.ok(selected > -1 && cleared > selected);
  has(/selectedFileRef\.current = file/);
  has(/setRecorderState\("validatingSelected"\)/);
  has(/changeRecorderState\(source === "recorded" \? "previewRecorded" : "previewSelected"\)/);
});

test('selected file accepts empty Android MIME when extension is video-like', () => {
  has(/file\.type && !file\.type\.startsWith\("video\/"\) && !hasVideoLikeExtension\(file\.name\)/);
});

test('selected and recorded previews use one immediate object URL pipeline', () => {
  has(/function prepareVideoPreview/);
  has(/mountPreviewImmediately\(file, "recorded"\)/);
  has(/mountPreviewImmediately\(file, "selected"\)/);
  has(/URL\.createObjectURL\(file\)/);
  has(/setPreviewUrl\(objectUrl\)/);
});

test('visible preview mounts before duration and drives duration/playability', () => {
  has(/setPreviewUrl\(objectUrl\)/);
  has(/setPreviewDuration\(null\)/);
  has(/changeRecorderState\(source === "recorded" \? "previewRecorded" : "previewSelected"\)/);
  has(/src=\{previewUrl\} controls controlsList="nofullscreen" preload="auto" playsInline/);
  has(/onLoadedMetadata=\{\(event\) => \{[\s\S]*?handlePreviewMediaEvent\("duration"/);
  has(/onDurationChange=\{\(event\) => \{[\s\S]*?handlePreviewMediaEvent\("duration"/);
  has(/onLoadedData=\{\(event\) => \{[\s\S]*?handlePreviewMediaEvent\("playable"/);
  has(/onCanPlay=\{\(event\) => \{[\s\S]*?handlePreviewMediaEvent\("playable"/);
});

test('Infinity is rejected and seekable can resolve duration', () => {
  has(/Number\.isFinite\(video\.duration\) && video\.duration > 0/);
  has(/video\.seekable\.length > 0 \? video\.seekable\.end\(video\.seekable\.length - 1\)/);
});

test('preview timeout always ends indefinite preparing state with visible error', () => {
  has(/window\.setTimeout\(\(\) => \{/);
  has(/setPreviewError\(t\("movieDetailVideoPreviewTimeout"\)\)/);
  has(/\}, 10000\)/);
});

test('object URL cleanup is stable and does not run on preview phase changes', () => {
  has(/const previewUrlRef = useRef<string \| null>\(null\)/);
  has(/const revokePreview = useCallback/);
  const revokeStart = page.indexOf('const revokePreview = useCallback');
  const revokeEnd = page.indexOf('const stopTracks', revokeStart);
  assert.doesNotMatch(page.slice(revokeStart, revokeEnd), /\[.*previewUrl.*\]/);
});

test('object URL is revoked only by explicit cancel, retake, successful upload, replacement or unmount cleanup', () => {
  has(/URL\.revokeObjectURL\(objectUrl\)/);
  has(/const cancelToIdle = useCallback\(\(\) => \{ cleanupRecorder\(\{ clearPreview: true/);
  has(/const retake = useCallback\(\(\) => \{ revokePreview\(\)/);
  const upload = page.slice(page.indexOf('const uploadVideo = useCallback'), page.indexOf('const sendVideo = useCallback'));
  assert.match(upload, /await apiFetch[\s\S]*revokePreview\(\)[\s\S]*setRecorderState\("idle"\)/);
});

test('temporary video diagnostics are opt-in and contain no sensitive data', () => {
  has(/get\("videoDebug"\) === "1"/);
  has(/videoDebugEnabled \? <aside/);
  for (const event of ['IOS_ENVIRONMENT','RECORDER_CREATED','DATA_AVAILABLE','RECORDER_STOPPED','RECORDED_BLOB','RECORDED_FILE','PREVIEW_METHOD','PREVIEW_EVENTS','PREVIEW_ERROR']) has(new RegExp(event));
  assert.doesNotMatch(page, /appendVideoDebugLog\([^\n]*(token|authorization|cookie)/i);
});

test('iOS MIME order, feature checks, constructor fallback, and real output type are preserved', () => {
  has(/IOS_VIDEO_COMMENT_MIME_CANDIDATES = \["video\/mp4", "video\/mp4;codecs=avc1\.42E01E,mp4a\.40\.2", "video\/webm;codecs=vp8,opus", "video\/webm"\]/);
  has(/VIDEO_COMMENT_MIME_CANDIDATES = \["video\/webm;codecs=vp8,opus", "video\/webm;codecs=vp9,opus", "video\/webm", "video\/mp4"\]/);
  has(/!MediaRecorder\.isTypeSupported\(mimeType\)\) continue/);
  has(/return \{ recorder: new MediaRecorder\(stream\), requestedMimeType: "" \}/);
  has(/const realMimeType = recorder\.mimeType/);
  has(/base === "video\/mp4" \? "mp4" : base === "video\/webm" \? "webm"/);
});

test('stop is idempotent, keeps chunks through onstop, and rejects empty aggregate', () => {
  has(/stopRequestedRef = useRef\(false\)/);
  has(/recorder\?\.state === "recording" && !stopRequestedRef\.current/);
  has(/stopRequestedRef\.current = true/);
  has(/const totalSize = chunks\.reduce/);
  has(/chunks\.length === 0 \|\| totalSize <= 0/);
});

test('WebKit preview fallback is isolated from Android and object URL remains first', () => {
  assert.ok(page.indexOf('URL.createObjectURL(file)') < page.indexOf('srcObject = file'));
  has(/if \(!iosWebKit \|\| !video \|\| !file/);
  has(/srcObject = file/);
  has(/previewTimeoutRef\.current = window\.setTimeout/);
});

test('iOS upload selections accept QuickTime and empty MIME with a valid extension', () => {
  has(/VIDEO_COMMENT_ALLOWED_EXTENSIONS = \["mp4", "webm", "mov", "m4v"\]/);
  has(/file\.type && !file\.type\.startsWith\("video\/"\) && !hasVideoLikeExtension/);
});

test('history callback identity cannot clean a newly mounted preview', () => {
  has(/reloadFirstPageRef\.current = reloadFirstPage/);
  has(/if \(active\) void reloadFirstPageRef\.current\(\)/);
  has(/\}, \[active, cleanupRecorder\]\)/);
  assert.doesNotMatch(page, /\[active, cleanupRecorder, reloadFirstPage\]/);
});

test('preview media handling is idempotent and does not register duplicate listeners', () => {
  has(/previewDurationRef\.current === null/);
  has(/!previewPlayableRef\.current/);
  const localPreview = page.slice(page.indexOf('key={previewUrl}'), page.indexOf('recorderState === "preparingRecorder" ? <span'));
  assert.equal((localPreview.match(/onDurationChange=/g) || []).length, 1);
  assert.equal((localPreview.match(/onLoadedMetadata=/g) || []).length, 1);
  assert.equal((localPreview.match(/onLoadedData=/g) || []).length, 1);
  assert.equal((localPreview.match(/onCanPlay=/g) || []).length, 1);
  assert.doesNotMatch(page, /addEventListener\([^)]*(loadedmetadata|durationchange|loadeddata|canplay)/);
  assert.doesNotMatch(page, /previewVideoRef\.current\.load\(\)/);
});

test('uploadVideo performs POST with FormData video and no manual Content-Type', () => {
  const uploadStart = page.indexOf('const uploadVideo = useCallback');
  const uploadEnd = page.indexOf('const sendVideo = useCallback', uploadStart);
  const upload = page.slice(uploadStart, uploadEnd);
  assert.match(upload, /const data = new FormData\(\)/);
  assert.match(upload, /data\.append\("video", file, file\.name\)/);
  assert.match(upload, /method: "POST", body: data/);
  assert.doesNotMatch(upload, /Content-Type/);
  assert.match(upload, /setRecorderState\("idle"\);\n      await reloadFirstPage\(\)/);
});

test('send button has an effective onClick handler', () => {
  has(/const sendVideo = useCallback\(\(\) => \{ if \(previewFile\) void uploadVideo\(previewFile\); \}/);
  has(/onClick=\{sendVideo\}/);
});

test('history loading and sentinel only render in idle', () => {
  has(/recorderState === "idle" && initialLoading/);
  has(/recorderState === "idle" \? <div ref=\{sentinelRef\}/);
  has(/const showEmpty = recorderState === "idle" && !initialLoading && !historyError && comments\.length === 0/);
});

test('history sends username and avatar through the existing author navigation rule', () => {
  has(/comments\.map\(\(comment\) => \{/);
  has(/<MobileVideoComments[^>]+onAuthorClick=\{handleAuthorNavigation\}/);
  assert.equal((page.match(/aria-label=\{`Ver perfil de \$\{comment\.user\.username\}`\}/g) || []).length, 2);
  assert.equal((page.match(/onClick=\{\(\) => onAuthorClick\(comment\.user\.username\)\}/g) || []).length, 4);
  assert.doesNotMatch(page, /<Link href=\{`\/users\/\$\{encodeURIComponent\(comment\.user\.username\)\}`\}/);
});

test('video author navigation preserves the own-profile rule from movie comments', () => {
  has(/if \(authenticatedUsername && username === authenticatedUsername\) \{\s+router\.push\("\/profile-feed"\)/);
  has(/router\.push\(`\/users\/\$\{encodeURIComponent\(username\)\}`\)/);
});

test('history separates a truncatable username from a non-shrinking date', () => {
  assert.equal((page.match(/flex min-w-0 flex-1 items-baseline gap-3/g) || []).length, 2);
  assert.equal((page.match(/min-w-0 truncate text-left text-sm font-bold/g) || []).length, 2);
  has(/<time className="shrink-0 text-xs text-zinc-500">\{new Date\(comment\.created_at\)\.toLocaleDateString\(\)\}<\/time>/);
  has(/<time className="shrink-0 text-xs text-zinc-300">\{new Date\(comment\.created_at\)\.toLocaleDateString\(\)\}<\/time>/);
  has(/src=\{comment\.video_url\} preload="metadata" playsInline/);
  assert.doesNotMatch(page, /comments\.sort\(/);
});

test('delete action is rendered exclusively from backend can_delete', () => {
  has(/comment\.can_delete === true \? <button/);
});

test('history autoplay uses visibility rather than scroll direction and maintains one active video', () => {
  has(/VIDEO_COMMENT_VISIBILITY_THRESHOLD = 0\.35/);
  has(/VIDEO_COMMENT_VISIBILITY_HYSTERESIS = 0\.08/);
  has(/threshold: VIDEO_COMMENT_VISIBILITY_THRESHOLDS/);
  has(/pauseOtherHistoryVideos\(id\)/);
  has(/entry\.intersectionRatio < VIDEO_COMMENT_VISIBILITY_THRESHOLD/);
  has(/selectDominantVideo\(playableRatios, activeVideoIdRef\.current/);
  assert.doesNotMatch(page, /deltaY|scrollDirection/);
  has(/video\.pause\(\);\s+video\.currentTime = 0/);
});

test('session sound preference starts muted, persists manual changes and falls back to muted playback', () => {
  has(/useState<VideoSoundPreference>\("muted"\)/);
  has(/VIDEO_COMMENT_SOUND_SESSION_KEY = "qnext-video-sound"/);
  has(/sessionStorage\.setItem\(VIDEO_COMMENT_SOUND_SESSION_KEY, preference === "sound-on" \? "on" : "off"\)/);
  has(/video\.muted = soundPreferenceRef\.current !== "sound-on"/);
  has(/if \(!video\.muted && !manual\)/);
  has(/video\.muted = true;\s+try \{ await video\.play\(\)/);
  const playback = page.slice(page.indexOf('const playHistoryVideo'), page.indexOf('const chooseVisibleHistoryVideo'));
  assert.doesNotMatch(playback, /soundPreferenceRef\.current = "muted"/);
});

test('manual pause is sticky until exit and re-entry, while restart seeks without forcing play', () => {
  has(/pausedByUserRef\.current\.add\(id\)/);
  has(/pausedByUserRef\.current\.delete\(id\)/);
  has(/pausedByUserRef\.current\.has\(id\)/);
  has(/video\.currentTime = 0/);
  const restart = page.slice(page.indexOf('const restartHistoryVideo'), page.indexOf('const playExpandedVideo'));
  assert.doesNotMatch(restart, /\.play\(/);
});

test('history uses custom controls and disables download, rate and picture-in-picture', () => {
  const history = page.slice(page.indexOf('comments.map((comment)'), page.indexOf('loadingMore ?'));
  assert.doesNotMatch(history, /\scontrols(?:\s|=)/);
  assert.match(history, /controlsList="nodownload noplaybackrate"/);
  assert.match(history, /disablePictureInPicture disableRemotePlayback/);
  assert.match(page, /video\.disablePictureInPicture = true/);
  for (const key of ['movieDetailVideoPlay', 'movieDetailVideoPause', 'movieDetailVideoSoundOn', 'movieDetailVideoMute', 'movieDetailVideoRestart']) assert.match(history, new RegExp(key));
  assert.doesNotMatch(history, />Download<|requestPictureInPicture/i);
});

test('infinite-scroll videos are observed and active deletion clears playback references', () => {
  has(/\[comments, recorderState, syncPlayerState\]/);
  has(/historyObserverRef\.current\?\.observe\(video\)/);
  has(/historyObserverRef\.current\?\.unobserve\(video\)/);
  has(/if \(activeVideoIdRef\.current === key\) activeVideoIdRef\.current = null/);
});

test('infinite scroll uses main viewport observer and avoids duplicate loads', () => {
  has(/new IntersectionObserver/);
  has(/root: null/);
  has(/loadingMore \|\| !next/);
  has(/dedupeVideoComments/);
});

test('visibilitychange pauses all players without clearing selected files', () => {
  has(/document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
  has(/document\.visibilityState !== "visible"/);
  has(/historyVideos\.forEach\(\(video\) => video\.pause\(\)\)/);
  has(/expandedVideos\.forEach\(\(video\) => video\.pause\(\)\)/);
  has(/window\.requestAnimationFrame\(chooseVisibleHistoryVideo\)/);
  has(/window\.addEventListener\("pagehide", handlePageHide\)/);
  has(/historyVideos\.clear\(\)/);
});

test('expanded feed opens on the selected video and provides bidirectional scroll snap', () => {
  has(/setExpandedVideoId\(id\)/);
  has(/data-expanded-video-card=\{id\}/);
  has(/scrollIntoView\(\{ block: "start" \}\)/);
  has(/h-\[100dvh\] snap-y snap-mandatory overflow-y-auto/);
  has(/h-\[100dvh\] snap-start snap-always/);
  has(/scrollSnapStop: "always"/);
  has(/EXPANDED_VIDEO_VISIBILITY_THRESHOLD = 0\.7/);
  assert.doesNotMatch(page, /requestFullscreen/);
});

test('expanded feed shares sound, resets switched videos and has custom controls', () => {
  const expanded = page.slice(page.indexOf('expandedVideoId !== null ?'), page.indexOf('</section>;'));
  assert.match(expanded, /movieDetailVideoExpand|movieDetailVideoCloseExpanded/);
  assert.match(expanded, /soundPreferenceRef\.current/);
  assert.match(expanded, /VIDEO_COMMENT_SOUND_SESSION_KEY/);
  assert.match(page, /item\.pause\(\);\s+item\.currentTime = 0/);
  assert.match(expanded, /controlsList="nodownload noplaybackrate nofullscreen" disablePictureInPicture disableRemotePlayback/);
  assert.doesNotMatch(expanded, /\scontrols(?:\s|=)|requestPictureInPicture|playbackRate/);
});

test('expanded feed locks body, respects safe areas, closes and returns to its history card', () => {
  has(/document\.body\.style\.overflow = "hidden"/);
  has(/document\.body\.style\.overflow = expandedBodyOverflowRef\.current \?\? ""/);
  has(/env\(safe-area-inset-top\)/);
  has(/env\(safe-area-inset-bottom\)/);
  has(/data-video-comment-card=\{id\}/);
  has(/scrollIntoView\(\{ block: "center" \}\)/);
  has(/expandedVideosRef\.current\.forEach\(\(video\) => \{ video\.pause\(\); video\.currentTime = 0; \}\)/);
});

test('expanded feed reuses comments and pagination state', () => {
  has(/\{comments\.map\(\(comment\) => \{/);
  has(/ref=\{expandedSentinelRef\}/);
  has(/fetchPage\(next, "more"\)/);
  has(/expandedObserverRef\.current\?\.unobserve\(video\)/);
});

test('phase-specific errors keep upload error only in upload path', () => {
  has(/movieDetailVideoCameraAccessError/);
  has(/movieDetailVideoRecorderStartError/);
  has(/movieDetailVideoCameraPreviewError/);
  const permissionFlow = page.slice(page.indexOf('const continueToNativePermissions'), page.indexOf('const cancelToIdle'));
  assert.doesNotMatch(permissionFlow, /movieDetailVideoNetworkError/);
});

test('main translations exist in Spanish and English', () => {
  for (const key of ['movieDetailVideoRecordedCreateError','movieDetailVideoReadingSelectedFile','movieDetailVideoCameraAccessError','movieDetailVideoRecorderStartError','movieDetailVideoCameraPreviewError']) {
    assert.equal((i18n.match(new RegExp(`${key}:`, 'g')) || []).length, 2, `${key} should be translated twice`);
  }
});

test('video reaction is first and active by default while directed deep links select text comments', () => {
  has(/useState<CommentInputMode>\("video-comment"\)/);
  has(/\(\["video-comment", "text-comment"\] as const\)\.map/);
  has(/get\("section"\) !== "directed-comments"\) return;\s+setCommentInputMode\("text-comment"\)/);
  assert.match(i18n, /movieDetailVideoCommentTitle: "Video reacción"/);
  assert.match(i18n, /movieDetailVideoCommentTitle: "Video Reaction"/);
});

test('local previews preserve metadata aspect ratio within viewport-derived bounds', () => {
  has(/function getLocalPreviewDimensions\(aspectRatio/);
  has(/viewportWidth \* \(selected \? 0\.82 : 0\.78\)/);
  has(/viewportHeight \* \(selected \? 0\.38 : 0\.42\)/);
  has(/setPreviewAspectRatio\(video\.videoWidth \/ video\.videoHeight\)/);
  has(/object-contain/);
});

test('front-camera recording mirrors pixels into the final stream and retains audio', () => {
  has(/facingMode: "user"/);
  has(/isFrontCamera = initialSettings\.facingMode !== "environment"/);
  has(/context\.setTransform\(isFrontCamera \? -1 : 1, 0, 0, 1, isFrontCamera \? canvas\.width : 0, 0\)/);
  has(/canvas\.captureStream\(30\)/);
  has(/new MediaStream\(\[\.\.\.canvasStream\.getVideoTracks\(\), \.\.\.stream\.getAudioTracks\(\)\]\)/);
  has(/createRecorderWithFallback\(recordingStream, iosWebKit\)/);
  has(/<canvas ref=\{mirrorCanvasRef\} className=\{isPortraitRecording \?/);
});

test('recording preview is larger without changing selected-file preview limits', () => {
  has(/function getRecordingPreviewDimensions\(viewportWidth/);
  has(/viewportWidth \* 0\.92/);
  has(/viewportHeight \* 0\.55/);
  has(/isRecordingOverlay\s+\? getRecordingPreviewDimensions/);
  has(/: getLocalPreviewDimensions\(previewAspectRatio, recorderState === "previewSelected"/);
});

test('published history videos use metadata proportions and a centered reduced base size', () => {
  has(/aspectRatio: historyAspectRatios\[id\] \?\? 1, width: "88%"/);
  has(/setHistoryAspectRatios\(\(ratios\) => \(\{ \.\.\.ratios, \[id\]: video\.videoWidth \/ video\.videoHeight \}\)\)/);
  has(/className="h-full w-full object-contain" onLoadedMetadata/);
});

test('new camera recordings request and encode a real 16:9 canvas stream', () => {
  has(/VIDEO_REACTION_ASPECT_RATIO = 16 \/ 9/);
  has(/VIDEO_REACTION_OUTPUT_WIDTH = 1280/);
  has(/VIDEO_REACTION_OUTPUT_HEIGHT = 720/);
  has(/aspectRatio: \{ ideal: VIDEO_REACTION_ASPECT_RATIO \}/);
  has(/canvas\.width = VIDEO_REACTION_OUTPUT_WIDTH/);
  has(/canvas\.height = VIDEO_REACTION_OUTPUT_HEIGHT/);
  has(/getVideoFrameComposition\(sourceWidth, sourceHeight, canvas\.width, canvas\.height\)/);
});

test('each camera frame is composed once from current dimensions on a clean fixed canvas', () => {
  has(/const sourceWidth = preview\.videoWidth/);
  has(/const sourceHeight = preview\.videoHeight/);
  has(/context\.setTransform\(1, 0, 0, 1, 0, 0\)/);
  has(/context\.clearRect\(0, 0, canvas\.width, canvas\.height\)/);
  has(/context\.save\(\)/);
  has(/context\.restore\(\)/);
  has(/if \(mirrorFrameRef\.current !== null\) cancelAnimationFrame\(mirrorFrameRef\.current\)/);
  assert.equal((page.match(/canvas\.captureStream\(30\)/g) || []).length, 1);
  assert.equal((page.match(/requestAnimationFrame\(drawVideoReactionFrame\)/g) || []).length, 1);
});

test('portrait recording uses a black canvas and skips the blurred background layer', () => {
  has(/context\.fillStyle = "#000"/);
  has(/context\.fillRect\(0, 0, canvas\.width, canvas\.height\)/);
  has(/if \(sourceWidth >= sourceHeight\) \{\s+context\.filter = "blur\(24px\) brightness\(0\.58\)"/);
  has(/foregroundDestination\.x, foregroundDestination\.y, foregroundDestination\.width, foregroundDestination\.height/);
});

test('known local portrait recording expands as its source ratio without native fullscreen', () => {
  has(/recordedSourceAspectRatio < 1 && recordedPortraitExpandedWidth !== null/);
  has(/aspectRatio: recordedSourceAspectRatio/);
  has(/absolute left-1\/2 h-full w-auto max-w-none -translate-x-1\/2 object-contain/);
  has(/data-local-preview-player="true"/);
});

test('portrait recording preview uses available height while horizontal keeps its existing sizing', () => {
  has(/getPortraitViewportDimensions\(recordedSourceAspectRatio, viewportSize\.width, viewportSize\.height, 250\)/);
  has(/isPortraitRecording \? recordedSourceAspectRatio : previewAspectRatio/);
  has(/isPortraitRecording \? "calc\(100svh - 250px\)"/);
  has(/isPortraitRecording \? "absolute left-1\/2 h-full w-auto max-w-none -translate-x-1\/2"/);
  has(/: isRecordingOverlay\s+\? getRecordingPreviewDimensions/);
});

test('known published portrait videos use source-ratio sizing in history and expanded feed', () => {
  has(/qnext-video-source-ratios:/);
  has(/heightReserve = 0/);
  has(/getHistoryPortraitDimensions\(sourceAspectRatio, viewportSize\.width, viewportSize\.height, stickyHeaderHeight\)/);
  has(/viewportHeight - stickyHeaderHeight - 140/);
  has(/viewportWidth \* 0\.82/);
  has(/expandedPortraitDimensions\.width/);
  has(/data-expanded-video-player="true"/);
  has(/snap-y snap-mandatory/);
});

test('route teardown releases media pipelines while BFCache pagehide only pauses', () => {
  has(/releaseVideoReactionPipeline/);
  has(/video\.removeAttribute\("src"\)/);
  has(/video\.srcObject = null/);
  has(/video\.load\(\)/);
  has(/if \(!event\.persisted\) releaseAllVideoReactionPipelines\(\)/);
  has(/releaseAllVideoReactionPipelines\(\);\s+historyObserverRef\.current\?\.disconnect/);
  assert.doesNotMatch(page, /navigator\.mediaSession/);
});

test('front camera minimum zoom is optional and capability-gated', () => {
  has(/getCapabilities\?\.\(\)/);
  has(/currentZoom === undefined \|\| zoom\.min >= currentZoom/);
  has(/applyConstraints\(\{ advanced: \[\{ zoom: zoom\.min \}/);
  has(/Zoom is an optional enhancement/);
  has(/CAMERA_CONFIGURATION/);
});

test('preview sizing does not react to browser chrome changes while scrolling', () => {
  assert.doesNotMatch(page, /window\.addEventListener\("resize"/);
  has(/matchMedia\("\(orientation: landscape\)"\)/);
  assert.doesNotMatch(page, /visualViewport|IntersectionObserverEntry.*getHistoryPortraitDimensions/);
});

test('published portrait sizing tracks the real sticky header without changing expanded sizing', () => {
  has(/setStickyHeaderHeight\(header\.offsetHeight\)/);
  has(/new ResizeObserver\(updateStickyHeaderHeight\)/);
  has(/stickyHeaderHeight=\{stickyHeaderHeight\}/);
  has(/getPortraitViewportDimensions\(sourceAspectRatio, viewportSize\.width, viewportSize\.height, 24\)/);
});

test('selected preview expands in an app modal instead of native fullscreen', () => {
  has(/localPreviewExpanded && previewUrl/);
  has(/fixed inset-0 z-\[110\] flex items-center justify-center bg-black/);
  has(/max-h-\[100svh\] w-full object-contain/);
  has(/addEventListener\("webkitbeginfullscreen", preventNativeFullscreen\)/);
  assert.doesNotMatch(page, /requestFullscreen|webkitEnterFullscreen|webkitRequestFullscreen/);
});

test('coarse phone landscape keeps mobile reaction UI without changing tab state', () => {
  has(/pointer: coarse\) and \(hover: none\)/);
  has(/max-height: 700px/);
  has(/forceMobileLayout=\{forceMobileLayout\}/);
  has(/useState<CommentInputMode>\("video-comment"\)/);
  has(/\(\["video-comment", "text-comment"\] as const\)\.map/);
});

test('expanded feed stays in the app portrait modal and suppresses native video fullscreen', () => {
  has(/function keepExpandedVideoInline/);
  has(/setAttribute\("webkit-playsinline", "true"\)/);
  has(/document\.fullscreenElement === inlineVideo/);
  has(/inlineVideo\.webkitDisplayingFullscreen/);
  has(/controlsList="nodownload noplaybackrate nofullscreen"/);
  has(/h-\[100dvh\] snap-y snap-mandatory overflow-y-auto/);
  assert.doesNotMatch(page, /orientation\.(?:lock|unlock)\(/);
});
