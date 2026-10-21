import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, modules, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => modules[name] ?? {}, ...globals });
  return exports.default;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };

function panelFixture({ width = 360, height = 640, left = 320, top = 580, panelHeight = 180, offsetLeft = 0, offsetTop = 0 } = {}) {
  const listeners = new Map();
  const add = (key, fn) => listeners.set(key, fn);
  const remove = key => listeners.delete(key);
  const inside = {};
  const anchor = { contains: target => target === anchor, getBoundingClientRect: () => ({ left, top, bottom: top + 40 }) };
  const panel = { style: {}, contains: target => target === inside, getBoundingClientRect: () => ({ width: Math.min(280, parseFloat(panel.style.maxWidth)), height: Math.min(panelHeight, parseFloat(panel.style.maxHeight)) }) };
  let closed = 0, cleanup;
  const Component = load("components/profile-feed/ActionsFloatingPanel.tsx", {
    react: { useRef: () => ({ current: panel }), useLayoutEffect: fn => { cleanup = fn(); } },
    "react/jsx-runtime": runtime, "react-dom": { createPortal: value => value },
  }, {
    Event: class {},
    window: { innerWidth: width, innerHeight: height, visualViewport: { width, height, offsetLeft, offsetTop, addEventListener() {}, removeEventListener() {} }, dispatchEvent() {}, addEventListener: add, removeEventListener: remove },
    document: { body: {}, addEventListener: add, removeEventListener: remove },
  });
  Component({ anchorRef: { current: anchor }, onClose: () => closed++, children: "Full comment", label: "Comment" });
  return { panel, listeners, inside, anchor, closed: () => closed, cleanup };
}

test("Actions panels stay inside narrow and normal viewports at every edge", () => {
  for (const width of [240, 280, 360, 430]) {
    for (const left of [-10, 0, width - 20]) {
      for (const top of [0, 200, 600]) {
        const { panel } = panelFixture({ width, left, top });
        const rect = panel.getBoundingClientRect();
        assert.ok(parseFloat(panel.style.left) >= 8);
        assert.ok(parseFloat(panel.style.left) + rect.width <= width - 8);
        assert.ok(parseFloat(panel.style.top) >= 8);
        assert.ok(parseFloat(panel.style.top) + rect.height <= 632);
        if (top === 600) assert.ok(parseFloat(panel.style.top) < top);
      }
    }
  }
});

test("long comments are height bounded and visual viewport offsets are respected", () => {
  const { panel } = panelFixture({ width: 240, height: 300, left: 250, top: 200, panelHeight: 2000, offsetLeft: 20, offsetTop: 30 });
  assert.ok(parseFloat(panel.style.left) >= 28);
  assert.ok(parseFloat(panel.style.top) >= 38);
  assert.ok(parseFloat(panel.style.top) + panel.getBoundingClientRect().height <= 322);
});

test("outside touches, movement, another card's panel and Escape dismiss; internal scroll does not", () => {
  const fixture = panelFixture();
  for (const key of ["scroll", "touchmove", "wheel"]) {
    fixture.listeners.get(key)({ target: fixture.inside });
    assert.equal(fixture.closed(), 0);
  }
  fixture.listeners.get("pointerdown")({ target: fixture.anchor });
  assert.equal(fixture.closed(), 0);
  for (const key of ["pointerdown", "scroll", "touchmove", "wheel"]) fixture.listeners.get(key)({ target: {} });
  fixture.listeners.get("profile-actions-panel-open")();
  fixture.listeners.get("keydown")({ key: "Escape" });
  assert.equal(fixture.closed(), 6);
  fixture.cleanup();
  assert.equal(fixture.listeners.size, 0);
});

test("only measured overflow enables username, comment and genre expansion", () => {
  for (const [width, height, expected] of [[100, 20, false], [101, 20, false], [150, 20, true], [100, 80, true]]) {
    for (const [text, href] of [["Short comment", undefined], ["Action, Animation, Drama", undefined], ["@LongUsername", "/users/LongUsername"]]) {
      let expanded = false, intercepted = false;
      const element = { scrollWidth: width, clientWidth: 100, scrollHeight: height, clientHeight: 20 };
      const Component = load("components/profile-feed/ActionsTruncatedText.tsx", {
        react: { useRef: () => ({ current: element }), useState: () => [false, value => { if (typeof value === "function") expanded = value(false); }], useEffect() {}, useCallback: fn => fn },
        "react/jsx-runtime": runtime,
      });
      const result = Component({ text, href, className: "" });
      result.props.children[0].props.onClick({ stopPropagation() {}, preventDefault() { intercepted = true; } });
      assert.equal(intercepted, expected);
      assert.equal(expanded, expected);
    }
  }
});

test("genre popover exposes all genres with its own accessible label", () => {
  let stateIndex = 0;
  const Component = load("components/profile-feed/ActionsTruncatedText.tsx", {
    react: { useRef: () => ({ current: null }), useState: () => [stateIndex++ === 0, () => {}], useEffect() {}, useCallback: fn => fn },
    "react/jsx-runtime": runtime,
  });
  const text = "Action, Animation, Drama";
  const result = Component({ text, className: "truncate", popoverLabel: "Género" });
  const panel = result.props.children[1];
  assert.equal(panel.props.label, "Género");
  assert.equal(panel.props.children.props.children, text);
});

test("only the narrow Actions container redistributes metadata and prevents header wrap", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const start = css.indexOf("@container profile-actions (max-width: 14rem)");
  const narrow = css.slice(start, css.indexOf("\n.activity-scrollbar", start));
  assert.ok(start >= 0);
  assert.match(narrow, /\[data-actions-actor-row="true"\]\s*\{\s*flex-wrap: nowrap;/);
  assert.match(narrow, /:first-child\s*\{\s*flex: 1 1 0%;\s*min-width: 0;/);
  assert.match(narrow, /\.profile-actions-metadata\s*\{[^}]*grid-template-columns: max-content minmax\(0, 1fr\) max-content;/);
  assert.match(narrow, /\.profile-actions-production > :first-child\s*\{\s*grid-column: 1 \/ -1;/);
  assert.match(narrow, /\.profile-actions-description > p\s*\{\s*flex: none;/);
  const card = readFileSync("components/profile-feed/SocialActivityCard.tsx", "utf8");
  assert.match(card, /isMobile \? <ActionsTruncatedText text=\{movieGenre\}/);
  assert.doesNotMatch(card, /overflow-x-auto|touch-action:pan-x/);
});
