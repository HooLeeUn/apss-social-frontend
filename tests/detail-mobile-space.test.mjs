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
const { DETAIL_VIDEO_BASE, DETAIL_VIDEO_WIDTH } = reference;

function videoFixture({ enabled = true, geometry = { width: 1, height: 1 }, hasVideo = true } = {}) {
  let cleanup, mutation, observers = 0, reads = 0;
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
  const bounds = () => { reads++; return geometry; };
  const wrapper = { style: style(), getBoundingClientRect: bounds };
  const video = { style: style("max-height:288px"), parentElement: wrapper, getBoundingClientRect: bounds };
  const root = { querySelectorAll: () => hasVideo ? [video] : [], getBoundingClientRect: bounds };
  const exports = {};
  vm.runInNewContext(compile("hooks/useDetailVideoSpace.ts"), {
    exports,
    require: name => name === "react" ? {
      useLayoutEffect: fn => { cleanup?.(); cleanup = fn(); },
    } : reference,
    // Any geometry listener, deferred measurement or iframe creation is a bug.
    window: new Proxy({}, { get() { throw Error("Unexpected viewport dependency"); } }),
    document: new Proxy({}, { get() { throw Error("Unexpected DOM calibration"); } }),
    MutationObserver: class {
      constructor(fn) { mutation = fn; }
      observe() { observers++; }
      disconnect() { observers--; }
    },
  });
  const rootRef = { current: root };
  exports.useDetailVideoSpace(rootRef, enabled);
  return { video, wrapper, reads: () => reads, observers: () => observers,
    frame(next = geometry) { geometry = next; mutation?.(); },
    addVideo() { hasVideo = true; mutation?.(); },
    trailer(open) { exports.useDetailVideoSpace(rootRef, enabled, open); },
    cleanup() { cleanup?.(); },
  };
}

function assertBase(f) {
  assert.equal(f.wrapper.style.width, DETAIL_VIDEO_WIDTH);
  assert.equal(f.wrapper.style.height, "auto");
  assert.equal(f.wrapper.style.aspectRatio, "9 / 16");
  assert.equal(f.video.style.position, "absolute");
  assert.equal(f.video.style.inset, "0");
  assert.equal(f.video.style.width, "100%");
  assert.equal(f.video.style.height, "100%");
  assert.equal(f.wrapper.style.maxWidth, "100%");
  assert.equal(f.wrapper.style.visibility, "");
}

test("the base is a frozen design rectangle, available synchronously without DOM or viewport", () => {
  assert.equal(DETAIL_VIDEO_BASE.width, 100.125);
  assert.equal(DETAIL_VIDEO_BASE.height, 178);
  assert.equal(DETAIL_VIDEO_BASE.width / DETAIL_VIDEO_BASE.height, 9 / 16);
  assert.ok(Object.isFrozen(DETAIL_VIDEO_BASE));
  const f = videoFixture();
  assertBase(f);
  assert.equal(f.reads(), 0);
  f.cleanup();
});

test("stable tiny geometry for many frames never becomes the base across 40 remounts", () => {
  for (let mount = 0; mount < 40; mount++) {
    const f = videoFixture({ geometry: { width: 1, height: 2 } });
    // The initial visible commit already has the definitive size.
    assertBase(f);
    for (let frame = 0; frame < 30; frame++) {
      f.frame({ width: 1, height: 2 });
      assertBase(f);
    }
    // The real geometry arrives much later than the previous frame validator.
    f.frame({ width: 280, height: 400 });
    assertBase(f);
    assert.equal(f.reads(), 0);
    f.cleanup();
    assert.equal(f.observers(), 0);
  }
});

test("zero, nonfinite and temporarily small rectangles cannot change calibration", () => {
  const f = videoFixture();
  for (const geometry of [{ width: 0, height: 0 }, { width: NaN, height: Infinity }, { width: 5, height: 10 }, { width: 280, height: 400 }]) {
    f.frame(geometry);
    assertBase(f);
  }
  assert.equal(f.reads(), 0);
  f.cleanup();
});

