import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const providers = readFileSync("components/StreamingProviders.tsx", "utf8");
const parsed = ts.createSourceFile("providers.tsx", providers, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helper = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "fittingProviderCount");
const context = vm.createContext({});
vm.runInContext(ts.transpileModule(helper.getText(parsed), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const count = (width, total = 5) => context.fittingProviderCount(width, 36, 8, Array.from({ length: total + 1 }, (_, n) => n >= 10 ? 40 : 32));

test("provider rows reserve room for +n and independently adapt to real available width", () => {
  assert.equal(count(170), 3);
  assert.equal(count(208), 4);
  assert.equal(count(212), 5);
  assert.equal(count(100), 1);
  assert.equal(count(32), 0);
  assert.equal(count(170, 2), 2);
  assert.equal(count(170, 0), 0);
});

test("providers plus overflow indicator fit throughout narrow and wide widths", () => {
  for (let total = 1; total <= 25; total++) {
    for (let width = 40; width <= 450; width++) {
      const visible = count(width, total);
      const hidden = total - visible;
      const occupied = visible * 36 + Math.max(0, visible + (hidden > 0 ? 1 : 0) - 1) * 8 + (hidden > 0 ? hidden >= 10 ? 40 : 32 : 0);
      assert.ok(occupied <= width, `${total} providers in ${width}px`);
    }
  }
});

test("compact layout is opt-in on normal mobile Detail and retains existing control nodes", () => {
  const page = readFileSync("app/movies/[id]/page.tsx", "utf8");
  const card = readFileSync("components/MovieCard.tsx", "utf8");
  assert.match(page, /compactMobileDetail=\{isMobile && !trailerCompanionOpen\}/);
  assert.match(page, /adaptiveMobile=\{isMobile && !trailerCompanionOpen\}/);
  assert.match(card, /compactMobileDetail = false/);
  assert.match(card, /splitFeedActions && !compactMobileDetail/);
  const mobile = card.slice(card.indexOf("const mobileDetailCardContent"));
  assert.match(mobile, /mobileDetailRatingsRow\}[\s\S]*compactMobileDetail \? <div className="mt-auto">\{mobileTmdbLogo\}/);
  assert.match(mobile, /Available on[\s\S]*compactMobileDetail[\s\S]*ratingsActionsTmdbSlot/);
  assert.match(mobile, /creditsLoading[\s\S]*compactMobileDetail \? <div[^>]*>\{mobileDetailActions\}/);
  assert.match(mobile, /ActionsTruncatedText text=\{displayTitle\}/);
  assert.match(mobile, /ActionsTruncatedText text=\{displaySecondaryTitle\}/);
  assert.match(mobile, /truncatedPopover=\{compactMobileDetail\}/);
  assert.match(providers, /useLayoutEffect/);
  assert.match(providers, /new ResizeObserver\(measure\)/);
  assert.match(providers, /visibility: "hidden"/);
});
