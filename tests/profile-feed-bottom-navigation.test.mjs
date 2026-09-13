import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/profile-feed/page.tsx", "utf8");
const myActivity = readFileSync("components/profile-feed/MyActivityColumn.tsx", "utf8");
const followingActivity = readFileSync("components/profile-feed/SocialActivityTabsBlock.tsx", "utf8");

test("all three own-activity tabs force the hidden bottom panel visible", () => {
  assert.match(page, /showMobileBottomNavigation = useCallback\(\(\) => setQuickNavigationVisible\(true\)/);
  assert.match(page, /<MyActivityColumn[\s\S]*?onSectionChange=\{showMobileBottomNavigation\}/);
  assert.match(myActivity, /ownProfileTabs\.map[\s\S]*?onSectionChange\?\.\(\);[\s\S]*?setActiveTab\(tab\.value\)/);
  for (const tab of ["activity", "messages", "rated"]) assert.match(myActivity, new RegExp(`value: "${tab}"`));
});

test("both mobile list selector choices force the hidden bottom panel visible", () => {
  assert.match(page, /onChange=\{\(value\) => \{[\s\S]*?if \(mobile\) showMobileBottomNavigation\(\);[\s\S]*?setListView\(value\)/);
  assert.match(page, /\{ value: "my-list"/);
  assert.match(page, /\{ value: "recommended"/);
});

test("recommendations, actions, and recordings force the hidden bottom panel visible", () => {
  assert.match(page, /<SocialActivityTabsBlock onSectionChange=\{showMobileBottomNavigation\}/);
  for (const handler of ["handleRecommendationsTabClick", "handleActivityTabClick", "handleRecordingsTabClick"]) {
    const start = followingActivity.indexOf(`const ${handler}`);
    assert.notEqual(start, -1);
    assert.match(followingActivity.slice(start, start + 260), /onSectionChange\?\.\(\)/);
  }
});

test("existing swipe-direction scroll behavior remains intact", () => {
  assert.match(page, /target\.scrollTop > previous\) setQuickNavigationVisible\(false\)/);
  assert.match(page, /target\.scrollTop < previous\) setQuickNavigationVisible\(true\)/);
});
