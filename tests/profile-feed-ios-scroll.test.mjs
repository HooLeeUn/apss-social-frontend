import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const activityColumn = readFileSync(new URL('../components/profile-feed/MyActivityColumn.tsx', import.meta.url), 'utf8');

test('activity boundary handoff is isolated to iOS and iPadOS', () => {
  assert.match(activityColumn, /\/iPad\|iPhone\|iPod\/\.test\(navigator\.userAgent\)/);
  assert.match(activityColumn, /navigator\.platform === "MacIntel" && navigator\.maxTouchPoints > 1/);
});

test('activity and ratings hand off either direction at an iOS edge to the explicit page scroller', () => {
  assert.match(activityColumn, /const direction: VerticalDirection = scrollDelta > 0 \? 1 : -1/);
  assert.match(activityColumn, /isIOSWebKitEnvironment\(\) && isAtEdge/);
  assert.match(activityColumn, /scroller\.ownerDocument\.scrollingElement/);
  assert.doesNotMatch(activityColumn, /window\.scrollBy/);
});

test('repeated same-direction mobile swipes arm a localized near-edge handoff', () => {
  assert.match(activityColumn, /SWIPE_INTENT_REQUIRED_GESTURES = 3/);
  assert.match(activityColumn, /previous\.direction === gesture\.direction \? previous\.count \+ 1 : 1/);
  assert.match(activityColumn, /distanceToEdge <= SWIPE_INTENT_EDGE_DISTANCE_PX/);
  assert.match(activityColumn, /rapidExitIsArmed \|\| \(isIOSWebKitEnvironment\(\) && isAtEdge\)/);
});

test('private inbox retains native chaining and touch start preserves long press', () => {
  assert.match(activityColumn, /effectiveActiveTab === "messages"\) return/);
  const touchStartHandler = activityColumn.slice(
    activityColumn.indexOf('const handleActivityTouchStart'),
    activityColumn.indexOf('const handleActivityTouchMove'),
  );
  assert.doesNotMatch(touchStartHandler, /preventDefault/);
  assert.match(touchStartHandler, /max-width: 1279px/);
  assert.match(activityColumn, /if \(event\.cancelable\) event\.preventDefault\(\)/);
});
