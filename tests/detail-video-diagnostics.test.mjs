import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile = path => ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const referenceCode = compile("hooks/detailVideoReference.ts");
const hookCode = compile("hooks/useDetailVideoSpace.ts");

function fixture(env, markerTop = 450) {
  const logs = [];
  const console = { info(prefix, json) {
    assert.equal(prefix, "[detail-video-calibration]");
    logs.push(JSON.parse(json));
  }, error() {} };
  const window = { innerWidth: 360, innerHeight: 800,
    visualViewport: { width: 360, height: 760, addEventListener() {}, removeEventListener() {} },
    addEventListener() {}, removeEventListener() {} };
  const marker = { style: {}, replaceChildren() {},
    getBoundingClientRect: () => ({ top: markerTop, width: 0, height: 0 }),
    parentElement: { clientWidth: 200 } };
  const clone = { querySelectorAll: () => [], querySelector: () => ({ parentElement: marker }) };
  const doc = { open() {}, write() {}, close() {},
    documentElement: { clientWidth: 320, clientHeight: 640 },
    head: { appendChild() {} }, body: { className: "", appendChild() {} },
    createElement: () => ({ style: {} }), fonts: { ready: Promise.resolve() } };
  const frame = { style: {}, setAttribute() {}, contentDocument: doc,
    contentWindow: { innerWidth: 320, innerHeight: 640, getComputedStyle: () => ({ paddingBottom: "0" }) }, remove() {} };
  const reference = {};
  vm.runInNewContext(referenceCode, {
    exports: reference, process: { env }, window, console,
    document: { createElement: () => frame, documentElement: { lang: "es", className: "" },
      body: { className: "", appendChild() {} }, styleSheets: [] },
  });
  const wrapper = { style: { cssText: "" } };
  const video = { style: { cssText: "" }, parentElement: wrapper };
  const root = { querySelector: () => video, querySelectorAll: () => [video],
    closest: () => ({ cloneNode: () => clone }) };
  let calibration, cleanup;
  const hook = {};
  vm.runInNewContext(hookCode, {
    exports: hook, window, console,
    require: name => name === "react" ? {
      useRef: initial => calibration ??= { current: initial },
      useLayoutEffect: fn => { cleanup?.(); cleanup = fn(); },
    } : reference,
    MutationObserver: class { observe() {} disconnect() {} },
  });
  const rootRef = { current: root };
  return { logs, reference, root, wrapper, calibration: () => calibration.current,
    run: suspended => hook.useDetailVideoSpace(rootRef, true, suspended),
    cleanup: () => cleanup?.() };
}

test("diagnostics are silent and snapshots are not evaluated in production", () => {
  const f = fixture({ NODE_ENV: "production" });
  f.reference.logDetailVideoCalibration("probe", () => { throw Error("must not run"); });
  assert.equal(f.reference.detailVideoDiagnosticId({}), "");
  assert.deepEqual(f.logs, []);
});

test("development and staging log immutable snapshots", () => {
  for (const env of [{ NODE_ENV: "development" }, { NODE_ENV: "production", NEXT_PUBLIC_APP_ENV: "staging" }]) {
    const f = fixture(env);
    const value = { width: 100 };
    f.reference.logDetailVideoCalibration("probe", () => ({ value }));
    value.width = 1;
    assert.equal(f.logs[0].value.width, 100);
    assert.ok(f.logs[0].timestamp);
  }
});

test("correct and tiny fits retain their original sizes and record the exact value saved as base", async () => {
  for (const top of [450, 627]) {
    const f = fixture({ NODE_ENV: "development" }, top);
    f.run(false);
    await new Promise(resolve => setImmediate(resolve));
    const measured = f.logs.find(log => log.event === "reference-measured");
    const fit = f.logs.find(log => log.event === "fit-result");
    const stored = f.logs.find(log => log.event === "base-stored");
    const start = f.logs.find(log => log.event === "measure-start");
    assert.equal(start.innerWidth, 360);
    assert.equal(start.innerHeight, 800);
    assert.equal(start.visualViewportWidth, 360);
    assert.equal(start.visualViewportHeight, 760);
    assert.equal(measured.referenceDocumentWidth, 320);
    assert.equal(measured.referenceDocumentHeight, 640);
    assert.equal(measured.markerTop, top);
    assert.equal(measured.markerWidth, 0);
    assert.equal(measured.markerHeight, 0);
    assert.equal(measured.markerParentClientWidth, 200);
    assert.equal(measured.safeBottom, 0);
    assert.equal(measured.availableHeight, 628 - top);
    assert.equal(measured.limitingAxis, "height");
    assert.deepEqual(fit.result, { width: (628 - top) * 9 / 16, height: 628 - top });
    assert.deepEqual(stored.base, fit.result);
    assert.equal(stored.calibrationId, fit.calibrationId);
    assert.equal(stored.calibrationId, start.calibrationId);
    assert.equal(f.wrapper.style.height, `${628 - top}px`);
    assert.equal(f.calibration().base.height, 628 - top);
    f.run(true);
    f.run(false);
    assert.equal(f.logs.filter(log => log.event === "measure-start").length, 1);
    assert.ok(f.logs.some(log => log.event === "base-reused" && log.instanceId === stored.instanceId));
    f.cleanup();
  }
});
