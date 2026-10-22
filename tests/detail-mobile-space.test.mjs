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

const reference = {};
vm.runInNewContext(compile("hooks/detailVideoReference.ts"), { exports: reference });
const { DETAIL_VIDEO_HEIGHT, DETAIL_VIDEO_WIDTH } = reference;
const hook = compile("hooks/useDetailVideoSpace.ts");

function videoFixture({ enabled = true, hasVideo = true } = {}) {
  let cleanup, mutation, observers = 0;
  const style = (initial = "") => {
    let values = { cssText: initial };
    return new Proxy({}, {
      get: (_, key) => values[key],
      set: (_, key, value) => {
        if (key === "cssText") values = { cssText: value };
        else values[key] = value;
        return true;
      },
    });
  };
  let geometry = { width: 1, height: 1 };
  const wrapper = { style: style(), getBoundingClientRect: () => geometry };
  const video = { style: style("max-height:288px"), parentElement: wrapper,
    getBoundingClientRect: () => geometry };
  const root = { querySelectorAll: () => hasVideo ? [video] : [], getBoundingClientRect: () => geometry };
  const exports = {};
  vm.runInNewContext(hook, {
    exports,
    require: name => name === "react" ? {
      useLayoutEffect: fn => { cleanup?.(); cleanup = fn(); },
    } : reference,
    // Measurements, timers and observers that can recalculate the size fail.
    getComputedStyle() { throw Error("Unexpected measured calibration"); },
    ResizeObserver: class { constructor() { throw Error("Unexpected resize observer"); } },
    window: new Proxy({}, { get() { throw Error("Unexpected viewport or scroll dependency"); } }),
    document: new Proxy({}, { get() { throw Error("Unexpected calibration document"); } }),
    MutationObserver: class {
      constructor(fn) { mutation = fn; }
      observe() { observers++; }
      disconnect() { observers--; }
    },
  });
  const rootRef = { current: root };
  exports.useDetailVideoSpace(rootRef, enabled);
  return { video, wrapper, observers: () => observers,
    frame(next) { geometry = next; mutation?.(); },
    addVideo() { hasVideo = true; mutation?.(); },
    trailer(open) { exports.useDetailVideoSpace(rootRef, enabled, open); },
    cleanup() { cleanup?.(); },
  };
}

// Evaluate the emitted CSS math, including the parent's inline-size limit.
function renderedSize(parentWidth, viewportHeight, rootFontSize = 16) {
  const expression = DETAIL_VIDEO_WIDTH
    .replace("100%", String(parentWidth))
    .replace(/([\d.]+)rem/g, (_, value) => String(Number(value) * rootFontSize))
    .replace(/([\d.]+)dvh/g, (_, value) => String(Number(value) * viewportHeight / 100))
    .replaceAll("min(", "Math.min(")
    .replaceAll("calc(", "(");
  const width = vm.runInNewContext(expression, { clamp: (lower, value, upper) => Math.max(lower, Math.min(value, upper)) });
  return { width, height: width * 16 / 9 };
}

function assertRule(f) {
  assert.equal(f.wrapper.style.width, DETAIL_VIDEO_WIDTH);
  assert.equal(f.wrapper.style.aspectRatio, "9 / 16");
  assert.equal(f.wrapper.style.height, "auto");
  assert.equal(f.wrapper.style.maxWidth, "100%");
  assert.equal(f.video.style.position, "absolute");
  assert.equal(f.video.style.width, "100%");
  assert.equal(f.video.style.height, "100%");
  assert.equal(f.wrapper.style.visibility, "");
}

test("restored rule matches the original player height instead of inventing a new calibration", () => {
  const page = readFileSync("app/movies/[id]/page.tsx", "utf8");
  const originalHeight = page.match(/VIDEO_COMMENT_CARD_VIDEO_HEIGHT = "([^"]+)"/)[1];
  assert.equal(DETAIL_VIDEO_HEIGHT, originalHeight);
  assert.deepEqual(renderedSize(400, 1000), { width: 162, height: 288 });
  assert.deepEqual(renderedSize(400, 600), { width: 126, height: 224 });
  assert.deepEqual(renderedSize(400, 700), { width: 141.75, height: 252 });
});

test("40 remounts per viewport have the same initial and settled size", () => {
  for (const viewport of [960, 880, 800, 720, 640]) {
    const expected = renderedSize(300, viewport);
    for (let mount = 0; mount < 40; mount++) {
      const f = videoFixture();
      assertRule(f);
      // Even positive, tiny and apparently stable geometry cannot change size.
      for (let frame = 0; frame < 30; frame++) {
        f.frame({ width: 1, height: 2 });
        assertRule(f);
        assert.deepEqual(renderedSize(300, viewport), expected);
      }
      f.frame({ width: 300, height: 600 });
      assertRule(f);
      assert.deepEqual(renderedSize(300, viewport), expected);
      f.cleanup();
      assert.equal(f.observers(), 0);
    }
  }
});

test("trailer cycles synchronously restore the same sizing rule and clean up subscriptions", () => {
  const f = videoFixture();
  for (let cycle = 0; cycle < 10; cycle++) {
    assert.equal(f.observers(), 1);
    f.trailer(true);
    assert.equal(f.observers(), 0);
    assert.equal(f.video.style.cssText, "max-height:288px");
    f.wrapper.style.width = "1px";
    f.trailer(false);
    assertRule(f);
  }
  f.cleanup();
  assert.equal(f.observers(), 0);
});

test("returning to any viewport restores the exact original size without previous-zoom state", () => {
  const f = videoFixture();
  const initial = renderedSize(340, 960);
  for (const viewport of [640, 800, 720, 960, 640, 960]) {
    f.frame({ width: 300, height: viewport });
    assertRule(f);
    if (viewport === 960) assert.deepEqual(renderedSize(340, viewport), initial);
  }
  f.cleanup();
});

test("width safety limit preserves aspect ratio and fits its container", () => {
  for (const viewport of [640, 720, 800, 960]) {
    for (const available of [80, 120, 200, 300, 500]) {
      const size = renderedSize(available, viewport);
      assert.ok(size.width <= available);
      assert.ok(size.height <= 288);
      assert.equal(size.width / size.height, 9 / 16);
      if (available >= 200) assert.ok(size.height >= 224);
    }
  }
});

test("late video cards use the final rule immediately; desktop is not changed", () => {
  const f = videoFixture({ hasVideo: false });
  assert.equal(f.wrapper.style.width, undefined);
  f.addVideo();
  assertRule(f);
  f.cleanup();
  const desktop = videoFixture({ enabled: false });
  assert.equal(desktop.wrapper.style.width, undefined);
  assert.equal(desktop.video.style.cssText, "max-height:288px");
  assert.equal(desktop.observers(), 0);
});

test("normal mobile keeps existing hook scope and reaction pill placement", () => {
  const page = readFileSync("app/movies/[id]/page.tsx", "utf8");
  assert.match(page, /useDetailVideoSpace\(videoGateAnchorRef, mobileViewport && active, trailerCompanionOpen\)/);
  assert.match(page, /className=\{!trailerCompanionOpen && mobileViewport \? "absolute right-2 top-2 z-20" : "pointer-events-none absolute left-2 top-2/);
});
