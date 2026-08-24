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

test("visited activity cache is isolated by user scope and type and aborts stale requests", () => {
  assert.match(activityHook, /cacheKey = `\$\{scope\}:\$\{activityType \?\? "all"\}`/);
  assert.match(activityHook, /cacheRef\.current\.get\(cacheKey\)/);
  assert.match(activityHook, /abortControllerRef\.current\?\.abort\(\)/);
  assert.match(activityHook, /requestId !== requestIdRef\.current/);
});

test("video reactions retain their dedicated endpoint", () => {
  assert.match(videoCarousel, /\/users\/\$\{encodeURIComponent\(username\)\}\/video-reactions\//);
});
