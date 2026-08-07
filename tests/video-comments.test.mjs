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
  has(/src=\{previewUrl\} controls preload="auto" playsInline/);
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
  assert.equal((page.match(/onDurationChange=/g) || []).length, 1);
  assert.equal((page.match(/onLoadedMetadata=/g) || []).length, 1);
  assert.equal((page.match(/onLoadedData=/g) || []).length, 1);
  assert.equal((page.match(/onCanPlay=/g) || []).length, 1);
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

test('history renders video, username profile link, avatar, date, and preserves backend order', () => {
  has(/comments\.map\(\(comment\) => \{/);
  has(/<Link href=\{`\/users\/\$\{encodeURIComponent\(comment\.user\.username\)\}`\}/);
  has(/<time className="text-xs text-zinc-500">\{new Date\(comment\.created_at\)\.toLocaleDateString\(\)\}<\/time>/);
  has(/src=\{comment\.video_url\} preload="metadata" playsInline/);
  assert.doesNotMatch(page, /comments\.sort\(/);
});

test('delete action is rendered exclusively from backend can_delete', () => {
  has(/comment\.can_delete === true \? <button/);
});

test('history autoplay uses visibility rather than scroll direction and maintains one active video', () => {
  has(/VIDEO_COMMENT_VISIBILITY_THRESHOLD = 0\.55/);
  has(/threshold: \[0, VIDEO_COMMENT_VISIBILITY_THRESHOLD, 1\]/);
  has(/pauseOtherHistoryVideos\(id\)/);
  has(/entry\.intersectionRatio < VIDEO_COMMENT_VISIBILITY_THRESHOLD/);
  has(/const viewportCenter = window\.innerHeight \/ 2/);
  has(/ratio > bestRatio/);
  has(/distance < bestDistance/);
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
  has(/document\.addEventListener\("visibilitychange", pauseAllWhenHidden\)/);
  has(/if \(!document\.hidden\) return/);
  has(/historyVideosRef\.current\.forEach\(\(video\) => video\.pause\(\)\)/);
  has(/expandedVideosRef\.current\.forEach\(\(video\) => video\.pause\(\)\)/);
  assert.doesNotMatch(page, /document\.visibilityState/);
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
  assert.match(expanded, /controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback/);
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
