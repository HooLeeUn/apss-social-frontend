import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const detail = fs.readFileSync("app/movies/[id]/page.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");

test("desktop video reactions center only while the carousel is underfilled", () => {
  assert.match(detail, /container\.scrollWidth <= container\.clientWidth \+ tolerance/);
  assert.match(detail, /data-history-underfilled=\{isHistoryUnderfilled\}/);
  assert.match(css, /data-history-underfilled="true"\][\s\S]*justify-content: center/);
});

test("desktop empty video state is centered and has stronger hierarchy", () => {
  assert.match(detail, /data-video-history-empty/);
  assert.match(css, /data-video-history-empty\][\s\S]*min-height: 16rem[\s\S]*align-items: center[\s\S]*font-size: 1\.125rem/);
});

test("REC keeps its button handler and uses the established blue-violet text gradient", () => {
  assert.match(detail, /onClick=\{\(\) => setRecorderState[\s\S]*bg-gradient-to-r from-\[#168BFF\] via-\[#6558F5\] to-\[#A63DFF\][\s\S]*>Rec<\/span>/);
});
