import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("country/language changes do not re-run the movie initialization effect or remount its carousel", () => {
  const source = readFileSync("app/movies/[id]/page.tsx", "utf8");
  const parsed = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let dependencies;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(parsed) === "useEffect" && node.arguments[0]?.getText(parsed).includes("setMovie(null)")) dependencies = node.arguments[1].getText(parsed);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(dependencies);
  assert.doesNotMatch(dependencies, /\blocale\b|\bcountry\b|\bt\b/);
  assert.match(dependencies, /movieId/);
  assert.match(source, /translateLoadError = useEffectEvent/);
  const stable = { authHydrated: true, viewportHydrated: true, fetchMovieDetail() {}, isDesktopGuest: false, movieId: "42", router: {} };
  const before = vm.runInNewContext(dependencies, { ...stable, country: "CO", locale: "es" });
  for (const [country, locale] of [["AR", "es"], ["US", "en"], ["CO", "es"]]) {
    const after = vm.runInNewContext(dependencies, { ...stable, country, locale });
    assert.ok(before.every((value, i) => Object.is(value, after[i])));
  }
  assert.doesNotMatch(source, /<MovieCard[^>]*key=/);
  const card = readFileSync("components/MovieCard.tsx", "utf8");
  assert.match(card, /\[mobileCarouselIndex, setMobileCarouselIndex\] = useState\(0\)/);
  assert.equal((card.match(/setMobileCarouselIndex\(/g) ?? []).length, 1);
});

test("normal mobile retains existing provider rows during refresh; desktop loading remains unchanged", () => {
  const source = readFileSync("components/StreamingProviders.tsx", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const providers = [{ id: "netflix", name: "Netflix", availability: ["flatrate"] }, { id: "rent", name: "Rent", availability: ["rent"] }];
  const render = (adaptiveMobile, loading) => {
    const states = ["AR", "es", providers, loading, false];
    let index = 0;
    const exports = {};
    const jsx = (type, props) => ({ type, props });
    vm.runInNewContext(compiled, {
      exports,
      require: name => name === "react" ? { useState: () => [states[index++], () => {}], useEffect() {}, useMemo: fn => fn() } : name === "react/jsx-runtime" ? { jsx, jsxs: jsx } : { STREAMING_COUNTRY_OPTIONS: [] },
    });
    return exports.default({ movieId: "42", adaptiveMobile });
  };
  const rows = node => {
    if (!node || typeof node !== "object") return [];
    const children = node.props?.children;
    return [...(node.type?.name === "ProviderRow" ? [node] : []), ...(Array.isArray(children) ? children : [children]).flatMap(rows)];
  };
  for (const loading of [true, false]) {
    const output = render(true, loading);
    assert.equal(output.props["aria-busy"], loading);
    assert.deepEqual(rows(output).flatMap(row => row.props.providers.map(provider => provider.id)), ["netflix", "rent"]);
  }
  assert.equal(rows(render(false, true)).length, 0);
});
