import assert from "node:assert/strict";
import test from "node:test";

const {
  calculateNotificationVideoScrollTop,
  findNotificationVideoTargetOverFrames,
  NOTIFICATION_VIDEO_TARGET_MAX_FRAMES,
} = await import(new URL("../lib/notification-video-positioning.ts", import.meta.url));

test("a notification card may mount several frames after navigation", () => {
  const frames = [];
  const target = { id: "video-42" };
  let lookups = 0;
  let found = null;
  let exhausted = false;

  findNotificationVideoTargetOverFrames({
    findTarget: () => (++lookups === 5 ? target : null),
    requestFrame: (callback) => (frames.push(callback), frames.length),
    onFound: (value) => { found = value; },
    onExhausted: () => { exhausted = true; },
  });
  while (frames.length) frames.shift()(0);

  assert.equal(lookups, 5);
  assert.equal(found, target);
  assert.equal(exhausted, false);
});

test("target lookup is bounded and its cleanup cancels later work", () => {
  const frames = [];
  let lookups = 0;
  let exhausted = 0;
  const cleanup = findNotificationVideoTargetOverFrames({
    findTarget: () => (++lookups, null),
    requestFrame: (callback) => (frames.push(callback), frames.length),
    onFound: () => assert.fail("target should not be found"),
    onExhausted: () => { exhausted += 1; },
    maxFrames: 3,
  });
  while (frames.length) frames.shift()(0);
  assert.equal(lookups, 4);
  assert.equal(exhausted, 1);

  const queued = [];
  let cancelledLookups = 0;
  const cancel = findNotificationVideoTargetOverFrames({
    findTarget: () => (++cancelledLookups, null),
    requestFrame: (callback) => (queued.push(callback), queued.length),
    onFound: () => assert.fail("cancelled lookup should not find"),
    onExhausted: () => assert.fail("cancelled lookup should not exhaust"),
  });
  cancel();
  queued.shift()(0);
  assert.equal(cancelledLookups, 1);
  assert.equal(NOTIFICATION_VIDEO_TARGET_MAX_FRAMES, 24);
});

test("card geometry aligns below sticky content and clamps to the scroll range", () => {
  assert.equal(calculateNotificationVideoScrollTop({
    containerTop: 300,
    containerScrollTop: 0,
    containerScrollHeight: 2400,
    containerClientHeight: 500,
    cardTop: 1300,
    stickyBottom: 320,
  }), 972);
  assert.equal(calculateNotificationVideoScrollTop({
    containerTop: 300,
    containerScrollTop: 1800,
    containerScrollHeight: 2400,
    containerClientHeight: 500,
    cardTop: 700,
    stickyBottom: 320,
  }), 1900);
});
