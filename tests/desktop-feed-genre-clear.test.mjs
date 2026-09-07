import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const feed = await readFile(new URL("../app/feed/page.tsx", import.meta.url), "utf8");
const genreChips = await readFile(new URL("../components/GenreChips.tsx", import.meta.url), "utf8");

test("mobile and desktop share the same clear callback and click-driven chip instance", () => {
  assert.equal(feed.match(/<GenreChips/g)?.length, 1);
  assert.match(feed, /onClearSelection=\{\(\) => setSelectedGenres\(\[\]\)\}/);
  assert.doesNotMatch(feed, /clearDesktopGenreSelection/);
  assert.match(genreChips, /onClick=\{\(\) => \{\s*if \(chip\.isAll\) \{\s*onClearSelection\?\.\(\);/);
  assert.doesNotMatch(genreChips, /onTouchStart|onPointerDown|onPointerUp/);
});

test("the desktop brand layer cannot intercept clicks on the genre row beneath it", () => {
  assert.match(feed, /feed-header__brand[^\n]+xl:pointer-events-none/);
});

test("genre selection still uses a functional update and retains the limit of three", () => {
  assert.match(feed, /const MAX_SELECTED_GENRES = 3;/);
  assert.match(feed, /setSelectedGenres\(\(current\) => \{[\s\S]*?if \(current\.length >= MAX_SELECTED_GENRES\)[\s\S]*?return \[\.\.\.current, genre\];/);
});
