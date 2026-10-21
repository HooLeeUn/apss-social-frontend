import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('hooks/useWatchlistCardLayout.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const rect = (left, right, top = 0, bottom = 24) => ({ left, right, top, bottom, width: right - left, height: bottom - top });
function fixture({ right = 310, synopsisRight = 290, mineRight = 232, paintedMineRight = mineRight, iconRight = 310 } = {}) {
  const node = (bounds, painted = bounds) => ({ getBoundingClientRect: () => bounds, painted });
  const controls = {
    '[data-tour="feed-card-rating-overall"]': node(rect(110, 140)),
    '[data-tour="feed-card-rating-following"]': node(rect(150, 180)),
    '[data-tour="feed-card-rating-mine"]': node(rect(190, mineRight), rect(190, paintedMineRight)),
    '[data-tour="feed-card-synopsis"]': node(rect(synopsisRight - 32, synopsisRight)),
  };
  const row = { getBoundingClientRect: () => rect(100, right), querySelector: key => controls[key] ?? null };
  const card = { dataset: {}, getBoundingClientRect: () => rect(0, right), querySelector: key => key === '[data-watchlist-ratings]' ? row : key === '[data-watchlist-body]' ? node(rect(88, right + 10)) : key.includes('.interaction-icons') ? node(rect(iconRight - 64, iconRight, 50, 80)) : null };
  return { card, controls };
}
function load(card, { enabled = true, mobile = true } = {}) {
  const exports = {};
  const callbacks = new Map();
  let cleanup, disconnected = 0, observer, mutation, nextFrame = 0;
  const frames = new Map();
  const flushFrame = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const fn of pending) fn();
  };
  const context = {
    exports, require: () => ({ useRef: () => ({ current: card }), useLayoutEffect: fn => { cleanup = fn(); } }),
    getComputedStyle: () => ({ paddingLeft: '10', paddingRight: '10' }),
    document: { createRange: () => { let selected; return { selectNodeContents: el => { selected = el; }, getClientRects: () => [selected.painted] }; }, fonts: { addEventListener: (key, fn) => callbacks.set('fonts', fn), removeEventListener() {}, ready: new Promise(() => {}) } },
    window: { matchMedia: () => ({ matches: mobile, addEventListener: (key, fn) => callbacks.set('media', fn), removeEventListener() {} }), addEventListener: (key, fn) => callbacks.set(key, fn), removeEventListener: key => callbacks.delete(key) },
    ResizeObserver: class { constructor(fn) { observer = fn; } observe() {} disconnect() { disconnected++; } },
    MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} disconnect() { disconnected++; } },
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame: id => frames.delete(id),
  };
  vm.runInNewContext(compiled, context);
  return { measure: () => exports.watchlistNeedsTallLayout(card), mount: () => exports.useWatchlistCardLayout(enabled),
    resize: () => { callbacks.get('resize')?.(); flushFrame(); flushFrame(); },
    observeResize: () => observer?.(), mutate: () => mutation?.(), flushFrame, pendingFrames: () => frames.size,
    cleanup: () => cleanup?.(), disconnected: () => disconnected, callbacks };
}

test('normal and intermediate available widths keep the existing layout; empty reserved space is ignored', () => {
  for (const right of [390, 330, 300]) assert.equal(load(fixture({ right, synopsisRight: 290 }).card).measure(), false);
});
test('real clipping of synopsis or my rating activates the taller layout', () => {
  assert.equal(load(fixture({ right: 270 }).card).measure(), true);
  assert.equal(load(fixture({ right: 250, mineRight: 260, synopsisRight: 180 }).card).measure(), true);
});
test('overlapping rating content, overflowing painted text and tag/ticket overflow activate adaptation', () => {
  assert.equal(load(fixture({ mineRight: 270 }).card).measure(), true);
  assert.equal(load(fixture({ paintedMineRight: 320 }).card).measure(), true);
  assert.equal(load(fixture({ iconRight: 335 }).card).measure(), true);
});
test('measurement tolerates subpixel edges and missing optional metadata', () => {
  assert.equal(load(fixture({ right: 300, synopsisRight: 290.5 }).card).measure(), false);
  assert.equal(load({ querySelector: () => null }).measure(), false);
});
test('only opted-in mobile cards change layout, and widening restores normal mode without oscillation', () => {
  const { card } = fixture({ right: 270 });
  const h = load(card); h.mount(); assert.equal(card.dataset.watchlistTall, 'true');
  h.resize(); assert.equal(card.dataset.watchlistTall, 'true');
  const fitting = fixture({ right: 350 }).card;
  card.querySelector = fitting.querySelector;
  h.resize(); assert.equal(card.dataset.watchlistTall, 'false');
  h.cleanup(); assert.equal(card.dataset.watchlistTall, undefined); assert.equal(h.disconnected(), 2);
  for (const options of [{ enabled: false }, { mobile: false }]) {
    const card = fixture({ right: 270 }).card;
    const h = load(card, options); h.mount(); assert.notEqual(card.dataset.watchlistTall, 'true'); h.cleanup();
  }
});
test('the opt-in belongs only to Tu cartelera and the tall CSS keeps poster left and ratings below', () => {
  const page = readFileSync('app/feed/page.tsx', 'utf8');
  const css = readFileSync('components/MovieCardWatchlist.module.css', 'utf8');
  assert.equal(page.match(/adaptMainWatchlist/g)?.length, 1);
  assert.match(page, /visiblePersonalizedMovies\.map[\s\S]*?adaptMainWatchlist/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /grid-template-columns: 108px minmax\(0, 1fr\)/);
  assert.match(css, /\[data-watchlist-ratings\][\s\S]*?grid-column: 1 \/ -1;[\s\S]*?grid-row: 2/);
  assert.match(css, /position: static/);
  assert.doesNotMatch(css, /overflow-x|scroll-snap|overflow: hidden/);
  assert.doesNotMatch(source, /AutoReturn|scrollTo|touchstart|pointerdown/);
});


