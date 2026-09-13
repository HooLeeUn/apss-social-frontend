import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moderation = readFileSync("lib/moderation.ts", "utf8");
const menu = readFileSync("components/moderation/UgcModerationMenu.tsx", "utf8");
const comments = readFileSync("components/social/CommentItem.tsx", "utf8");
const movie = readFileSync("app/movies/[id]/page.tsx", "utf8");
const signup = readFileSync("app/signup/page.tsx", "utf8");
const constants = readFileSync("lib/legal-constants.ts", "utf8");
const privacy = readFileSync("lib/privacy.ts", "utf8");

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

test("report UI prevents duplicate submits and reuses the restrict helper", () => {
  assert.match(menu, /if \(!target \|\| !reason \|\| busy\) return/);
  assert.match(menu, /disabled=\{!reason \|\| busy\}/);
  assert.match(menu, /ensureBlockedUsers\(\)/);
  assert.match(menu, /blockUser\(userId\)/);
  assert.doesNotMatch(menu, /unblockUser/);
  assert.doesNotMatch(menu, /window\.(confirm|alert)\(/);
});

test("content menus only offer restriction while Privacy & Security retains removal", () => {
  assert.match(menu, /!blocked \?/);
  assert.doesNotMatch(menu, /restrictedUser|removeTitle|removeButton|confirmRemove/);
  assert.match(menu, /subscribeToBlockedUsers\(update\)/);
  assert.match(privacy, /blockedUserIds\.add\(String\(userId\)\)/);
  assert.match(privacy, /blockedUserIds\?\.delete\(String\(userId\)\)/);
  assert.match(privacy, /method: "DELETE"/);
});

test("restriction copy describes bilateral visibility and the Privacy & Security removal path", () => {
  assert.match(menu, /no vas a poder ver su contenido y @\$\{u\} no podrá ver el tuyo/);
  assert.match(menu, /you will no longer be able to see their content and @\$\{u\} will no longer be able to see yours/);
  assert.match(menu, /Para quitar la restricción, dirígete a Privacidad y seguridad/);
  assert.match(menu, /To remove the restriction, go to Privacy & Security/);
});

test("a successful restriction refetches public comments, video reactions, and profile activity", () => {
  const profileActivity = readFileSync("components/profile-feed/SocialActivityTabsBlock.tsx", "utf8");
  assert.match(privacy, /USER_RESTRICTED_EVENT/);
  assert.match(movie, /reloadFirstPageRef\.current/);
  assert.match(movie, /parseCommentsPage\(payload, "public"\)/);
  assert.match(profileActivity, /reloadFollowingActivity\(\)/);
});

test("mobile movement closes menus without preventing scrolling", () => {
  assert.match(menu, /addEventListener\("touchmove", closeOnMobileMovement, \{ passive: true, capture: true \}\)/);
  assert.match(menu, /addEventListener\("scroll", closeOnMobileMovement, \{ passive: true, capture: true \}\)/);
  assert.doesNotMatch(menu, /preventDefault\(\)/);
});

test("signup requires and submits the centralized terms version", () => {
  assert.match(constants, /TERMS_VERSION = "2026-09"/);
  assert.match(signup, /if \(!acceptTerms\) nextErrors\.accept_terms/);
  assert.match(signup, /disabled=\{isSubmitDisabled\}/);
  assert.match(signup, /accept_terms: true, terms_version: TERMS_VERSION/);
});
