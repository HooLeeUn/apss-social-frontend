import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((id) => dependencies[id] ?? require(id), module, module.exports);
  return module.exports;
}
const { mentionPopupPosition } = load("../lib/mention-popup-position.ts");

test("mention popup fits portrait visible viewport with keyboard and flips above textarea", () => {
  const anchor = { left: 16, top: 330, width: 358, height: 72 };
  const viewport = { left: 0, top: 0, width: 390, height: 430 };
  const result = mentionPopupPosition(anchor, viewport, 208);
  assert.ok(result.top + 208 <= anchor.top);
  assert.ok(result.top >= 8);
  assert.ok(result.left >= 8);
  assert.ok(result.left + result.width <= 382);
});

test("mention popup stays below when there is room", () => {
  const result = mentionPopupPosition({ left: 16, top: 100, width: 358, height: 72 }, { left: 0, top: 0, width: 390, height: 500 }, 120);
  assert.equal(result.top, 180);
  assert.ok(result.top + 120 < 500);
});

test("mention popup stays inside zoomed/panned visual viewport and limits scrolling height", () => {
  for (const viewport of [
    { left: 45, top: 120, width: 260, height: 280 },
    { left: 85, top: 200, width: 195, height: 180 },
    { left: 0, top: 0, width: 320, height: 230 },
  ]) {
    const result = mentionPopupPosition({ left: 16, top: viewport.top + 110, width: 358, height: 72 }, viewport, 208);
    assert.ok(result.left >= viewport.left + 8);
    assert.ok(result.left + result.width <= viewport.left + viewport.width - 8);
    assert.ok(result.top >= viewport.top + 8);
    assert.ok(result.top + Math.min(result.maxHeight, 208) <= viewport.top + viewport.height - 8);
  }
});

function composerHarness(submit) {
  const states = [];
  const refs = [];
  let index = 0, refIndex = 0, blurs = 0;
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(initial) { const i = index++; if (!(i in states)) states[i] = initial; return [states[i], (next) => { states[i] = typeof next === "function" ? next(states[i]) : next; }]; },
    useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial }; },
    useMemo(fn) { return fn(); }, useEffect() {},
  };
  const Composer = load("../components/social/CommentComposer.tsx", {
    react, "react/jsx-runtime": { jsx, jsxs: jsx },
    "../../hooks/useI18n": { useI18n: () => ({ t: (key) => key }) },
    "./MentionAutocomplete": { default: "mention-popup" },
  }).default;
  const nodes = (tree) => !tree || typeof tree !== "object" ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
  function render() {
    index = 0; refIndex = 0;
    const tree = Composer({ friends: [{ id: "1", username: "den" }], searchMentionSuggestions: async () => [], onSubmit: submit });
    refs[0].current = { selectionStart: 4, blur() { blurs++; }, focus() {}, setSelectionRange() {} };
    return nodes(tree);
  }
  return { render, states, blurs: () => blurs };
}

for (const directed of [false, true]) {
  test(`successful ${directed ? "directed" : "public"} submit clears text and blurs once`, async () => {
    let payload;
    const harness = composerHarness(async (value) => { payload = value; return true; });
    let nodes = harness.render();
    nodes.find((node) => node.type === "textarea").props.onChange({ target: { value: directed ? "@den hello" : "hello", selectionStart: directed ? 10 : 5 } });
    if (directed) harness.states[4] = { username: "den", tokenStart: 0, tokenEnd: 4 };
    nodes = harness.render();
    nodes.find((node) => node.type === "button").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(payload, { text: directed ? "@den hello" : "hello", mentionUsername: directed ? "den" : null });
    assert.equal(harness.states[0], "");
    assert.equal(harness.blurs(), 1);
  });
}

test("failed submit preserves draft and does not blur textarea", async () => {
  const harness = composerHarness(async () => false);
  let nodes = harness.render();
  nodes.find((node) => node.type === "textarea").props.onChange({ target: { value: "retry this", selectionStart: 10 } });
  nodes = harness.render();
  nodes.find((node) => node.type === "button").props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.states[0], "retry this");
  assert.equal(harness.blurs(), 0);
});

test("selecting a mention preserves insertion and keeps the textarea available for writing", (t) => {
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
  t.after(() => { globalThis.requestAnimationFrame = original; });
  const harness = composerHarness(async () => true);
  let nodes = harness.render();
  nodes.find((node) => node.type === "textarea").props.onChange({ target: { value: "@den", selectionStart: 4 } });
  nodes = harness.render();
  nodes.find((node) => node.type === "mention-popup").props.onSelect({ id: "1", username: "den" });
  assert.equal(harness.states[0], "@den ");
  assert.equal(harness.states[1], null);
  assert.equal(harness.blurs(), 0);
});

test("native Profile Feed clear event blurs only an empty search input", () => {
  const source = readFileSync(new URL("../app/profile-feed/page.tsx", import.meta.url), "utf8");
  assert.match(source, /ref=\{userSearchInputRef\}/);
  assert.match(source, /input\.addEventListener\("search", dismissClearedSearch\)/);
  const body = source.match(/const dismissClearedSearch = \(\) => \{([^}]+)\}/)[1];
  let blurs = 0;
  const input = { value: "den", blur() { blurs++; } };
  const clear = new Function("input", body);
  clear(input); assert.equal(blurs, 0);
  input.value = ""; clear(input); assert.equal(blurs, 1);
});
