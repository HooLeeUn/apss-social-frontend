import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const activityColumn = readFileSync("components/profile-feed/MyActivityColumn.tsx", "utf8");
const videoCarousel = readFileSync("components/profile-feed/VisitedProfileVideoReactions.tsx", "utf8");
const profileFeedPage = readFileSync("app/profile-feed/page.tsx", "utf8");

test("visited profile video reactions use the dedicated endpoint and progressively append next pages", () => {
  assert.match(videoCarousel, /\/users\/\$\{encodeURIComponent\(username\)\}\/video-reactions\//);
  assert.doesNotMatch(videoCarousel, /\/users\/\$\{encodeURIComponent\(username\)\}\/activity\//);
  assert.match(videoCarousel, /setItems\(firstPage\.results\);\s*setState\("ready"\)/);
  assert.match(videoCarousel, /requestAnimationFrame/);
  assert.match(videoCarousel, /while \(nextEndpoint\)/);
  assert.match(videoCarousel, /visitedEndpoints\.has\(endpoint\)/);
  assert.match(videoCarousel, /nextEndpoint = typeof page\.next/);
  assert.match(videoCarousel, /setItems\(\(currentItems\) => \[\.\.\.currentItems, \.\.\.page\.results\]\)/);
  assert.doesNotMatch(videoCarousel, /activity_type === "video_reaction_created"/);
  assert.doesNotMatch(videoCarousel, /actor\?\.username/);
  assert.doesNotMatch(videoCarousel, /\.sort\(/);
  assert.doesNotMatch(videoCarousel, /[?&]page=\d/);
});

test("visited tabs and video carousel use independent native horizontal scrollers", () => {
  assert.match(activityColumn, /flex-nowrap gap-2 overflow-x-auto scroll-smooth/);
  assert.match(activityColumn, /tabBar\.scrollTo/);
  assert.match(videoCarousel, /xl:flex xl:snap-x xl:snap-mandatory xl:gap-4/);
  assert.match(videoCarousel, /xl:overflow-x-auto xl:scroll-smooth/);
  assert.match(videoCarousel, /carousel\.scrollBy/);
});

test("visited profile layout uses sticky mobile tabs and a vertical mobile video list", () => {
  assert.match(activityColumn, /sticky top-0.*env\(safe-area-inset-top\)[\s\S]*<h2[^>]*>\{resolvedTitle\}<\/h2>[\s\S]*ref=\{visitedTabsRef\}/);
  assert.match(activityColumn, /!isOwnProfile[\s\S]*h-\[calc\(100dvh-max\(6rem,[\s\S]*overflow-y-auto/);
  assert.match(activityColumn, /visitedActivityTab === "video_reactions"[\s\S]*xl:h-auto xl:min-h-\[425px\] xl:overflow-y-visible/);
  assert.match(videoCarousel, /space-y-8 overflow-x-visible/);
  assert.match(videoCarousel, /xl:\[scrollbar-width:thin\]/);
  assert.match(videoCarousel, /xl:h-\[clamp\(260px,calc\(100dvh-16rem\),520px\)\]/);
});

test("all visited tabs share one mobile viewport without global scroll restoration", () => {
  assert.match(activityColumn, /!isOwnProfile[\s\S]*h-\[calc\(100dvh-[\s\S]*overflow-y-auto/);
  assert.doesNotMatch(activityColumn, /overscroll-y-contain/);
  assert.doesNotMatch(activityColumn, /window\.scrollTo|window\.scrollBy/);
});

test("the shared sticky header is bounded by the complete activity section", () => {
  assert.match(activityColumn, /\) : \(\s*<>\s*<div className="sticky top-0/);
  assert.doesNotMatch(activityColumn, /\) : \(\s*<div>\s*<div className="sticky top-0/);
});

test("mobile video geometry is stable when the dynamic viewport changes", () => {
  assert.match(videoCarousel, /w-full max-w-\[22rem\]/);
  assert.match(videoCarousel, /aspect-\[9\/16\] w-full/);
  assert.doesNotMatch(videoCarousel, /w-\[min\(100%,calc\(\(100dvh/);
});

test("video reactions stay in the visited-profile branch and do not enter Profile Feed", () => {
  assert.match(activityColumn, /!isOwnProfile && hasOpenedVisitedVideoReactions/);
  assert.doesNotMatch(profileFeedPage, /VisitedProfileVideoReactions|visitedProfileVideoReactions/);
});
