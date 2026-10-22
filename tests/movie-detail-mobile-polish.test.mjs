import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const card = readFileSync("components/MovieCard.tsx", "utf8");
const page = readFileSync("app/movies/[id]/page.tsx", "utf8");

function measureCredits(width, names = [100, 70], options = {}) {
  const parsed = ts.createSourceFile("card.tsx", card, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "CastLine");
  const code = ts.transpileModule(fn.getText(parsed), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const bounds = width => ({ getBoundingClientRect: () => ({ width }) });
  const row = bounds(width);
  const measured = { querySelector: key => bounds(key.includes("label") ? 40 : 30), querySelectorAll: () => names.map(bounds) };
  const refs = [row, measured, null, null];
  let refIndex = 0, chosen;
  const context = vm.createContext({
    exports: {},
    require: () => ({ jsx: () => null, jsxs: () => null }),
    useI18n: () => ({ locale: "es" }),
    useRef: () => ({ current: refs[refIndex++] }),
    useState: initial => [initial, value => { chosen = value; }],
    useEffect() {}, useLayoutEffect: fn => fn(),
    DESKTOP_CAST_MAX_ROWS: 3,
    window: { addEventListener() {}, removeEventListener() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    PersonName: () => null,
  });
  vm.runInContext(code, context);
  context.CastLine({ label: "Casting", people: names.map((_, i) => ({ name: `Person ${i}` })), cache: {}, onEnsureDetail() {}, isFeed: true, adaptiveMobile: true, ...options });
  return chosen;
}

test("narrow credit rows group long names into +n rather than overflowing", () => {
  assert.equal(measureCredits(90), 0);
  assert.equal(measureCredits(200), 1);
  assert.equal(measureCredits(300), 2);
  assert.equal(measureCredits(90, [100], { singleLine: true, maxVisibleCount: 1 }), 0);
  assert.equal(measureCredits(300, [100, 70], { singleLine: true, maxVisibleCount: 1 }), 1);
});

test("normal mobile scopes compact spacing and stable bottom controls", () => {
  assert.match(page, /data-normal-mobile-detail=\{isMobile && !trailerCompanionOpen/);
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\[data-normal-mobile-detail="true"\] \[data-mobile-comment-tabs\] \[role="tab"\][^}]*white-space: nowrap/);
  assert.match(card, /compactMobileDetail \? "flex h-full flex-col gap-1/);
  assert.match(card, /className="mt-auto">\{mobileTmdbLogo\}/);
  assert.match(card, /min-h-0 min-w-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden/);
  assert.match(card, /flex shrink-0 justify-center pb-1">\{mobileDetailActions\}/);
  assert.match(card, /fixedVisibleCount=\{compactMobileDetail \? undefined : MOBILE_CAST_VISIBLE_LIMIT\}/);
});

test("country portal and tapped availability explanation reuse viewport-safe panels only when opted in", () => {
  assert.match(page, /portalMenu=\{isMobile && !trailerCompanionOpen\}/);
  const country = readFileSync("components/StreamingCountrySelector.tsx", "utf8");
  assert.match(country, /portalMenu = false/);
  assert.match(country, /menuRef.current\?\.contains\(event.target\)/);
  assert.match(country, /isOpen \? portalMenu \? <ActionsFloatingPanel[^>]*repositionOnResize/);
  const providers = readFileSync("components/StreamingProviders.tsx", "utf8");
  assert.match(providers, /if \(mobilePopover\) return/);
  assert.match(providers, /mobilePopover=\{adaptiveMobile\}/);
  assert.match(providers, /<ActionsFloatingPanel[^>]*label=\{tooltip\}/);
});

test("normal mobile reactions overlay the video while trailer and desktop retain their controls", () => {
  assert.match(page, /className=\{!trailerCompanionOpen && mobileViewport \? "hidden" : "shrink-0 xl:hidden"\}/);
  assert.match(page, /className=\{!trailerCompanionOpen && mobileViewport \? "absolute right-2 top-2 z-20/);
  assert.match(page, /if \(trailerCompanionOpen \|\| !mobileViewport\) selectHistoryVideoForReaction/);
  assert.match(page, /toggleHistorySound\(id\)/);
  assert.match(page, /openExpandedVideo\(id\)/);
});
