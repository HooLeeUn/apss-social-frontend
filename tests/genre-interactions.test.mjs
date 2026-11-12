import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = path => readFileSync(path, "utf8");
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const genres = "Action, Animation, Comedy, Documentary, Drama, Horror, Musical, Sci-Fi";

// Use the repository's VM/hook fixtures to execute the real component handlers.
function fixture({ overflow = true, finePointer = true, revealOnHover = true } = {}) {
  const slots = [], pendingEffects = [], timers = new Map();
  let index = 0, nextTimer = 0, disconnected = false;
  const anchor = { scrollWidth: overflow ? 600 : 100, clientWidth: 100, scrollHeight: 20, clientHeight: 20, matches: () => true };
  const hooks = {
    useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useCallback: fn => fn,
    useEffect(fn, deps) {
      const i = index++;
      if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) {
        slots[i]?.cleanup?.();
        slots[i] = { deps };
        pendingEffects.push(() => { slots[i].cleanup = fn(); });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(compile(read("components/profile-feed/ActionsTruncatedText.tsx")), {
    exports,
    require: name => ({ react: hooks, "react/jsx-runtime": runtime, "next/link": { default: "Link" }, "./ActionsFloatingPanel": { default: "Panel" } })[name],
    window: { matchMedia: () => ({ matches: finePointer }) },
    document: { fonts: { addEventListener() {}, removeEventListener() {} } },
    ResizeObserver: class { observe() {} disconnect() { disconnected = true; } },
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const render = () => {
    index = 0;
    const tree = exports.default({ text: genres, popoverLabel: "Genres", className: "truncate", revealOnHover });
    tree.props.children[0].props.ref(anchor);
    pendingEffects.splice(0).forEach(fn => fn());
    return tree;
  };
  render();
  return {
    trigger: () => render().props.children[0].props,
    panel: () => render().props.children[1],
    flush: () => { const work = [...timers.values()]; timers.clear(); work.forEach(fn => fn()); },
    pendingTimers: () => timers.size,
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
    disconnected: () => disconnected,
  };
}
const pointer = (pointerType = "mouse", x = 0, y = 0) => ({ pointerType, clientX: x, clientY: y });
const click = () => ({ stopPropagation() {}, preventDefault() {} });

test("desktop hover opens the complete text without a click", () => {
  const f = fixture();
  f.trigger().onPointerEnter(pointer());
  assert.equal(f.panel().props.children.props.children, genres);
  assert.equal(f.trigger()["aria-expanded"], true);
});

test("crossing the gap to the panel does not flicker; leaving both closes it", () => {
  const f = fixture();
  f.trigger().onPointerEnter(pointer());
  f.trigger().onPointerLeave(pointer());
  assert.equal(f.pendingTimers(), 1);
  f.panel().props.onPointerEnter(pointer());
  f.flush();
  assert.ok(f.panel());
  f.panel().props.onPointerLeave(pointer());
  f.flush();
  assert.equal(f.panel(), null);
});

test("keyboard focus reveals the full text; blur and dismissal close it", () => {
  const f = fixture();
  assert.equal(f.trigger().role, "button");
  assert.equal(f.trigger().tabIndex, 0);
  f.trigger().onFocus({ currentTarget: { matches: () => true } });
  assert.ok(f.panel());
  f.trigger().onBlur(); f.flush();
  assert.equal(f.panel(), null);
  for (const key of ["Enter", " "]) {
    f.trigger().onKeyDown({ key, preventDefault() {} });
    assert.ok(f.panel());
    f.panel().props.onClose();
    assert.equal(f.panel(), null);
  }
});

test("simple touch toggles on phones, tablets and hybrid devices without hover", () => {
  for (const finePointer of [false, true]) {
    const f = fixture({ finePointer });
    f.trigger().onPointerEnter(pointer("touch"));
    f.trigger().onFocus({ currentTarget: { matches: () => false } });
    assert.equal(f.panel(), null);
    f.trigger().onPointerDown(pointer("touch"));
    f.trigger().onClick(click());
    assert.ok(f.panel());
    f.trigger().onPointerDown(pointer("touch"));
    f.trigger().onClick(click());
    assert.equal(f.panel(), null);
  }
});

test("swipes and cancelled pointers do not open a panel or cancel native scrolling", () => {
  const f = fixture();
  f.trigger().onPointerDown(pointer("touch"));
  f.trigger().onPointerMove(pointer("touch", 45, 2));
  f.trigger().onClick(click());
  assert.equal(f.panel(), null);
  f.trigger().onPointerDown(pointer("touch"));
  f.trigger().onPointerCancel();
  f.trigger().onClick(click());
  assert.equal(f.panel(), null);
  // A later simple tap still works.
  f.trigger().onPointerDown(pointer("touch"));
  f.trigger().onClick(click());
  assert.ok(f.panel());
});

test("fitting text and existing non-genre consumers do not acquire hover behavior", () => {
  const fitting = fixture({ overflow: false });
  fitting.trigger().onPointerEnter(pointer());
  fitting.trigger().onClick(click());
  assert.equal(fitting.panel(), null);
  assert.equal(fitting.trigger().role, undefined);
  const existing = fixture({ revealOnHover: false });
  for (const key of ["onPointerEnter", "onPointerLeave", "onFocus", "onPointerDown", "onPointerMove"]) assert.equal(existing.trigger()[key], undefined);
  existing.trigger().onClick(click());
  assert.ok(existing.panel());
});

test("genre panels do not close their parent search modal on mousedown", () => {
  const f = fixture();
  f.trigger().onClick(click());
  let stopped = false;
  f.panel().props.onMouseDown({ stopPropagation() { stopped = true; } });
  assert.ok(stopped);
});

test("unmount removes observers and pending hover timers", () => {
  const f = fixture();
  f.trigger().onPointerEnter(pointer());
  f.trigger().onPointerLeave(pointer());
  assert.equal(f.pendingTimers(), 1);
  f.unmount();
  assert.equal(f.pendingTimers(), 0);
  assert.ok(f.disconnected());
});

function descendants(node, ancestors = []) {
  if (!node || typeof node !== "object") return [];
  const children = [node.props?.children].flat(Infinity);
  return [{ node, ancestors }, ...children.flatMap(child => descendants(child, [...ancestors, node]))];
}

test("favorite search selection and complete genre trigger are siblings, including while saving", () => {
  const source = read("components/profile-feed/FavoriteMoviesBlock.tsx");
  const row = source.slice(source.indexOf("const FavoriteSearchResultRow ="), source.indexOf("function FavoriteSearchModal("));
  const Component = new Function("exports", "require", "memo", "useI18n", "compactMetadataValue", "ActionsTruncatedText", `${compile(row)}; return FavoriteSearchResultRow;`)(
    {}, () => runtime, fn => fn, () => ({ t: value => value }), value => value ?? "", "Genre",
  );
  let selected = null;
  const movie = { id: 1, displayTitle: "Test", year: "2024", contentType: "Movie", genres: genres.split(", "), castMembers: [] };
  for (const savingMovieId of [null, "1"]) {
    const tree = Component({ movie, savingMovieId, onSelect: value => { selected = value; } });
    const nodes = descendants(tree);
    const selection = nodes.find(({ node }) => node.type === "button").node;
    const genre = nodes.find(({ node }) => node.type === "Genre");
    assert.equal(selection.props.disabled, Boolean(savingMovieId));
    assert.equal(genre.node.props.text, genres);
    assert.equal(genre.node.props.revealOnHover, true);
    assert.match(genre.node.props.className, /pointer-events-none.*\[&\[role=button\]\]:pointer-events-auto/);
    assert.ok(genre.ancestors.every(node => node.type !== "a" && node.type !== "button"));
    if (!savingMovieId) selection.props.onClick();
    assert.equal(selected, movie);
    assert.match(tree.props.className, /grid-cols-\[44px_minmax\(0,1.25fr\)_minmax\(0,0.78fr\)_minmax\(0,1fr\)\]/);
  }
});

test("feed metadata reserves the pinned actions' width without moving the actions", () => {
  const card = read("components/MovieCard.tsx");
  const css = read("components/MovieCardWatchlist.module.css");
  assert.match(card, /metadataHasPinnedControls = isFeed && \(highlightMyRatingSlot \|\| pinInteractionIconsToMetadataRow\) && !showExtendedMetadata/);
  assert.equal(card.match(/metadataHasPinnedControls \? watchlistStyles.reservedMetadataLine/g)?.length, 2);
  assert.match(card, /\{metadataHasPinnedControls \? \(\s*<div\s*className="interaction-icons absolute right-2 top-\[4.85rem\] z-10"/);
  assert.match(css, /\.reservedMetadataLine \{\s*margin-right: 80px;/);
  assert.match(css, /\[data-watchlist-tall="true"\] \.reservedMetadataLine \{\s*margin-right: 0;/);
  // Spans retain truncation in the tall mode, whose wrapping overrides target p/a/h3.
  assert.match(card, /<ActionsTruncatedText as="span" revealOnHover text=\{genresLine\}[^\n]*block min-w-0 max-w-full truncate/);
});

test("the generic card's navigation link is separate from its interactive content", () => {
  const card = read("components/MovieCard.tsx");
  assert.match(card, /<Link href=\{detailHref\} aria-label=\{`Ver detalle de \$\{displayTitle\}`\} className="absolute inset-0[^\n]+\/>/);
  assert.doesNotMatch(card, /<Link[^>]+>\s*\{mobileDetailCardContent\}\s*<\/Link>/);
  assert.match(card, /\[&_\[role=button\]\]:pointer-events-auto/);
  assert.match(card, /onTouchStart: handlePosterTouchStart/);
  for (const file of ["WeeklyHeroCard", "WeeklyMiniCard"]) assert.match(read(`components/${file}.tsx`), /trailerLongPress.posterProps/);
  assert.match(read("components/WeeklyMiniCard.tsx"), /<DesktopOverflowTicker/);
});
