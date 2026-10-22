import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile = path => ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function fixture(kind, enabled = true) {
  const attributes = new Map();
  let crowded = false, mobile = true, resize, cleanup, clones = 0;
  const target = { left: 100, right: 200, top: 150, bottom: 180 };
  const row = { children: [{ style: {} }, { style: {} }, { style: {} }], get scrollWidth() { return crowded ? 250 : 130; }, clientWidth: 140 };
  const probe = { style: {}, removeAttribute() {}, setAttribute() {}, remove() {}, querySelectorAll: selector => selector === "[data-profile-chip]" ? [{ getBoundingClientRect: () => ({ left: crowded ? 110 : 0, right: crowded ? 180 : 80, top: 150, bottom: 180, width: 70 }) }] : [], querySelector: selector => selector.includes("followers") ? { getBoundingClientRect: () => target } : row };
  const element = { parentElement: { appendChild() {} }, cloneNode: () => { clones++; return probe; }, closest: () => element, getBoundingClientRect: () => ({ width: 200 }), setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key) };
  const exports = {};
  vm.runInNewContext(compile("hooks/useVisitedProfileFit.ts"), {
    exports, require: () => ({ useLayoutEffect: fn => { cleanup = fn(); } }),
    window: { matchMedia: () => ({ get matches() { return mobile; }, addEventListener() {}, removeEventListener() {} }) },
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} disconnect() {} },
    document: { fonts: { addEventListener() {}, removeEventListener() {} } },
  });
  exports.useVisitedProfileFit({ current: element }, enabled, kind);
  return { attributes, change: value => { crowded = value; resize?.(); }, desktop: () => { mobile = false; resize?.(); }, cleanup: () => cleanup?.(), clones: () => clones };
}

for (const [kind, attribute] of [["identity", "data-visited-identity-compact"], ["ratings", "data-visited-ratings-stacked"]]) {
  test(`${kind} preserves a fitting layout, adapts on real crowding, and restores without oscillation`, () => {
    const f = fixture(kind);
    assert.equal(f.attributes.has(attribute), false);
    for (let cycle = 0; cycle < 3; cycle++) {
      f.change(true);
      assert.equal(f.attributes.get(attribute), "true");
      f.change(true);
      assert.equal(f.attributes.get(attribute), "true");
      f.change(false);
      assert.equal(f.attributes.has(attribute), false);
    }
    f.change(true);
    f.desktop();
    assert.equal(f.attributes.has(attribute), false);
    f.cleanup();
  });
  test(`${kind} does not measure or adapt unrequested profile contexts`, () => {
    const f = fixture(kind, false);
    assert.equal(f.clones(), 0);
  });
}

test("visited mobile text uses passive text/popovers, preserving the original desktop link", () => {
  const exports = {};
  const jsx = (type, props, key) => ({ type, props, key });
  vm.runInNewContext(compile("components/profile-feed/VisitedProfileText.tsx"), { exports, require: name => name === "react/jsx-runtime" ? { jsx, jsxs: jsx } : { default: "TruncatedText" } });
  const desktop = { type: "a", props: { href: "/movies/42" } };
  const result = exports.default({ text: "Long title", desktop });
  assert.equal(result.props.children[0].props.children.props.as, "span");
  assert.equal(result.props.children[0].props.children.props.href, undefined);
  assert.equal(result.props.children[0].props.children.key, "Long title");
  assert.equal(result.props.children[1].props.children, desktop);
  assert.equal(exports.default({ text: "title", desktop, enabled: false }).props.children, desktop);
});

test("relationship scrolling and adaptive layouts are restricted to visited mobile", () => {
  const css = readFileSync("app/globals.css", "utf8").replaceAll("\r\n", "\n");
  const start = css.indexOf("@media (max-width: 1279px) {\n  .visited-profile-tablet-framing .favorite-movies-block");
  assert.ok(start >= 0);
  const rules = css.slice(start, css.indexOf("\n@media", start + 1));
  assert.match(rules, /data-visited-social-actions\][^{]*\{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/);
  assert.match(rules, /data-visited-social-actions\] > button\s*\{[^}]*flex: 0 0 auto;[^}]*white-space: nowrap;/);
  assert.match(rules, /data-visited-ratings-stacked="true"/);
  assert.match(rules, /data-visited-identity-compact="true"/);
  assert.doesNotMatch(readFileSync("hooks/useVisitedProfileFit.ts", "utf8"), /setTimeout|setInterval/);
});
