import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("components/profile-feed/SocialActivityTabsBlock.tsx", "utf8");
const parsed = ts.createSourceFile("tabs.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helper = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "revealFollowingTab");
const compiled = ts.transpileModule(helper.getText(parsed), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture(mobile = true) {
  const calls = [];
  const context = vm.createContext({ window: { matchMedia: () => ({ matches: mobile }) } });
  vm.runInContext(compiled, context);
  const container = { clientLeft: 0, clientWidth: 240, getBoundingClientRect: () => ({ left: 20 }), scrollBy: options => calls.push({ ...options }) };
  return { container, calls, click: (left, right) => context.revealFollowingTab({ getBoundingClientRect: () => ({ left, right }) }, container) };
}

test("selecting a chip clipped on the right scrolls only the missing horizontal distance", () => {
  const f = fixture();
  f.click(220, 315);
  assert.deepEqual(f.calls, [{ left: 55, behavior: "smooth" }]);
});

test("selecting a chip clipped on the left scrolls back by the missing distance", () => {
  const f = fixture();
  f.click(-35, 90);
  assert.deepEqual(f.calls, [{ left: -55, behavior: "smooth" }]);
});

test("a completely visible Actions chip leaves the scroll position untouched", () => {
  const f = fixture();
  f.click(70, 180);
  assert.deepEqual(f.calls, []);
});

test("selection measures current geometry after manual scrolling, also at narrow widths", () => {
  const f = fixture();
  f.container.clientWidth = 160;
  f.click(130, 230);
  f.click(-60, 60);
  f.click(20, 180);
  assert.deepEqual(f.calls, [{ left: 50, behavior: "smooth" }, { left: -80, behavior: "smooth" }]);
  assert.ok(f.calls.every(call => !Object.hasOwn(call, "top")));
});

test("desktop remains unchanged and all three handlers target only the chips container", () => {
  const f = fixture(false);
  f.click(-50, 100);
  assert.deepEqual(f.calls, []);
  assert.equal((source.match(/revealFollowingTab\(event.currentTarget, followingTabsRef.current\)/g) ?? []).length, 3);
  assert.match(source, /ref=\{followingTabsRef\} className="profile-feed-following-tabs/);
});
