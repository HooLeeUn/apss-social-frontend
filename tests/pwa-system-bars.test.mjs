import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [layoutSource, manifestSource, globalStyles] = await Promise.all([
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("PWA metadata keeps Android system surfaces black with a dark color scheme", () => {
  assert.match(manifestSource, /background_color:\s*"#000000"/);
  assert.match(manifestSource, /theme_color:\s*"#000000"/);
  assert.match(layoutSource, /themeColor:\s*"#000000"/);
  assert.match(layoutSource, /colorScheme:\s*"dark"/);
});

test("the document root and body retain a black edge-to-edge background", () => {
  assert.match(layoutSource, /<html[^>]+className="bg-black"/);
  assert.match(layoutSource, /<body[\s\S]*?className=\{`[^`]*bg-black[^`]*`\}/);
  assert.match(globalStyles, /html,\s*\nbody\s*\{[^}]*background:\s*#000000;/);
});
