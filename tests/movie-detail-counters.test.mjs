import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detail = readFileSync(new URL("../app/movies/[id]/page.tsx", import.meta.url), "utf8");
const i18n = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");
const social = readFileSync(new URL("../lib/social.ts", import.meta.url), "utf8");

test("Detail Movie counters use API totals and update from existing local mutations", () => {
  assert.match(detail, /setCount\(payload\.count\)/);
  assert.match(detail, /onTotalChange=\{setVideoReactionTotal\}/);
  assert.match(detail, /setCount\(\(value\) => Math\.max\(0, value - 1\)\)/);
  assert.match(detail, /setPublicCommentsTotal\(parsed\.total \?\? parsed\.comments\.length\)/);
  assert.match(detail, /setPublicCommentsTotal\(\(current\) => current \+ 1\)/);
  assert.match(detail, /comment\.type === "public"/);
  assert.match(social, /root\?\.count, rootData\?\.count, root\?\.total, rootData\?\.total/);
});

test("Detail Movie renders compact localized singular and plural counters", () => {
  assert.match(detail, /videoReactionTotal === 1 \? "movieDetailVideoCountSingular" : "movieDetailVideoCountPlural"/);
  assert.match(detail, /publicCommentsTotal === 1 \? "movieDetailPublicCommentCountSingular" : "movieDetailPublicCommentCountPlural"/);
  assert.match(detail, /data-video-reaction-count/);
  assert.match(detail, /data-public-comment-count/);
  assert.match(i18n, /movieDetailPublicCommentCountSingular: "comentario"/);
  assert.match(i18n, /movieDetailPublicCommentCountPlural: "comentarios"/);
  assert.match(i18n, /movieDetailPublicCommentCountSingular: "comment"/);
  assert.match(i18n, /movieDetailPublicCommentCountPlural: "comments"/);
});
