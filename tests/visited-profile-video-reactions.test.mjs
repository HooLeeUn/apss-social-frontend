import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const activityColumn = readFileSync("components/profile-feed/MyActivityColumn.tsx", "utf8");
const videoCarousel = readFileSync("components/profile-feed/VisitedProfileVideoReactions.tsx", "utf8");
const profileFeedPage = readFileSync("app/profile-feed/page.tsx", "utf8");

test("visited profile video reactions exhaust backend next links with loop protection", () => {
  assert.match(videoCarousel, /while \(nextEndpoint\)/);
  assert.match(videoCarousel, /visitedEndpoints\.has\(endpoint\)/);
  assert.match(videoCarousel, /nextEndpoint = typeof page\.next/);
  assert.match(videoCarousel, /activity_type === "video_reaction_created"/);
  assert.match(videoCarousel, /new Date\(getTimestamp\(right\)\).*new Date\(getTimestamp\(left\)\)/s);
  assert.doesNotMatch(videoCarousel, /[?&]page=\d/);
});

test("visited tabs and video carousel use independent native horizontal scrollers", () => {
  assert.match(activityColumn, /flex-nowrap gap-2 overflow-x-auto scroll-smooth/);
  assert.match(activityColumn, /tabBar\.scrollTo/);
  assert.match(videoCarousel, /md:flex md:snap-x md:snap-mandatory md:gap-4/);
  assert.match(videoCarousel, /md:overflow-x-auto md:scroll-smooth/);
  assert.match(videoCarousel, /carousel\.scrollBy/);
});

test("visited profile layout uses sticky mobile tabs and a vertical mobile video list", () => {
  assert.match(activityColumn, /sticky top-0.*env\(safe-area-inset-top\)[\s\S]*<h2[^>]*>\{resolvedTitle\}<\/h2>[\s\S]*ref=\{visitedTabsRef\}/);
  assert.match(activityColumn, /visitedActivityTab === "video_reactions"[\s\S]*h-auto min-h-\[calc\(100dvh-[\s\S]*overflow-y-visible md:min-h-\[425px\]/);
  assert.match(activityColumn, /h-\[calc\(100dvh-/);
  assert.match(videoCarousel, /space-y-8 overflow-x-visible/);
  assert.match(videoCarousel, /md:\[scrollbar-width:thin\]/);
  assert.match(videoCarousel, /md:h-\[clamp\(260px,calc\(100dvh-16rem\),520px\)\]/);
});

test("first video-reaction loading mount preserves activity geometry without global scroll restoration", () => {
  assert.match(activityColumn, /video_reactions"[\s\S]*min-h-\[calc\(100dvh-[\s\S]*md:min-h-\[425px\]/);
  assert.doesNotMatch(activityColumn, /window\.scrollTo|window\.scrollBy/);
});

test("video reactions stay in the visited-profile branch and do not enter Profile Feed", () => {
  assert.match(activityColumn, /!isOwnProfile && hasOpenedVisitedVideoReactions/);
  assert.doesNotMatch(profileFeedPage, /VisitedProfileVideoReactions|visitedProfileVideoReactions/);
});
