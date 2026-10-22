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
const { DETAIL_VIDEO_BASE, fitDetailVideo, detailVideoAvailableHeight } = reference;
const hook = compile("hooks/useDetailVideoSpace.ts");

function videoFixture({ enabled = true, height = 960, width = 340, top = 450, scroll = 0, hasVideo = true } = {}) {
  let cleanup, mutation, resizeCallback, mutations = 0, resizes = 0;
  const observed = new Set();
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
  const header = { getBoundingClientRect: () => ({ height: 36 }) };
  const sticky = { getBoundingClientRect: () => ({ height: 320 }) };
  const group = {};
  const card = { padding: 10 };
  const section = { padding: 16 };
  const slot = { get clientWidth() { return width; }, previousElementSibling: header,
    getBoundingClientRect: () => ({ top: 100 + top - scroll }) };
  const wrapper = { style: style(), parentElement: slot };
  const video = { style: style("max-height:288px"), parentElement: wrapper,
    closest: () => card };
  const viewport = { get clientHeight() { return height; }, get scrollTop() { return scroll; },
    padding: 12, getBoundingClientRect: () => ({ top: 100 }),
    querySelector: selector => selector.includes("sticky") ? sticky : { parentElement: group } };
  const root = { querySelectorAll: () => hasVideo ? [video] : [],
    closest: selector => selector.includes("content") ? viewport : section };
  const exports = {};
  vm.runInNewContext(hook, {
    exports,
    require: name => name === "react" ? {
      useLayoutEffect: fn => { cleanup?.(); cleanup = fn(); },
    } : reference,
    getComputedStyle: element => ({ paddingBottom: String(element.padding ?? 0) }),
    window: new Proxy({}, { get() { throw Error("Unexpected viewport listener or timer"); } }),
    document: new Proxy({}, { get() { throw Error("Unexpected calibration document"); } }),
    ResizeObserver: class {
      constructor(fn) { resizeCallback = fn; resizes++; }
      observe(element) { assert.ok(!observed.has(element), "no duplicated observation"); observed.add(element); }
      disconnect() { observed.clear(); resizes--; }
    },
    MutationObserver: class {
      constructor(fn) { mutation = fn; }
      observe() { mutations++; }
      disconnect() { mutations--; }
    },
  });
  const rootRef = { current: root };
  exports.useDetailVideoSpace(rootRef, enabled);
  return { video, wrapper, observers: () => [resizes, mutations],
    resize(next = {}) {
      height = next.height ?? height; width = next.width ?? width; top = next.top ?? top;
      resizeCallback?.();
    },
    scroll(value) { scroll = value; },
    mutate() { mutation?.(); },
    addVideo() { hasVideo = true; mutation?.(); },
    trailer(open) { exports.useDetailVideoSpace(rootRef, enabled, open); },
    cleanup() { cleanup?.(); },
  };
}

function sizeOf(f) {
  const width = parseFloat(f.wrapper.style.width);
  return { width, height: width * 16 / 9 };
}

function assertFit(f, width, height, top) {
  const expected = fitDetailVideo(width, height - top - 38);
  assert.equal(f.wrapper.style.width, `${expected.width}px`);
  assert.equal(f.wrapper.style.aspectRatio, "9 / 16");
  assert.equal(f.wrapper.style.height, "auto");
  assert.equal(f.wrapper.style.visibility, "");
  assert.equal(f.video.style.position, "absolute");
  assert.equal(f.video.style.height, "100%");
  return sizeOf(f);
}

test("fixed ideal is never reduced or replaced by live safety constraints", () => {
  assert.ok(Object.isFrozen(DETAIL_VIDEO_BASE));
  const initial = JSON.stringify(DETAIL_VIDEO_BASE);
  const f = videoFixture();
  const expected = assertFit(f, 340, 960, 450);
  for (let frame = 0; frame < 30; frame++) f.resize({ width: 1, height: 500, top: 450 });
  f.resize({ width: 340, height: 960, top: 450 });
  assert.deepEqual(sizeOf(f), expected);
  assert.equal(JSON.stringify(DETAIL_VIDEO_BASE), initial);
  f.cleanup();
});

