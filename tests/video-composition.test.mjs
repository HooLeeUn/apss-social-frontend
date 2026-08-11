import assert from 'node:assert/strict';
import test from 'node:test';
import { getCoverSourceRect, getVideoFrameComposition, selectDominantVideo } from '../lib/video-composition.mjs';

test('portrait source fills the portrait recording canvas', () => {
  const composition = getVideoFrameComposition(720, 1280, 720, 1280);
  assert.equal(composition.backgroundMode, 'black');
  assert.deepEqual(composition.foregroundDestination, { x: 0, y: 0, width: 720, height: 1280 });
});

test('portrait background covers the 16:9 canvas with a centered crop', () => {
  const rect = getCoverSourceRect(720, 1280, 1280, 720);
  assert.deepEqual(rect, { x: 0, y: 437.5, width: 720, height: 405 });
});

test('landscape source is contained without distortion in a portrait canvas', () => {
  const composition = getVideoFrameComposition(1920, 1080, 720, 1280);
  assert.deepEqual(composition.backgroundSource, { x: 656.25, y: 0, width: 607.5, height: 1080 });
  assert.deepEqual(composition.foregroundDestination, { x: 0, y: 437.5, width: 720, height: 405 });
  assert.equal(composition.backgroundMode, 'black');
});

test('dominant selector switches from 30 percent to 70 percent visibility', () => {
  assert.equal(selectDominantVideo(new Map([['a', 0.3], ['b', 0.7]]), 'a', 0.35, 0.08), 'b');
});

test('dominant selector keeps the active video inside the hysteresis margin', () => {
  assert.equal(selectDominantVideo(new Map([['a', 0.5], ['b', 0.56]]), 'a', 0.35, 0.08), 'a');
  assert.equal(selectDominantVideo(new Map([['a', 0.5], ['b', 0.6]]), 'a', 0.35, 0.08), 'b');
});

test('square source remains square and centered in the portrait canvas', () => {
  const composition = getVideoFrameComposition(1000, 1000, 720, 1280);
  assert.deepEqual(composition.backgroundSource, { x: 218.75, y: 0, width: 562.5, height: 1000 });
  assert.deepEqual(composition.foregroundDestination, { x: 0, y: 280, width: 720, height: 720 });
});
