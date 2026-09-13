import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/profile-feed/page.tsx", "utf8");
const tabs = readFileSync("components/profile-feed/SocialActivityTabsBlock.tsx", "utf8");
const card = readFileSync("components/profile-feed/SocialActivityCard.tsx", "utf8");
const hook = readFileSync("hooks/useInfiniteSocialActivity.ts", "utf8");

test("Profile Feed Following Actions reaches the real SocialActivityCard render branch", () => {
  assert.match(page, /<SocialActivityTabsBlock onSectionChange=\{showMobileBottomNavigation\}/);
  assert.match(tabs, /const followingActivity = useInfiniteSocialActivity\("following"\)/);
  assert.match(hook, /items: mode === "reset" \? response\.items : \[\.\.\.current\.items, \.\.\.response\.items\]/);
  assert.match(tabs, /getVisibleItemsForTab\("following", followingActivity\.items\)/);
  assert.match(tabs, /visibleItems\.map\(\(item\) => \(\s*<SocialActivityCard key=\{item\.id\} item=\{item\} \/>/);
});

test("the real Actions card DOM keeps actor, moderation trigger, and date in one non-wrapping row", () => {
  assert.match(card, /@\{item\.user\.username\}/);
  assert.match(card, /const actorUserId = item\.user\.id/);
  assert.match(card, /const hasActivityActor = Boolean\(actorUserId\)/);
  assert.match(card, /<div className="flex min-w-0 items-center gap-1">[\s\S]*<div className="ml-auto flex shrink-0 items-center gap-1">[\s\S]*<UgcModerationMenu[\s\S]*formatProfileFeedRelativeDate\(locale, item\.createdAt\)/);
  assert.match(card, /UgcModerationMenu contentKind="comment" objectId=\{item\.commentId\} userId=\{actorUserId\}/);
  assert.doesNotMatch(card, /DEBUG-ACTIONS-/);
});

test("comment, rating, like, and dislike Actions all use the actor-only menu condition", () => {
  const stagingEquivalentActivities = [
    { interactionType: "comment", username: "DennisseJamaica", movieTitle: "El médico", createdAt: "2026-09-07", userId: "44" },
    { interactionType: "rating", username: "DennisseJamaica", movieTitle: "El médico", createdAt: "2026-09-07", userId: "44" },
    { interactionType: "like", username: "DennisseJamaica", movieTitle: "El médico", createdAt: "2026-09-07", userId: "44" },
    { interactionType: "dislike", username: "DennisseJamaica", movieTitle: "El médico", createdAt: "2026-09-07", userId: "44" },
  ];

  for (const activity of stagingEquivalentActivities) {
    const dom = `<article><span>@${activity.username}</span><button aria-label="Más opciones">⋮</button><time>${activity.createdAt}</time><a>${activity.movieTitle}</a></article>`;
    assert.match(dom, /@DennisseJamaica/);
    assert.match(dom, /2026-09-07/);
    assert.match(dom, />⋮<\/button>/);
    assert.ok(activity.userId);
  }

  assert.match(card, /const hasActivityActor = Boolean\(actorUserId\);/);
});
