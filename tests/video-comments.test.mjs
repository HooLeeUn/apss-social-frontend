import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const page = readFileSync(new URL('../app/movies/[id]/page.tsx', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../lib/i18n.ts', import.meta.url), 'utf8');

const has = (pattern) => assert.match(page, pattern);

test('state machine includes the final explicit mobile states', () => {
  for (const state of ['idle', 'menu', 'permissionInfo', 'requestingPermission', 'recording', 'previewRecorded', 'previewSelected', 'uploading', 'error']) {
    has(new RegExp(`"${state}"`));
  }
});

test('recording renders Cancelar and Detener controls', () => {
  has(/recorderState === "recording" \? <div className="relative z-20 flex gap-3/);
  has(/onClick=\{cancelToMenu\}>\{t\("movieDetailVideoCancel"\)\}/);
  has(/onClick=\{finishRecording\}>\{t\("movieDetailVideoStop"\)\}/);
});

test('cancel during recording returns to menu and stops tracks', () => {
  has(/const cancelToMenu = useCallback\(\(\) => \{ cleanupRecorder\(\{ clearPreview: true, nextState: "menu" \}\); setError\(""\); setRecorderState\("menu"\); \}/);
  has(/getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
});

test('stop and automatic 20 second limit use previewRecorded, not cancel', () => {
  has(/stopModeRef\.current = "previewRecorded";\n    clearTimer\(\);/);
  has(/if \(nextSecond >= VIDEO_COMMENT_MAX_SECONDS\) window\.setTimeout\(finishRecording, 0\)/);
  has(/setRecorderState\("previewRecorded"\)/);
});

test('onstop builds a Blob and File before changing to previewRecorded', () => {
  has(/const blob = new Blob\(chunks, \{ type: recorder\.mimeType \|\| currentMimeTypeRef\.current \|\| mimeType \}\)/);
  has(/const file = createVideoCommentFile\(blob, mimeType\)/);
  assert.ok(page.indexOf('const file = createVideoCommentFile(blob, mimeType)') < page.indexOf('setRecorderState("previewRecorded")'));
});

test('previewRecorded shows Retake and Send, and retake reopens permission flow', () => {
  has(/recorderState === "previewRecorded" \? t\("movieDetailVideoRetake"\)/);
  has(/onClick=\{sendVideo\}>\{recorderState === "uploading" \? t\("movieDetailVideoUploading"\) : t\("movieDetailVideoSend"\)\}/);
  has(/const retake = useCallback\(\(\) => \{ revokePreview\(\); setError\(""\); setRecorderState\("permissionInfo"\); \}/);
});

test('file input preserves files[0] before clearing value', () => {
  const selectedIndex = page.indexOf('const selectedFile = event.currentTarget.files?.[0]');
  const clearIndex = page.indexOf('event.currentTarget.value = ""', selectedIndex);
  assert.ok(selectedIndex > -1 && clearIndex > selectedIndex);
});

test('valid file changes to previewSelected and selected preview shows Cancelar and Enviar', () => {
  has(/setPreviewFile\(file\);\n      setPreviewUrl\(url\);\n      setPreviewDuration\(probe\.duration\);\n      setRecorderState\("previewSelected"\)/);
  has(/recorderState === "previewRecorded" \|\| recorderState === "previewSelected" \|\| recorderState === "uploading"/);
  has(/recorderState === "previewRecorded" \? retake : cancelToMenu/);
});

test('invalid selected files show visible errors for duration, size, and read failure', () => {
  has(/file\.size > VIDEO_COMMENT_MAX_BYTES/);
  has(/t\("movieDetailVideoFileTooLarge50Mb"\)/);
  has(/probe\.duration > VIDEO_COMMENT_MAX_SECONDS/);
  has(/t\("movieDetailVideoLongerThan20Seconds"\)/);
  has(/t\("movieDetailVideoSelectedReadError"\)/);
});

test('send uses FormData video field and HTTP 201 success path reloads history', () => {
  has(/const data = new FormData\(\)/);
  has(/data\.append\("video", previewFile, previewFile\.name\)/);
  has(/apiFetch\(`\/movies\/\$\{encodeURIComponent\(movieId\)\}\/video-comments\/`, \{ method: "POST", body: data \}\)/);
  has(/setRecorderState\("idle"\);\n      await reloadFirstPage\(\)/);
});

test('empty state only appears when there are no results, no initial loading, and no error', () => {
  has(/const showEmpty = !initialLoading && !historyError && comments\.length === 0/);
});

test('tab change and unmount stop tracks and revoke object urls', () => {
  has(/else \{ cleanupRecorder\(\{ clearPreview: true, nextState: "idle" \}\); setRecorderState\("idle"\); setError\(""\); \}/);
  has(/return \(\) => \{ requestSeqRef\.current \+= 1; cleanupRecorder\(\{ clearPreview: true, nextState: "idle" \}\); \}/);
  has(/if \(previewUrl\) URL\.revokeObjectURL\(previewUrl\)/);
});

test('permission modal appears before getUserMedia and native prompt only follows Continue', () => {
  has(/onClick=\{\(\) => setRecorderState\("permissionInfo"\)\}/);
  const handlerStart = page.indexOf('const continueToNativePermissions = useCallback');
  const handlerEnd = page.indexOf('const cancelToMenu = useCallback', handlerStart);
  const handler = page.slice(handlerStart, handlerEnd);
  assert.match(handler, /setRecorderState\("requestingPermission"\)/);
  assert.match(handler, /const stream = await navigator\.mediaDevices\.getUserMedia/);
  has(/onClick=\{continueToNativePermissions\}>\{t\("movieDetailVideoContinue"\)\}/);
  has(/const stream = await navigator\.mediaDevices\.getUserMedia/);
});

test('camera preview assigns srcObject and calls play()', () => {
  has(/preview\.srcObject = stream/);
  has(/await preview\.play\(\)\.catch/);
  has(/preview\.onloadedmetadata = \(\) => resolve\(\)/);
});

test('pagination deduplicates and uses intersection observer', () => {
  has(/function dedupeVideoComments/);
  has(/new IntersectionObserver/);
  has(/normalizeVideoCommentsNext/);
});

test('deletion calls endpoint without native alert confirmation', () => {
  has(/apiFetch\(`\/video-comments\/\$\{encodeURIComponent\(key\)\}\//);
  has(/method: "DELETE"/);
  assert.doesNotMatch(page, /window\.confirm/);
});

test('main translations exist in Spanish and English', () => {
  for (const key of ['movieDetailVideoRecord', 'movieDetailVideoUpload', 'movieDetailVideoPermissionInfo', 'movieDetailVideoContinue', 'movieDetailVideoLongerThan20Seconds', 'movieDetailVideoFileTooLarge50Mb', 'movieDetailVideoSelectedReadError']) {
    assert.equal((i18n.match(new RegExp(`${key}:`, 'g')) || []).length, 2, `${key} should be translated twice`);
  }
});
