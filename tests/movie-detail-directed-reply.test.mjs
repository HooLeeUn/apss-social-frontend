import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detailSource = readFileSync(new URL("../app/movies/[id]/page.tsx", import.meta.url), "utf8");
const i18nSource = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

test("expanded directed conversations submit compact replies through the existing contract", () => {
  assert.match(detailSource, /const recipientUsername = conversation\.otherUsername;/);
  assert.match(detailSource, /buildMovieDirectedSubmitEndpoints\(movieId\)/);
  assert.match(detailSource, /\{ body, mentioned_username: recipientUsername, movie_id: movieId \}/);
  assert.match(detailSource, /enterKeyHint="send"/);
  assert.match(detailSource, /event\.key !== "Enter" \|\| event\.nativeEvent\.isComposing/);
  assert.match(detailSource, /event\.preventDefault\(\);/);
});

test("direct reply drafts and in-flight locks are isolated by conversation", () => {
  assert.match(detailSource, /directReplyDrafts\[conversation\.key\]/);
  assert.match(detailSource, /directReplySubmittingRef\.current\.has\(conversationKey\)/);
  assert.match(detailSource, /directReplySubmittingRef\.current\.add\(conversationKey\)/);
  assert.match(detailSource, /directReplySubmittingRef\.current\.delete\(conversationKey\)/);
  assert.match(detailSource, /\[conversationKey\]: ""/);
});

test("direct reply placeholder is localized in Spanish and English", () => {
  assert.match(i18nSource, /movieDetailDirectReplyPlaceholder: "Escribe un mensaje\.\.\."/);
  assert.match(i18nSource, /movieDetailDirectReplyPlaceholder: "Write a message\.\.\."/);
});