test("every zoom entry and round trip keeps the same base without viewport subscriptions", () => {
  for (const sequence of [[5,4,3,2,1,5], [1,2,3,4,5,1], [3,1,5,2,3]]) {
    const f = videoFixture();
    for (const zoom of sequence) {
      f.frame({ width: 360 / zoom, height: 800 / zoom });
      assertBase(f);
    }
    assert.equal(f.reads(), 0);
    f.cleanup();
  }
});

test("trailer cycles restore the same rectangle synchronously with one observer", () => {
  const f = videoFixture();
  for (let cycle = 0; cycle < 10; cycle++) {
    assert.equal(f.observers(), 1);
    f.trailer(true);
    assert.equal(f.observers(), 0);
    assert.equal(f.video.style.cssText, "max-height:288px");
    f.wrapper.style.width = "10px";
    f.wrapper.style.height = "18px";
    f.trailer(false);
    assertBase(f);
  }
  f.cleanup();
  assert.equal(f.observers(), 0);
});

test("late arriving video cards receive the definitive size before their first paint", () => {
  const f = videoFixture({ hasVideo: false });
  assert.equal(f.wrapper.style.width, undefined);
  f.addVideo();
  assertBase(f);
  f.cleanup();
});

test("desktop and disabled sizing preserve native geometry", () => {
  const f = videoFixture({ enabled: false });
  assert.equal(f.wrapper.style.width, undefined);
  assert.equal(f.video.style.cssText, "max-height:288px");
  assert.equal(f.observers(), 0);
  assert.equal(f.reads(), 0);
});

test("normal mobile keeps existing hook scope and reaction pill placement", () => {
  const page = readFileSync("app/movies/[id]/page.tsx", "utf8");
  assert.match(page, /useDetailVideoSpace\(videoGateAnchorRef, mobileViewport && active, trailerCompanionOpen\)/);
  assert.match(page, /className=\{!trailerCompanionOpen && mobileViewport \? "absolute right-2 top-2 z-20" : "pointer-events-none absolute left-2 top-2/);
});


// Evaluate the actual CSS width expression emitted by the hook for test viewport
// and containing-block sizes. This also rejects an accidental fixed-pixel cap.
function renderedRectangle(parentWidth, viewportHeight, safeTop = 0, safeBottom = 0) {
  const expression = DETAIL_VIDEO_WIDTH
    .replace("100%", String(parentWidth))
    .replace("100svh", String(viewportHeight))
    .replace("env(safe-area-inset-top, 0px)", String(safeTop))
    .replace("env(safe-area-inset-bottom, 0px)", String(safeBottom))
    .replaceAll("px", "")
    .replaceAll("min(", "Math.min(")
    .replaceAll("max(", "Math.max(")
    .replaceAll("calc(", "(");
  const width = vm.runInNewContext(expression);
  return { width, height: width * 16 / 9 };
}

test("rendered video fills the maximum safe rectangle instead of being capped by the reference", () => {
  for (const [width, height, top, bottom] of [
    [260, 640, 0, 0], [300, 720, 0, 0], [340, 800, 0, 0],
    [380, 880, 0, 0], [420, 960, 0, 0], [480, 1080, 24, 34],
    [100, 960, 0, 0],
  ]) {
    const availableHeight = height - 462 - top - bottom;
    const size = renderedRectangle(width, height, top, bottom);
    assert.ok(size.width <= width);
    assert.ok(size.height <= availableHeight + 1e-9);
    assert.equal(size.width / size.height, 9 / 16);
    assert.ok(Math.abs(size.width - width) < 1e-9 || Math.abs(size.height - availableHeight) < 1e-9,
      "one safe boundary must be filled");
    if (width >= 260 && height > 640) assert.ok(size.height > DETAIL_VIDEO_BASE.height);
  }
});

test("same zoom and safe area give identical final dimensions across mounts and trailer cycles", () => {
  for (const viewport of [[300,720], [320,780], [360,840], [390,900], [420,960]]) {
    const expected = renderedRectangle(...viewport);
    assert.ok(expected.height > 178);
    for (let mount = 0; mount < 30; mount++) {
      const f = videoFixture();
      assertBase(f);
      assert.deepEqual(renderedRectangle(...viewport), expected);
      f.trailer(true);
      f.trailer(false);
      assertBase(f);
      assert.deepEqual(renderedRectangle(...viewport), expected);
      f.cleanup();
    }
  }
});
