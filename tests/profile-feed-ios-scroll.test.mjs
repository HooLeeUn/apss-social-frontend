import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const activityColumn = readFileSync(new URL('../components/profile-feed/MyActivityColumn.tsx', import.meta.url), 'utf8');

test('activity boundary handoff is isolated to iOS and iPadOS', () => {
  assert.match(activityColumn, /\/iPad\|iPhone\|iPod\/\.test\(navigator\.userAgent\)/);
  assert.match(activityColumn, /navigator\.platform === "MacIntel" && navigator\.maxTouchPoints > 1/);
});

test('activity and ratings hand off only an upward gesture at the lower edge', () => {
  assert.match(activityColumn, /if \(scrollDelta <= 0\) return/);
  assert.match(activityColumn, /scroller\.scrollTop \+ scroller\.clientHeight >= scroller\.scrollHeight - 1/);
  assert.match(activityColumn, /window\.scrollBy\(\{ top: scrollDelta, behavior: "auto" \}\)/);
});

test('private inbox retains native scroll chaining and long press is not cancelled', () => {
  assert.match(activityColumn, /effectiveActiveTab === "messages"\) return/);
  const touchStartHandler = activityColumn.slice(
    activityColumn.indexOf('const handleActivityTouchStart'),
    activityColumn.indexOf('const handleActivityTouchMove'),
  );
  assert.doesNotMatch(touchStartHandler, /preventDefault/);
  assert.match(activityColumn, /if \(event\.cancelable\) event\.preventDefault\(\)/);
});
