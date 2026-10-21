import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('components/AutoReturnHorizontalScroll.tsx', 'utf8');
function mount({ width = 100, content = 200, reduced = false, mobile = true } = {}) {
  const listeners = new Map();
  const timers = new Map();
  const calls = [];
  let cleanup;
  let nextTimer = 0;
  let observerDisconnected = false;
  const node = { children: [], dataset: {}, clientWidth: width, scrollWidth: content, scrollLeft: 0,
    matches: () => false, querySelector: () => null,
    addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key),
    scrollTo: options => { calls.push(options); node.scrollLeft = options.left; },
  };
  const media = { matches: mobile, addEventListener() {}, removeEventListener() {} };
  const exports = {};
  const context = { exports, require: name => name === 'react' ? {
    useRef: () => ({ current: node }), useEffect: fn => { cleanup = fn(); },
  } : { jsx: () => null },
    window: { matchMedia: query => query.includes('reduced-motion') ? { matches: reduced } : media, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) },
    document: { fonts: { ready: Promise.resolve() } },
    ResizeObserver: class { observe() {} disconnect() { observerDisconnected = true; } },
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout: (fn, delay) => { assert.equal(delay, 1500); timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: id => timers.delete(id),
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  exports.default({ children: null });
  return { node, timers, calls, listeners, cleanup: () => cleanup(), disconnected: () => observerDisconnected,
    fire: event => listeners.get(event)?.(), tick: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); } };
}

test('no overflow and desktop never create an interactive horizontal region', () => {
  for (const options of [{ width: 200, content: 100 }, { mobile: false }]) {
    const h = mount(options); assert.equal(h.node.dataset.overflow, 'false'); assert.equal(h.node.tabIndex, -1); h.cleanup();
  }
});
test('native scrolling returns after 1500 ms of inactivity and respects reduced motion', () => {
  for (const reduced of [false, true]) {
    const h = mount({ reduced }); h.node.scrollLeft = 80; h.fire('scroll'); h.tick();
    assert.equal(h.node.scrollLeft, 0); assert.equal(h.calls[0].behavior, reduced ? 'instant' : 'smooth'); h.cleanup();
  }
});
test('touch holds cancel the return; momentum restarts the timeout; internal taps are not intercepted', () => {
  const h = mount(); h.node.scrollLeft = 80; h.fire('scroll'); h.fire('touchstart'); assert.equal(h.timers.size, 0);
  h.fire('scroll'); assert.equal(h.timers.size, 0); h.fire('touchend'); assert.equal(h.timers.size, 1);
  h.fire('scroll'); assert.equal(h.timers.size, 1); assert.equal(h.listeners.has('click'), false);
  h.cleanup(); assert.equal(h.timers.size, 0); assert.equal(h.disconnected(), true);
});
test('tabs stay one row and compact cards are gated by measured geometry', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  assert.match(css, /profile-own-tabs > button[\s\S]*?flex-shrink: 0; white-space: nowrap/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(max-content, 1fr\)\)/);
  const adaptive = readFileSync('components/AdaptiveFeedInformation.tsx', 'utf8');
  assert.match(adaptive, /media.matches && \(overflow \|\| collision/);
  assert.match(adaptive, /snap-x snap-mandatory/);
});
