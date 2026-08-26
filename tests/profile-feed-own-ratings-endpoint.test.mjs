import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const activityColumn = readFileSync(new URL("../components/profile-feed/MyActivityColumn.tsx", import.meta.url), "utf8");
const activityHook = readFileSync(new URL("../hooks/useInfiniteScopedSocialActivity.ts", import.meta.url), "utf8");
const adapters = readFileSync(new URL("../lib/profile-feed/adapters.ts", import.meta.url), "utf8");

test("own ratings select the dedicated rating activity collection", () => {
  assert.match(activityColumn, /isOwnProfile && effectiveActiveTab === "rated"[\s\S]*?"rating" as const/);
  assert.match(activityColumn, /useInfiniteScopedSocialActivity\(resolvedScope \|\| "user:unknown", activityEnabled, selectedActivityType\)/);
  assert.match(adapters, /isMyActivityScope && activityType && !nextEndpoint/);
  assert.match(adapters, /buildUserActivityEndpoint\(myUsername\)[\s\S]*?activity_type: activityType/);
});

test("own ratings do not auto-page to search the mixed feed", () => {
  assert.match(activityColumn, /if \(!isOwnProfile \|\| effectiveActiveTab !== "activity"\)/);
  assert.doesNotMatch(activityColumn, /effectiveActiveTab === "rated" \? ownRatedItems\.length/);
});

test("dedicated ratings retain backend order, deduplicate pages, and stop at next null", () => {
  const ratedItems = activityColumn.slice(activityColumn.indexOf("const ownRatedItems"), activityColumn.indexOf("useEffect", activityColumn.indexOf("const ownRatedItems")));
  assert.doesNotMatch(ratedItems, /\.sort\(/);
  assert.match(activityHook, /const existingIds = new Set\(current\.map\(\(item\) => item\.id\)\)/);
  assert.match(activityHook, /mode === "append" && \(!currentNext/);
  assert.match(activityHook, /mode === "append" \? currentNext : null/);
});

test("activity and ratings cache independently while existing UI contracts stay mounted", () => {
  assert.match(activityHook, /cacheKey = `\$\{scope\}:\$\{activityType \?\? "all"\}`/);
  assert.match(activityColumn, /title=\{t\("emptyRatingsTitle"\)\}/);
  assert.match(activityColumn, /data-tour=\{tab\.value === "messages" \? "profile-inbox" : tab\.value === "rated" \? "profile-ratings"/);
  assert.match(activityColumn, /onTouchMove=\{handleActivityTouchMove\}/);
});
