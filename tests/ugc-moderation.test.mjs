import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getActivityCommentReportId, shouldRenderActivityModerationMenu, shouldShowActivityContentReport } from "../lib/profile-feed/activity-moderation.mjs";

const moderation = readFileSync("lib/moderation.ts", "utf8");
const menu = readFileSync("components/moderation/UgcModerationMenu.tsx", "utf8");
const socialCard = readFileSync("components/profile-feed/SocialActivityCard.tsx", "utf8");
const adapters = readFileSync("lib/profile-feed/adapters.ts", "utf8");
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

test("a realistic following public-comment payload keeps its object and actor ids for moderation", () => {
  const payload = {
    id: "activity-812",
    activity_type: "public_comment",
    actor: { id: 44, username: "DennisseJamaica" },
    object_id: 991,
    payload: { content: "Excelente película" },
  };
  assert.equal(payload.activity_type, "public_comment");
  assert.equal(payload.object_id, 991);
  assert.match(adapters, /isPublicCommentType \? activityRecord\.object_id : undefined/);
  assert.equal(shouldRenderActivityModerationMenu({ actorId: "44" }), true);
  assert.match(socialCard, /const actorUserId = item\.user\.id/);
  assert.match(socialCard, /\{hasActivityActor \? \([\s\S]*<UgcModerationMenu/);
  assert.match(socialCard, /objectId=\{commentReportId\}/);
});

test("every activity with a real actor exposes user moderation", () => {
  const base = { interactionType: "comment", commentId: "991", actorId: "44" };
  assert.equal(shouldRenderActivityModerationMenu({ ...base, activityType: "public_comment" }), true);
  assert.equal(shouldRenderActivityModerationMenu({ ...base, activityType: "rating", interactionType: "rating" }), true);
  assert.equal(shouldRenderActivityModerationMenu({ ...base, activityType: "public_comment_like", interactionType: "like" }), true);
  assert.equal(shouldRenderActivityModerationMenu({ ...base, activityType: "public_comment_dislike", interactionType: "dislike" }), true);
  assert.equal(shouldRenderActivityModerationMenu({ activityType: "something_new", actorId: "44" }), true);
  assert.equal(shouldRenderActivityModerationMenu({ activityType: "rating" }), false);
  assert.equal(shouldRenderActivityModerationMenu({ activityType: "rating", actorId: "  " }), false);
});

test("structured public comments and comment reactions expose the referenced comment report target", () => {
  const base = { interactionType: "comment", commentId: "991", actorId: "44" };
  assert.equal(shouldShowActivityContentReport({ ...base, activityType: "public_comment" }), true);
  assert.equal(shouldShowActivityContentReport({ activityType: "rating", interactionType: "rating", actorId: "44" }), false);
  assert.equal(shouldShowActivityContentReport({ ...base, activityType: "public_comment_like", interactionType: "like" }), true);
  assert.equal(shouldShowActivityContentReport({ ...base, activityType: "public_comment_dislike", interactionType: "dislike" }), true);
  assert.equal(shouldShowActivityContentReport({ ...base, activityType: "public_comment", commentId: undefined }), false);
  assert.equal(shouldShowActivityContentReport({ ...base, activityType: "public_comment", isDirectedComment: true }), false);
  assert.equal(getActivityCommentReportId({ ...base, activityType: "public_comment" }), "991");
  assert.equal(getActivityCommentReportId({ activityType: "rating", interactionType: "rating", actorId: "44" }), undefined);
  assert.equal(getActivityCommentReportId({ ...base, activityType: "public_comment_like", interactionType: "like", commentId: "992" }), "992");
  assert.equal(getActivityCommentReportId({ ...base, activityType: "public_comment_dislike", interactionType: "dislike", commentId: "993" }), "993");
  assert.match(menu, /showReportContent && objectId !== undefined/);
  assert.match(socialCard, /showReportContent=\{commentReportId !== undefined\}/);
});

test("normalization documents the structured original-comment ids for all four activity cases", () => {
  assert.match(adapters, /payload\.comment_id,[\s\S]*payload\.commentId,[\s\S]*payloadComment\?\.id,[\s\S]*payloadOriginalComment\?\.id/);
  assert.match(adapters, /isPublicCommentType \? activityRecord\.object_id : undefined/);

  const normalizedFixtures = [
    { activityType: "public_comment", interactionType: "comment", commentId: "comment-X" },
    { activityType: "public_comment_like", interactionType: "like", actorId: "actor-A", commentId: "comment-Y" },
    { activityType: "public_comment_dislike", interactionType: "dislike", actorId: "actor-A", commentId: "comment-Z" },
    { activityType: "rating", interactionType: "rating", actorId: "actor-A" },
  ];
  assert.deepEqual(normalizedFixtures.map(getActivityCommentReportId), ["comment-X", "comment-Y", "comment-Z", undefined]);
});

test("the Actions menu keeps content reporting first and targets the Comment report type", () => {
  const reportContent = menu.indexOf("{c.reportContent}");
  const reportUser = menu.indexOf("{c.reportUser}");
  const restrictUser = menu.indexOf("{c.restrict}");
  assert.ok(reportContent >= 0 && reportContent < reportUser && reportUser < restrictUser);
  assert.match(socialCard, /contentKind="comment"[\s\S]*objectId=\{commentReportId\}/);
  assert.match(moderation, /payload: Record<string, string \| number> = \{ type: target\.kind, reason \}/);
  assert.match(moderation, /else payload\.object_id = target\.objectId/);
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
  assert.match(profileActivity, /setRestrictedActorIds/);
  assert.match(profileActivity, /!restrictedActorIds\.has\(String\(item\.actorId\)\)/);
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