test("real available space replaces the fixed 462px reserve; zoom has no additional penalty", () => {
  // Zoom changes CSS viewport and upper layout. Only actual remaining space matters.
  const scenarios = [
    { width: 340, height: 960, top: 424 },
    { width: 330, height: 900, top: 410 },
    { width: 320, height: 850, top: 370 },
    { width: 310, height: 800, top: 330 },
    { width: 300, height: 760, top: 300 },
  ];
  const first = scenarios[0];
  const oldZoom1Height = first.height - 462;
  for (const scenario of scenarios) {
    const { width, height, top } = scenario;
    const f = videoFixture(scenario);
    const size = assertFit(f, width, height, top);
    const available = height - top - 38;
    if (scenario === first) assert.equal(size.height, oldZoom1Height, "preserve approved Zoom 1 when its real fit is unchanged");
    assert.ok(size.width <= width + 1e-9);
    assert.ok(size.height <= available + 1e-9);
    assert.ok(Math.abs(size.height - available) < 1e-9 || Math.abs(size.width - width) < 1e-9 || size.height === DETAIL_VIDEO_BASE.height);
    assert.ok(size.height >= oldZoom1Height * 0.84, "small reductions only when actual bounds require them");
    assert.equal(size.height, Math.min(DETAIL_VIDEO_BASE.height, available, width * 16 / 9));
    f.cleanup();
  }
});

test("40 remounts and trailer cycles reproduce the same fit for each layout", () => {
  for (const scenario of [{ width: 340, height: 960, top: 450 }, { width: 300, height: 760, top: 300 }]) {
    let expected;
    for (let mount = 0; mount < 40; mount++) {
      const f = videoFixture(scenario);
      expected ??= sizeOf(f);
      assert.deepEqual(sizeOf(f), expected);
      assert.deepEqual(f.observers(), [1, 1]);
      f.trailer(true);
      assert.deepEqual(f.observers(), [0, 0]);
      assert.equal(f.video.style.cssText, "max-height:288px");
      f.trailer(false);
      assert.deepEqual(sizeOf(f), expected);
      assert.deepEqual(f.observers(), [1, 1]);
      f.cleanup();
      assert.deepEqual(f.observers(), [0, 0]);
    }
  }
});

test("zoom round trips restore the exact same size without a remembered minimum", () => {
  const f = videoFixture();
  const initial = sizeOf(f);
  for (let cycle = 0; cycle < 5; cycle++) {
    f.resize({ width: 300, height: 760, top: 300 });
    assertFit(f, 300, 760, 300);
    f.resize({ width: 340, height: 960, top: 450 });
    assert.deepEqual(sizeOf(f), initial);
  }
  f.cleanup();
});

test("zero layout stays hidden and later dimensions recover without caching an invalid base", () => {
  const f = videoFixture({ width: 0, height: 0 });
  assert.equal(f.wrapper.style.visibility, "hidden");
  assert.equal(f.wrapper.style.width, undefined);
  for (let frame = 0; frame < 30; frame++) f.resize();
  f.resize({ width: 340, height: 960 });
  assertFit(f, 340, 960, 450);
  f.cleanup();
});

test("scroll and unrelated DOM updates do not resize the video", () => {
  const f = videoFixture();
  const initial = sizeOf(f);
  for (const offset of [100, 350, 0, 200]) {
    f.scroll(offset);
    f.mutate();
    f.resize();
    assert.deepEqual(sizeOf(f), initial);
  }
  assert.equal(detailVideoAvailableHeight(960, 350, 100, 200, 38), 472);
  f.cleanup();
});

test("maximum fit preserves aspect ratio and stays within width, height and ideal", () => {
  for (const width of [80, 150, 240, 320, 500]) {
    for (const height of [60, 180, 300, 450, 700]) {
      const rect = fitDetailVideo(width, height);
      assert.ok(rect.width <= width + 1e-9);
      assert.ok(rect.height <= height + 1e-9);
      assert.ok(rect.height <= DETAIL_VIDEO_BASE.height);
      assert.equal(rect.width / rect.height, 9 / 16);
      assert.ok(Math.abs(rect.width - width) < 1e-9 || Math.abs(rect.height - height) < 1e-9 || rect.height === DETAIL_VIDEO_BASE.height);
    }
  }
  for (const [width, height] of [[0, 300], [300, 0], [NaN, 100], [100, Infinity], [100, -10]]) {
    assert.equal(fitDetailVideo(width, height), null);
  }
});

test("late video cards are fitted synchronously and desktop stays untouched", () => {
  const f = videoFixture({ hasVideo: false });
  assert.equal(f.wrapper.style.width, undefined);
  f.addVideo();
  assertFit(f, 340, 960, 450);
  f.cleanup();
  const desktop = videoFixture({ enabled: false });
  assert.equal(desktop.wrapper.style.width, undefined);
  assert.deepEqual(desktop.observers(), [0, 0]);
});

test("normal mobile keeps existing hook scope and reaction pill placement", () => {
  const page = readFileSync("app/movies/[id]/page.tsx", "utf8");
  assert.match(page, /useDetailVideoSpace\(videoGateAnchorRef, mobileViewport && active, trailerCompanionOpen\)/);
  assert.match(page, /className=\{!trailerCompanionOpen && mobileViewport \? "absolute right-2 top-2 z-20" : "pointer-events-none absolute left-2 top-2/);
});
