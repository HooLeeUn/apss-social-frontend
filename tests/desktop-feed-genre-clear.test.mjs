import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const feed = await readFile(new URL("../app/feed/page.tsx", import.meta.url), "utf8");

test("desktop clears every selected genre atomically and invalidates filtered requests", () => {
  assert.match(
    feed,
    /const clearDesktopGenreSelection = useCallback\(\(\) => \{[\s\S]*?personalizedAbortControllerRef\.current\?\.abort\(\);[\s\S]*?personalizedLoadMoreAbortControllerRef\.current\?\.abort\(\);[\s\S]*?personalizedRequestIdRef\.current \+= 1;[\s\S]*?personalizedQueryKeyRef\.current = "";[\s\S]*?flushSync\(\(\) => \{\s*setSelectedGenres\(\[\]\);\s*\}\);[\s\S]*?\}, \[\]\);/,
  );
});

test("desktop owns the atomic clear while the existing mobile clear remains unchanged", () => {
  assert.match(feed, /onClearSelection=\{isDesktop \? clearDesktopGenreSelection : \(\) => setSelectedGenres\(\[\]\)\}/);
});

test("genre selection still uses a functional update and retains the limit of three", () => {
  assert.match(feed, /const MAX_SELECTED_GENRES = 3;/);
  assert.match(feed, /setSelectedGenres\(\(current\) => \{[\s\S]*?if \(current\.length >= MAX_SELECTED_GENRES\)[\s\S]*?return \[\.\.\.current, genre\];/);
});
