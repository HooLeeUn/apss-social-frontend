import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
let payload;
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
    if (id === "./api" || id === "../api") return { API_BASE_URL: "https://example.com", apiFetch: async () => payload };
    if (!id.startsWith(".")) return require(id);
    const base = resolve(dirname(path), id);
    return load([`${base}.ts`, `${base}.tsx`].find(existsSync));
  };
  new Function("require", "module", "exports", compiled)(localRequire, loadedModule, loadedModule.exports);
  cache.set(path, loadedModule.exports);
  return loadedModule.exports;
}


const { productionGenres } = load("lib/genres.ts");
const { normalizeMovie } = load("lib/movies.ts");
const adapters = load("lib/profile-feed/adapters.ts");
const all = ["Action", "Animation", "Comedy", "Documentary", "Drama", "Horror", "Musical", "Sci-Fi"];
for (const count of [1, 3, 4, 5, 8]) {
  test(`preserves ${count} genres in all three formats and type/year`, () => {
    const expected = all.slice(0, count);
    for (const genre of [expected.join(", "), [expected.join(", ")], expected]) {
      assert.deepEqual(productionGenres(genre), expected);
      const movie = normalizeMovie({ id: 1, genre, type: "Movie", year: "2024" }, 0);
      assert.deepEqual(movie.genres, expected);
      assert.equal(movie.year, "2024");
      assert.equal(movie.contentType, "Movie");
    }
  });
}
test("empty and duplicate values preserve first spelling and order", () => {
  for (const value of [undefined, null, "", [], [" ", null]]) assert.deepEqual(productionGenres(value), []);
  assert.deepEqual(productionGenres([" Action, Comedy ", "action", "", "Sci-Fi", "Comedy"]), ["Action", "Comedy", "Sci-Fi"]);
});
test("favorites and favorite search retain eight categories", async () => {
  payload = [{ slot: 1, movie: { id: 1, genres: all, title: "Test", year: "2024", type: "Movie" } }];
  const favorites = await adapters.getFavoriteMovies();
  assert.equal(favorites[0].genre, all.join(", "));
  payload = [{ id: 1, genres: all, title: "Test", year: "2024", type: "Movie" }];
  const candidates = await adapters.searchFavoriteMovieCandidates("Test");
  assert.equal(candidates[0].genre, all.join(", "));
  assert.equal(candidates[0].year, "2024");
  assert.equal(candidates[0].type, "Movie");
});
test("weekly cards retain all genres and existing poster gestures and ticker", () => {
  for (const file of ["WeeklyHeroCard", "WeeklyMiniCard"]) {
    const source = readFileSync(`components/${file}.tsx`, "utf8");
    assert.match(source, /productionGenres\(movie\?\.genres\)/);
    assert.doesNotMatch(source, /genres\?\.\[0\]|genres\.slice\(0, 3\)/);
    assert.match(source, /trailerLongPress.posterProps/);
    assert.match(source, /ActionsTruncatedText/);
  }
  assert.match(readFileSync("components/WeeklyMiniCard.tsx", "utf8"), /<DesktopOverflowTicker/);
});
test("Tu Cartelera still allows a maximum of three selected chips", () => {
  const source = readFileSync("app/feed/page.tsx", "utf8");
  assert.match(source, /const MAX_SELECTED_GENRES = 3/);
  assert.match(source, /if \(current.length >= MAX_SELECTED_GENRES\) \{\s*return current;/);
});

test("favorite genre portal touches are isolated while card touches can reach the carousel", () => {
  const source = readFileSync("components/profile-feed/FavoriteMoviesBlock.tsx", "utf8");
  const helper = source.slice(source.indexOf("function stopFavoriteGenrePanelTouch"), source.indexOf("function FavoriteMovieItem"));
  const compiled = ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const handler = new Function(`${compiled}; return stopFavoriteGenrePanelTouch;`)();
  for (const insideCard of [true, false]) {
    let stopped = false;
    handler({ currentTarget: { contains: () => insideCard }, target: {}, stopPropagation: () => { stopped = true; } });
    assert.equal(stopped, !insideCard);
  }
  for (const name of ["onTouchStart", "onTouchMove", "onTouchEnd", "onTouchCancel"]) {
    assert.ok(source.includes(`${name}={stopFavoriteGenrePanelTouch}`));
  }
});