test('the initial mode is committed and revealed before the first paint, without a deferred frame', () => {
  for (const right of [270, 350]) {
    const { card } = fixture({ right });
    const h = load(card); h.mount();
    assert.equal(card.dataset.watchlistTall, right === 270 ? 'true' : 'false');
    assert.equal(card.dataset.watchlistReady, 'true');
    assert.equal(h.pendingFrames(), 0);
    h.cleanup();
    assert.equal(card.dataset.watchlistReady, undefined);
  }
  const css = readFileSync('components/MovieCardWatchlist.module.css', 'utf8');
  assert.match(css, /\.watchlist:not\(\[data-watchlist-ready="true"\]\)\s*\{\s*visibility: hidden;/);
  assert.match(source, /useLayoutEffect\(\(\) =>/);
});

test('a pending change keeps the previous mode at every paint until two matching measurements', () => {
  const { card } = fixture({ right: 350 });
  const h = load(card); h.mount();
  card.querySelector = fixture({ right: 270 }).card.querySelector;
  h.callbacks.get('resize')();
  assert.equal(card.dataset.watchlistTall, 'false');
  h.flushFrame();
  assert.equal(card.dataset.watchlistTall, 'false');
  h.flushFrame();
  assert.equal(card.dataset.watchlistTall, 'true');
  card.querySelector = fixture({ right: 350 }).card.querySelector;
  h.callbacks.get('resize')(); h.flushFrame();
  assert.equal(card.dataset.watchlistTall, 'true');
  h.flushFrame();
  assert.equal(card.dataset.watchlistTall, 'false');
  h.cleanup();
});

test('consecutive measurements near the existing overflow threshold do not oscillate', () => {
  for (const initialRight of [270, 350]) {
    const { card } = fixture({ right: initialRight });
    const h = load(card); h.mount();
    const initialMode = card.dataset.watchlistTall;
    for (const right of [298.9, 299.1, 298.9, 299.1, 298.9, 299.1]) {
      card.querySelector = fixture({ right }).card.querySelector;
      h.callbacks.get('resize')(); h.flushFrame();
      assert.equal(card.dataset.watchlistTall, initialMode);
    }
    card.querySelector = fixture({ right: 350 }).card.querySelector;
    h.callbacks.get('resize')(); h.flushFrame(); h.flushFrame();
    assert.equal(card.dataset.watchlistTall, 'false');
    h.cleanup();
  }
});

test('resize and content/font events coalesce; height-only observer notifications do not loop', () => {
  const { card } = fixture({ right: 270 });
  const h = load(card); h.mount();
  h.observeResize();
  assert.equal(h.pendingFrames(), 0);
  for (let i = 0; i < 10; i++) {
    h.callbacks.get('resize')(); h.mutate(); h.callbacks.get('fonts')();
  }
  assert.equal(h.pendingFrames(), 1);
  h.flushFrame();
  assert.equal(card.dataset.watchlistTall, 'true');
  assert.equal(h.pendingFrames(), 0);
  h.callbacks.get('resize')();
  h.cleanup();
  assert.equal(h.pendingFrames(), 0);
  h.callbacks.get('fonts')();
  assert.equal(h.pendingFrames(), 0);
});
