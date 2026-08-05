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
  has(/recorder\.ondataavailable = \(event\) => \{\s+if \(event\.data\.size\) chunksRef\.current\.push\(event\.data\)/);
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
  assert.deepEqual(sessionWrites, ['VIDEO_COMMENT_PERMISSION_SESSION_KEY, "1"']);
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
  has(/onLoadedMetadata=\{\(event\) => handlePreviewMediaEvent\("duration"/);
  has(/onDurationChange=\{\(event\) => handlePreviewMediaEvent\("duration"/);
  has(/onLoadedData=\{\(event\) => handlePreviewMediaEvent\("playable"/);
  has(/onCanPlay=\{\(event\) => handlePreviewMediaEvent\("playable"/);
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

test('temporary video diagnostics and query-controlled panel are fully removed', () => {
  for (const removed of ['videoDebug', 'VIDEO DEBUG ACTIVO', 'DEBUG_PANEL_INITIALIZED', 'MANUAL_DEBUG_TEST', 'appendVideoDebugLog', 'TEMP_VIDEO_', 'SEND_STATE', 'createPortal']) assert.doesNotMatch(page, new RegExp(removed));
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
  has(/comments\.map\(\(comment\) => <article/);
  has(/<Link href=\{`\/users\/\$\{encodeURIComponent\(comment\.user\.username\)\}`\}/);
  has(/<time className="text-xs text-zinc-500">\{new Date\(comment\.created_at\)\.toLocaleDateString\(\)\}<\/time>/);
  has(/src=\{comment\.video_url\} controls preload="metadata" playsInline/);
  assert.doesNotMatch(page, /comments\.sort\(/);
});

test('infinite scroll uses main viewport observer and avoids duplicate loads', () => {
  has(/new IntersectionObserver/);
  has(/root: null/);
  has(/loadingMore \|\| !next/);
  has(/dedupeVideoComments/);
});

test('visibilitychange does not clear selected files', () => {
  assert.doesNotMatch(page, /visibilitychange/);
  assert.doesNotMatch(page, /document\.visibilityState/);
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
