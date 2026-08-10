import assert from 'node:assert/strict';
import test from 'node:test';
import { getContainDestinationRect, getCoverSourceRect, getVideoFrameComposition } from '../lib/video-composition.mjs';

test('portrait source is fully contained and centered in a 16:9 canvas', () => {
  const rect = getContainDestinationRect(720, 1280, 1280, 720);
  assert.deepEqual(rect, { x: 437.5, y: 0, width: 405, height: 720 });
});

test('portrait background covers the 16:9 canvas with a centered crop', () => {
  const rect = getCoverSourceRect(720, 1280, 1280, 720);
  assert.deepEqual(rect, { x: 0, y: 437.5, width: 720, height: 405 });
});

test('landscape 16:9 source needs neither crop nor letterboxing', () => {
  const composition = getVideoFrameComposition(1920, 1080, 1280, 720);
  assert.deepEqual(composition.backgroundSource, { x: 0, y: 0, width: 1920, height: 1080 });
  assert.deepEqual(composition.foregroundDestination, { x: 0, y: 0, width: 1280, height: 720 });
});

test('square source uses centered background crop and full-height foreground', () => {
  const composition = getVideoFrameComposition(1000, 1000, 1280, 720);
  assert.deepEqual(composition.backgroundSource, { x: 0, y: 218.75, width: 1000, height: 562.5 });
  assert.deepEqual(composition.foregroundDestination, { x: 280, y: 0, width: 720, height: 720 });
});
