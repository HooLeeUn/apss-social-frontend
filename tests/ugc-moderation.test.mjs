import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moderation = readFileSync("lib/moderation.ts", "utf8");
const menu = readFileSync("components/moderation/UgcModerationMenu.tsx", "utf8");
const comments = readFileSync("components/social/CommentItem.tsx", "utf8");
const movie = readFileSync("app/movies/[id]/page.tsx", "utf8");
const signup = readFileSync("app/signup/page.tsx", "utf8");
const constants = readFileSync("lib/legal-constants.ts", "utf8");

test("report payloads use mutually exclusive backend identifiers", () => {
  assert.match(moderation, /target\.kind === "user"/);
  assert.match(moderation, /payload\.reported_user = target\.userId/);
  assert.match(moderation, /else payload\.object_id = target\.objectId/);
  assert.match(moderation, /apiFetch\("\/reports\/"/);
});

test("public comments expose moderation only for non-own comments", () => {
  assert.match(comments, /showModeration && comment\.type === "public"/);
  assert.match(movie, /enablePublicModeration=\{!isDesktopGuest\}/);
  assert.match(movie, /currentUserId=\{authenticatedUser\?\.id\}/);
});

test("video reactions use the video comment and exposed author IDs", () => {
  assert.match(movie, /contentKind="video_comment" objectId=\{comment\.id\} userId=\{comment\.user\.id\}/);
  assert.match(movie, /String\(comment\.user\.id\) !== String\(currentUserId\)/);
  assert.match(movie, /title=\{comment\.user\.username\}[^>]*truncate/);
});

test("report UI prevents duplicate submits and reuses restriction helper", () => {
  assert.match(menu, /if \(!target \|\| !reason \|\| busy\) return/);
  assert.match(menu, /disabled=\{!reason \|\| busy\}/);
  assert.match(menu, /getBlockedUsers\(\)/);
  assert.match(menu, /blockUser\(userId\)/);
});

test("signup requires and submits the centralized terms version", () => {
  assert.match(constants, /TERMS_VERSION = "2026-09"/);
  assert.match(signup, /if \(!acceptTerms\) nextErrors\.accept_terms/);
  assert.match(signup, /disabled=\{isSubmitDisabled\}/);
  assert.match(signup, /accept_terms: true, terms_version: TERMS_VERSION/);
});
