import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

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


function sectionSyncFixture(mobile = true, slide = 0) {
  const ast = ts.createSourceFile("profile-feed.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "syncActiveMobileSection") initializer = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(initializer);
  let scrollTop = 0, active = "top";
  const section = top => ({ current: { getBoundingClientRect: () => ({ top: top - scrollTop, height: 800 }) } });
  const exports = {};
  vm.runInNewContext(ts.transpileModule(`exports.sync = ${initializer}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, useCallback: fn => fn, activeMobileProfileFeedSlide: slide,
    window: { matchMedia: () => ({ matches: mobile }) },
    profileFeedScrollerRef: { current: { clientHeight: 800, getBoundingClientRect: () => ({ top: 0 }) } },
    topSectionRef: section(0), connectionsSearchSectionRef: section(800),
    activityAndListsPanelRef: section(1600), followingActivityPanelRef: section(2400),
    setActiveMobileSection: section => { active = section; },
  });
  return { sync: exports.sync, scrollTo: value => { scrollTop = value; }, active: () => active };
}

test("return arrow follows external navigation and restored positions without a dock click", () => {
  const f = sectionSyncFixture();
  f.sync();
  assert.equal(f.active(), "top");
  // Notification scrollIntoView, then URL cleanup and Friends/Pending tab changes.
  f.scrollTo(800);
  for (let update = 0; update < 3; update++) {
    f.sync();
    assert.equal(f.active(), "connections");
  }
  f.scrollTo(1600); f.sync();
  assert.equal(f.active(), "activity");
  f.scrollTo(2400); f.sync();
  assert.equal(f.active(), "following-activity");
  f.scrollTo(0); f.sync();
  assert.equal(f.active(), "top");
  const restored = sectionSyncFixture();
  restored.scrollTo(800); restored.sync();
  assert.equal(restored.active(), "connections");
});

test("section synchronization preserves list carousel state and ignores desktop", () => {
  const lists = sectionSyncFixture(true, 1);
  lists.scrollTo(1600); lists.sync();
  assert.equal(lists.active(), "lists");
  const desktop = sectionSyncFixture(false);
  desktop.scrollTo(800); desktop.sync();
  assert.equal(desktop.active(), "top");
});

test("main scroll updates only the existing arrow state and keeps internal dock behavior", () => {
  assert.match(page, /target === event.currentTarget\) \{\s*syncActiveMobileSection\(\);\s*return;/);
  assert.match(page, /useEffect\(\(\) => \{\s*syncActiveMobileSection\(\);\s*\}, \[syncActiveMobileSection\]\)/);
  assert.match(page, /showBackToTop=\{activeMobileSection !== "top"\}/);
  assert.match(page, /onBackToTop=\{\(\) => navigateToMobileSection\("top"\)\}/);
});
