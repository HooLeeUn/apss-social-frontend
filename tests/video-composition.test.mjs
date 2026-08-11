import assert from 'node:assert/strict';
import test from 'node:test';
import { getCoverSourceRect, getOrientationAtTime, getVideoFrameComposition, normalizeOrientationTimeline, selectDominantVideo } from '../lib/video-composition.mjs';

test('portrait source is fully contained and centered in a 16:9 canvas', () => {
  const composition = getVideoFrameComposition(720, 1280, 1280, 720);
  assert.equal(composition.backgroundMode, 'black');
  assert.deepEqual(composition.foregroundDestination, { x: 437.5, y: 0, width: 405, height: 720 });
});

test('portrait background covers the 16:9 canvas with a centered crop', () => {
  const rect = getCoverSourceRect(720, 1280, 1280, 720);
  assert.deepEqual(rect, { x: 0, y: 437.5, width: 720, height: 405 });
});

test('landscape 16:9 source uses a black base and needs neither crop nor letterboxing', () => {
  const composition = getVideoFrameComposition(1920, 1080, 1280, 720);
  assert.deepEqual(composition.backgroundSource, { x: 0, y: 0, width: 1920, height: 1080 });
  assert.deepEqual(composition.foregroundDestination, { x: 0, y: 0, width: 1280, height: 720 });
  assert.equal(composition.backgroundMode, 'black');
});

test('dominant selector switches from 30 percent to 70 percent visibility', () => {
  assert.equal(selectDominantVideo(new Map([['a', 0.3], ['b', 0.7]]), 'a', 0.35, 0.08), 'b');
});

test('dominant selector keeps the active video inside the hysteresis margin', () => {
  assert.equal(selectDominantVideo(new Map([['a', 0.5], ['b', 0.56]]), 'a', 0.35, 0.08), 'a');
  assert.equal(selectDominantVideo(new Map([['a', 0.5], ['b', 0.6]]), 'a', 0.35, 0.08), 'b');
});

test('square source uses centered background crop and full-height foreground', () => {
  const composition = getVideoFrameComposition(1000, 1000, 1280, 720);
  assert.deepEqual(composition.backgroundSource, { x: 0, y: 218.75, width: 1000, height: 562.5 });
  assert.deepEqual(composition.foregroundDestination, { x: 280, y: 0, width: 720, height: 720 });
});

test('orientation timeline resolves pure and mixed recordings at exact boundaries', () => {
  const portrait = [{ start: 0, end: 5, orientation: 'portrait' }];
  const landscape = [{ start: 0, end: 5, orientation: 'landscape' }];
  const mixed = [
    { start: 0, end: 4.8, orientation: 'portrait' },
    { start: 4.8, end: 12.1, orientation: 'landscape' },
  ];
  assert.equal(getOrientationAtTime(portrait, 2), 'portrait');
  assert.equal(getOrientationAtTime(landscape, 2), 'landscape');
  assert.equal(getOrientationAtTime(mixed, 4.799), 'portrait');
  assert.equal(getOrientationAtTime(mixed, 4.8), 'landscape');
  assert.equal(getOrientationAtTime(mixed, 12.1), 'landscape');
});

test('invalid or absent orientation timelines safely fall back to null', () => {
  assert.deepEqual(normalizeOrientationTimeline(null), []);
  assert.deepEqual(normalizeOrientationTimeline([{ start: 2, end: 1, orientation: 'portrait' }]), []);
  assert.equal(getOrientationAtTime([], 1), null);
  assert.equal(getOrientationAtTime([{ start: 0, end: 1, orientation: 'sideways' }], 0.5), null);
});
