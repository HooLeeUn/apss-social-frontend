import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const activityColumn = readFileSync(new URL("../components/profile-feed/MyActivityColumn.tsx", import.meta.url), "utf8");
const activityHook = readFileSync(new URL("../hooks/useInfiniteScopedSocialActivity.ts", import.meta.url), "utf8");
const adapters = readFileSync(new URL("../lib/profile-feed/adapters.ts", import.meta.url), "utf8");
const videoCarousel = readFileSync(new URL("../components/profile-feed/VisitedProfileVideoReactions.tsx", import.meta.url), "utf8");

test("visited activity tabs map lazily to their server-side activity filters", () => {
  assert.match(activityColumn, /visitedActivityTab === "public_comments"[\s\S]*?"public_comment" as const/);
  assert.match(activityColumn, /visitedActivityTab === "ratings"[\s\S]*?"rating" as const/);
  assert.match(activityColumn, /visitedActivityTab === "reactions"[\s\S]*?"public_comment_reaction" as const/);
  assert.match(activityColumn, /activityEnabled = isOwnProfile[\s\S]*?visitedActivityType !== undefined/);
});

test("visited activity requests include activity_type and pagination follows backend next", () => {
  assert.match(adapters, /URLSearchParams\(\{ activity_type: activityType \}\)/);
  assert.match(activityHook, /mode === "append" \? currentNext : null/);
  assert.match(adapters, /parsed\.next \? normalizeActivityNextEndpoint\(parsed\.next\) : null/);
});

test("public comment reactions preserve the visited-user endpoint payload for guests", () => {
  assert.match(adapters, /activityType === "public_comment_reaction" \? parsed\.items/);
  assert.match(activityColumn, /visitedActivityType === "public_comment_reaction"\) return sortedItems/);
});

test("comment reaction authors use only the canonical user visitability endpoint", () => {
  assert.match(activityColumn, /getUserVisitabilityByUsername\(username\)/);
  assert.doesNotMatch(activityColumn, /getUserProfileByUsername\(username\)/);
  assert.match(adapters, /getUserVisitabilityByUsername[\s\S]*?apiFetch\(`\/users\/\$\{encodeURIComponent\(username\)\}\/`\)/);

  const helperStart = adapters.indexOf("export async function getUserVisitabilityByUsername");
  const helperSource = adapters.slice(helperStart, adapters.indexOf("\n}\n", helperStart) + 3);
  assert.doesNotMatch(helperSource, /\/profile\//);
});

test("comment reaction author resolution is cached by normalized username while preserving URL casing", () => {
  assert.match(activityColumn, /const username = item\.likedCommentAuthorUsername\?\.trim\(\)/);
  assert.match(activityColumn, /const cacheKey = normalizeUsername\(username\)/);
  assert.match(activityColumn, /!resolvedAuthorUsernamesRef\.current\.has\(cacheKey\)/);
  assert.match(activityColumn, /resolvedAuthorUsernamesRef\.current\.add\(cacheKey\)/);
  assert.match(activityColumn, /getUserVisitabilityByUsername\(username\)/);
});

test("comment author links retain visitability policy and safely fall back to non-visitable", () => {
  assert.match(activityColumn, /isUserProfileVisitable\(profile\?\.profileAccess, profile\?\.canViewFullProfile\)/);
  assert.match(activityColumn, /catch \{\s*return \[cacheKey, false\]/);
  assert.match(activityColumn, /shouldRenderAuthorLink[\s\S]*?\? \(\s*<Link/);
  assert.match(activityColumn, /\) : \(\s*<span[^>]*>@\{item\.likedCommentAuthorUsername\}<\/span>/);
});

test("visited activity cache is isolated by user scope and type and aborts stale requests", () => {
  assert.match(activityHook, /cacheKey = `\$\{scope\}:\$\{activityType \?\? "all"\}`/);
  assert.match(activityHook, /cacheRef\.current\.get\(cacheKey\)/);
  assert.match(activityHook, /abortControllerRef\.current\?\.abort\(\)/);
  assert.match(activityHook, /requestId !== requestIdRef\.current/);
});

test("video reactions retain their dedicated endpoint", () => {
  assert.match(videoCarousel, /\/users\/\$\{encodeURIComponent\(username\)\}\/video-reactions\//);
});
