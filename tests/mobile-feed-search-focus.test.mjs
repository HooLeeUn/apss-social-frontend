import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const feed = readFileSync(new URL("../app/feed/page.tsx", import.meta.url), "utf8");
const searchBar = readFileSync(new URL("../components/SearchBar.tsx", import.meta.url), "utf8");

test("mobile feed mounts and focuses its search input in the original tap", () => {
  assert.match(feed, /flushSync\(\(\) => setIsMobileSearchOpen\(true\)\);\s+mobileSearchInputRef\.current\?\.focus\(\);/);
  assert.match(feed, /<SearchBar\s+inputRef=\{mobileSearchInputRef\}/);
  assert.match(searchBar, /inputRef\?: Ref<HTMLInputElement>/);
  assert.match(searchBar, /<input\s+ref=\{inputRef\}/);
});
