import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const cache = new Map();
function load(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path);
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  cache.set(path, loadedModule.exports);
  const localRequire = (id) => {
    if (id === "./api") return { API_BASE_URL: "https://example.com", apiFetch: () => { throw new Error("Unexpected API call"); } };
    if (!id.startsWith(".")) return require(id);
    const base = resolve(dirname(path), id);
    return load([`${base}.ts`, `${base}.tsx`].find(existsSync));
  };
  new Function("require", "module", "exports", compiled)(localRequire, loadedModule, loadedModule.exports);
  cache.set(path, loadedModule.exports);
  return loadedModule.exports;
}

const Counter = load("components/RecCoolRatingsCount.tsx").default;
const { normalizeMovie } = load("lib/movies.ts");
const { t } = load("lib/i18n.ts");
const card = readFileSync("components/MovieCard.tsx", "utf8");

test("renders zero, singular and plural internal counts in Spanish and English", () => {
  for (const [locale, labels] of [["es", ["0 calificaciones en RecCool", "1 calificación en RecCool", "2 calificaciones en RecCool"]],
                                 ["en", ["0 ratings on RecCool", "1 rating on RecCool", "2 ratings on RecCool"]]]) {
    for (const count of [0, 1, 2]) {
      const html = renderToStaticMarkup(createElement(Counter, { count, locale }));
      assert.ok(html.includes(labels[count]), html);
      assert.ok(html.includes("data-reccool-rating-count"));
    }
  }
});

test("normalization uses only real_ratings_count, including nested payloads and explicit zero", () => {
  assert.equal(normalizeMovie({ id: 1, real_ratings_count: 2, external_votes: 999999 }, 0).realRatingsCount, 2);
  assert.equal(normalizeMovie({ id: 1, external_votes: 999999 }, 0).realRatingsCount, 0);
  assert.equal(normalizeMovie({ id: 1, movie: { real_ratings_count: "3" } }, 0).realRatingsCount, 3);
  assert.equal(normalizeMovie({ id: 1, real_ratings_count: 0, movie: { real_ratings_count: 3 } }, 0).realRatingsCount, 0);
});

test("missing counts remain compatible with older clients and do not produce NaN", () => {
  for (const count of [undefined, NaN, -1]) {
    const html = renderToStaticMarkup(createElement(Counter, { count, locale: "en" }));
    assert.ok(html.includes("0 ratings on RecCool"));
  }
});

test("Detail renders the counter immediately below genres on desktop and mobile only", () => {
  const locations = card.match(/\{genresLine\}<\/p>\s*\{isDetailMovieCard \? <RecCoolRatingsCount count=\{movie.realRatingsCount\} locale=\{locale\} \/> : null\}/g);
  assert.equal(locations?.length, 2);
  const counter = readFileSync("components/RecCoolRatingsCount.tsx", "utf8");
  assert.match(counter, /text-xs leading-tight text-zinc-500/);
  assert.doesNotMatch(counter, /external_votes|externalVotes|<svg|<img/);
  assert.match(card, /h-\[196px\].*?sm:h-\[204px\]/);
  assert.match(card, /snap-x snap-mandatory overflow-x-auto/);
  assert.match(card, /hidden xl:block/);
});

test("existing rating tooltip explains progressive weighting and the exact threshold in both languages", () => {
  assert.match(t("es", "movieDetailRatingExplanation"), /TMDB.*progresivamente.*Al alcanzar 100.*exclusivamente/);
  assert.match(t("en", "movieDetailRatingExplanation"), /TMDB.*progressively.*100.*exclusively/);
  assert.match(card, /TooltipTarget text=\{t\("movieDetailRatingExplanation"\)\}/);
  assert.match(card, /aria-description=\{t\("movieDetailRatingExplanation"\)\}/);
  assert.match(card, /CommentDetailButton.*synopsisEs=\{movie.synopsis_es\}/);
});
