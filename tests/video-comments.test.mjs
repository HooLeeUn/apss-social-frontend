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
  has(/recorder\.ondataavailable = \(event\) => \{ if \(event\.data\.size\) chunksRef\.current\.push\(event\.data\); \}/);
  has(/recorder\.onstop = \(\) => \{/);
  has(/const chunks = \[\.\.\.chunksRef\.current\]/);
  assert.ok(page.indexOf('const chunks = [...chunksRef.current]') < page.indexOf('const blob = new Blob(chunks'));
  assert.ok(page.indexOf('const blob = new Blob(chunks') < page.indexOf('chunksRef.current = []', page.indexOf('const blob = new Blob(chunks')));
});

test('empty recorded Blob shows a recording-specific error', () => {
  has(/chunks\.length === 0/);
  has(/t\("movieDetailVideoRecordedCreateError"\)/);
});

test('recorded preview uses real metadata duration and valid File for Send', () => {
  has(/readVideoDurationFromUrl\(url\)/);
  has(/setPreviewDuration\(duration\)/);
  has(/disabled=\{recorderState === "uploading" \|\| !previewFile \|\| previewFile\.size <= 0 \|\| previewDuration <= 0/);
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
  has(/setRecorderState\("previewSelected"\)/);
});

test('selected file accepts empty Android MIME when extension is video-like', () => {
  has(/file\.type && !file\.type\.startsWith\("video\/"\) && !hasVideoLikeExtension\(file\.name\)/);
});

test('selected and recorded video durations come from metadata loader', () => {
  has(/function readVideoDurationFromUrl/);
  has(/probe\.onloadedmetadata = read/);
  has(/probe\.onloadeddata = read/);
  has(/probe\.src = url/);
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
