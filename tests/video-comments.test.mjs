import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const page = readFileSync(new URL('../app/movies/[id]/page.tsx', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../lib/i18n.ts', import.meta.url), 'utf8');

test('recording state machine includes required mobile states', () => {
  for (const state of ['idle', 'menu', 'requestingPermission', 'recording', 'preview', 'uploading', 'error']) {
    assert.match(page, new RegExp(`"${state}"`));
  }
});

test('automatic stop uses the 20 second limit and shared stop flow', () => {
  assert.match(page, /VIDEO_COMMENT_MAX_SECONDS = 20/);
  assert.match(page, /n >= VIDEO_COMMENT_MAX_SECONDS\) window\.setTimeout\(finishRecording, 0\)/);
});

test('camera and microphone tracks are cleaned up', () => {
  assert.match(page, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(page, /resetRecorder\(true\)/);
});

test('mime selection checks candidates in backend-compatible order', () => {
  assert.match(page, /const VIDEO_COMMENT_MIME_CANDIDATES = \["video\/webm;codecs=vp9,opus", "video\/webm;codecs=vp8,opus", "video\/webm", "video\/mp4"\]/);
  assert.match(page, /MediaRecorder\.isTypeSupported/);
});

test('file validation enforces video type, duration, and size', () => {
  assert.match(page, /accept="video\/\*"/);
  assert.match(page, /VIDEO_COMMENT_MAX_BYTES = 50 \* 1024 \* 1024/);
  assert.match(page, /file\.type\.startsWith\("video\/"\)/);
  assert.match(page, /probe\.duration > VIDEO_COMMENT_MAX_SECONDS/);
});

test('pagination deduplicates and uses intersection observer', () => {
  assert.match(page, /function dedupeVideoComments/);
  assert.match(page, /new IntersectionObserver/);
  assert.match(page, /normalizeVideoCommentsNext/);
});

test('deletion calls the video comment detail endpoint', () => {
  assert.match(page, /apiFetch\(`\/video-comments\/\$\{encodeURIComponent\(key\)\}\//);
  assert.match(page, /method: "DELETE"/);
});

test('main translations exist in Spanish and English', () => {
  for (const key of ['movieDetailVideoRecord', 'movieDetailVideoUpload', 'movieDetailVideoTooLong', 'movieDetailVideoEmpty', 'movieDetailVideoDeleteConfirm']) {
    assert.equal((i18n.match(new RegExp(`${key}:`, 'g')) || []).length, 2, `${key} should be translated twice`);
  }
});
