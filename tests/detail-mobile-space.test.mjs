import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function compile(path) {
  return ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
}

test("country selector ignores internal native and forwarded gestures but closes outside", () => {
  class Node { contains(node) { return node === this; } }
  class CustomEvent { constructor(target) { this.target = {}; this.detail = { target }; } }
  const container = new Node(), panel = new Node();
  let ref = 0, closes = 0;
  const listeners = new Map();
  const exports = {};
  const React = { useState: initial => [initial, value => { if (value === false) closes++; }], useCallback: fn => fn, useRef: () => ({ current: ref++ === 0 ? container : panel }), useEffect: fn => fn(), useMemo: fn => fn() };
  vm.runInNewContext(compile("components/StreamingCountrySelector.tsx"), {
    exports, Node, CustomEvent,
    require: name => name === "react" ? React : name === "react/jsx-runtime" ? { jsx: () => null, jsxs: () => null } : { normalizeCountrySearchText: text => text, STREAMING_COUNTRY_OPTIONS: [{ value: "CO", name: "Colombia" }] },
    window: { matchMedia: () => ({ matches: false }), addEventListener() {} },
    document: { addEventListener: (name, fn) => listeners.set(name, fn) },
  });
  exports.default({ country: "CO", onCountryChange() {}, portalMenu: true });
  listeners.get("touchmove")({ target: panel });
  listeners.get("qnext-mobile-metadata-drag")(new CustomEvent(panel));
  assert.equal(closes, 0);
  listeners.get("touchmove")({ target: new Node() });
  assert.equal(closes, 1);
  listeners.get("mousedown")({ target: panel });
  assert.equal(closes, 1);
  listeners.get("mousedown")({ target: new Node() });
  assert.equal(closes, 2);
});

function videoFixture({ viewportHeight = 900, stickyBottom = 300, rootTop = 320, overhead = 60, width = 340, ratio = 9 / 16, enabled = true } = {}) {
  const wrapper = { style: { cssText: "" }, parentElement: { clientWidth: width }, getBoundingClientRect: () => ({ top: rootTop + overhead }) };
  const video = { style: { cssText: "max-height:288px" }, parentElement: wrapper, videoWidth: ratio * 1600, videoHeight: 1600 };
  const root = { querySelectorAll: () => [video], getBoundingClientRect: () => ({ top: rootTop }), addEventListener() {}, removeEventListener() {} };
  let cleanup, observerCount = 0;
  const exports = {};
  vm.runInNewContext(compile("hooks/useDetailVideoSpace.ts"), {
    exports, require: () => ({ useLayoutEffect: fn => { cleanup = fn(); } }),
    document: { querySelector: () => ({ getBoundingClientRect: () => ({ bottom: stickyBottom }) }), createElement: () => ({ style: {}, remove() {} }), body: { appendChild() {} } },
    getComputedStyle: () => ({ paddingBottom: "20px" }),
    window: { innerHeight: viewportHeight, addEventListener() {}, removeEventListener() {} },
    ResizeObserver: class { constructor() { observerCount++; } observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
  });
  exports.useDetailVideoSpace({ current: root }, enabled);
  return { video, wrapper, cleanup, observerCount };
}

test("five available-space scenarios fit video to height and width, preserving aspect ratio", () => {
  for (const stickyBottom of [240, 280, 320, 360, 400]) {
    const rootTop = stickyBottom + 20;
    const f = videoFixture({ viewportHeight: 800, stickyBottom, rootTop });
    const available = 800 - rootTop - 60 - 32;
    assert.equal(parseFloat(f.wrapper.style.height), available);
    assert.equal(parseFloat(f.wrapper.style.width), available * 9 / 16);
    assert.ok(parseFloat(f.wrapper.style.width) <= 340);
    f.cleanup();
    assert.equal(f.video.style.cssText, "max-height:288px");
  }
  const landscape = videoFixture({ ratio: 16 / 9 });
  assert.equal(parseFloat(landscape.wrapper.style.width), 340);
  assert.equal(parseFloat(landscape.wrapper.style.height), 340 / (16 / 9));
});

test("disabled sizing does not observe or modify trailer/desktop geometry", () => {
  const f = videoFixture({ enabled: false });
  assert.equal(f.observerCount, 0);
  assert.equal(f.wrapper.style.width, undefined);
  assert.equal(f.video.style.cssText, "max-height:288px");
});
