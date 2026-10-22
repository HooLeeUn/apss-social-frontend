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

function videoFixture(enabled = true, deferMeasurement = false) {
  const wrapper = { style: { cssText: "" } };
  const video = { style: { cssText: "max-height:288px" }, parentElement: wrapper };
  const root = { querySelectorAll: () => [video], querySelector: () => video };
  let cleanup, measures = 0, mutations, resize;
  let calibration, finishMeasurement;
  const exports = {};
  vm.runInNewContext(compile("hooks/useDetailVideoSpace.ts"), {
    exports, console,
    require: name => name === "react" ? {
      useRef: initial => calibration ??= { current: initial },
      useLayoutEffect: fn => { cleanup?.(); cleanup = fn(); },
    } : {
      measureDetailVideoReference: async () => {
        measures++;
        if (deferMeasurement) await new Promise(resolve => { finishMeasurement = resolve; });
        return { width: 112.5, height: 200 };
      },
    },
    window: { addEventListener: (event, fn) => { if (event === "resize") resize = fn; }, removeEventListener() {} },
    MutationObserver: class { constructor(fn) { mutations = fn; } observe() {} disconnect() {} },
  });
  const rootRef = { current: root };
  exports.useDetailVideoSpace(rootRef, enabled);
  return { video, wrapper, cleanup: () => cleanup?.(), resize: () => resize?.(), mutate: () => mutations?.(), measures: () => measures,
    trailer: open => exports.useDetailVideoSpace(rootRef, enabled, open), finishMeasurement: () => finishMeasurement?.() };
}

test("repeated trailer cycles restore the original rectangle synchronously without recalibration in zoom 1 and 5", async () => {
  for (const zoom of [1, 5]) {
    const f = videoFixture();
    await new Promise(resolve => setImmediate(resolve));
    for (let cycle = 0; cycle < 5; cycle++) {
      f.trailer(true);
      f.wrapper.style.width = "10px";
      f.wrapper.style.height = "18px";
      f.trailer(false);
      assert.equal(f.wrapper.style.width, "112.5px", `zoom ${zoom}, cycle ${cycle}`);
      assert.equal(f.wrapper.style.height, "200px");
      assert.equal(f.wrapper.style.visibility, "");
      f.resize();
      assert.equal(f.measures(), 1);
    }
    f.cleanup();
  }
});

test("opening and closing the trailer during initial calibration reuses the in-flight measurement", async () => {
  const f = videoFixture(true, true);
  f.trailer(true);
  f.trailer(false);
  assert.equal(f.measures(), 1);
  f.finishMeasurement();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.wrapper.style.width, "112.5px");
  assert.equal(f.wrapper.style.height, "200px");
  f.cleanup();
});

test("normal mobile removes only the shared visual reaction pill", () => {
  const page = readFileSync("app/movies/[id]/page.tsx", "utf8");
  assert.match(page, /useDetailVideoSpace\(videoGateAnchorRef, mobileViewport && active, trailerCompanionOpen\)/);
  assert.match(page, /className=\{!trailerCompanionOpen && mobileViewport \? "absolute right-2 top-2 z-20" : "pointer-events-none absolute left-2 top-2/);
  assert.match(page, /rounded-full font-semibold leading-none transition/);
});

test("all three zoom sequences retain the same calibrated rectangle, including fresh entry in 1 and 5", async () => {
  for (const sequence of [[5,4,3,2,1], [1,2,3,4,5], [1,4,2,5,3,1]]) {
    const f = videoFixture();
    assert.equal(f.wrapper.style.visibility, "hidden");
    await new Promise(resolve => setImmediate(resolve));
    for (const zoom of sequence) {
      f.resize();
      f.mutate();
      assert.equal(f.wrapper.style.width, "112.5px", "zoom " + zoom);
      assert.equal(f.wrapper.style.height, "200px", "zoom " + zoom);
      assert.equal(f.wrapper.style.visibility, "");
    }
    assert.equal(f.measures(), 1);
    f.cleanup();
    assert.equal(f.video.style.cssText, "max-height:288px");
  }
});

test("disabled sizing does not modify trailer/desktop geometry", () => {
  const f = videoFixture(false);
  assert.equal(f.measures(), 0);
  assert.equal(f.wrapper.style.width, undefined);
  assert.equal(f.video.style.cssText, "max-height:288px");
});

test("reference measurement uses its own viewport and preceding layout, never live video bounds", async () => {
  const exports = {};
  let removed = false, cleared = false, css, referenceCss;
  const marker = { style: {}, replaceChildren() { cleared = true; }, getBoundingClientRect: () => ({ top: 450 }), parentElement: { clientWidth: 200 } };
  const clone = { querySelectorAll: () => [], querySelector: () => ({ parentElement: marker }) };
  const doc = {
    open() {}, write() {}, close() {}, documentElement: {}, head: { appendChild(style) { referenceCss = style.textContent; } },
    createElement: () => ({ style: {} }), fonts: { ready: Promise.resolve() },
    body: { appendChild() {} },
  };
  const frame = { style: {}, setAttribute() {}, contentDocument: doc, contentWindow: { getComputedStyle: () => ({ paddingBottom: "0" }) }, remove() { removed = true; } };
  vm.runInNewContext(compile("hooks/detailVideoReference.ts"), {
    exports, URL,
    document: {
      createElement: () => frame, documentElement: { lang: "es", className: "" },
      body: { className: "", appendChild() { css = frame.style.cssText; } },
      styleSheets: [{ href: "https://example.test/_next/static/css/app.css", media: { mediaText: "" }, cssRules: [{ cssText: '@font-face { src: url(../media/font.woff2); }' }] }],
    },
  });
  const measured = await exports.measureDetailVideoReference({ closest: () => ({ cloneNode: () => clone }), getBoundingClientRect() { throw new Error("Live geometry must not be measured"); } });
  assert.equal(measured.width, 178 * 9 / 16);
  assert.equal(measured.height, 178);
  assert.match(css, /width:320px;height:640px/);
  assert.match(referenceCss, /https:\/\/example.test\/_next\/static\/media\/font.woff2/);
  assert.ok(removed && cleared);
  assert.equal(marker.style.cssText, "width:0;height:0;flex-shrink:0");
});

test("the largest reference rectangle is bounded by both width and height at 9:16", () => {
  const exports = {};
  vm.runInNewContext(compile("hooks/detailVideoReference.ts"), { exports });
  for (const [width, height] of [[200,178], [120,300], [300,200], [100,100]]) {
    const rect = exports.fitReferenceVideo(width, height);
    assert.ok(rect.width <= width && rect.height <= height);
    assert.equal(rect.width / rect.height, 9 / 16);
  }
});
