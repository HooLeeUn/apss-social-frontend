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

test("visited profile autoplay selects one sufficiently visible muted inline video", () => {
  assert.match(videoCarousel, /const VISIBILITY_THRESHOLDS = \[0, 0\.25, 0\.5, 0\.75, 1\]/);
  assert.match(videoCarousel, /new IntersectionObserver/);
  assert.match(videoCarousel, /entry\.intersectionRatio/);
  assert.match(videoCarousel, /pauseAllExcept\(nextId\)/);
  assert.match(videoCarousel, /const \[isMuted, setIsMuted\] = useState\(true\)/);
  assert.match(videoCarousel, /video\.muted = isMuted/);
  assert.match(videoCarousel, /video\.play\(\)[\s\S]*\.catch/);
  assert.match(videoCarousel, /preload="auto" muted=\{isMuted\} playsInline controls/);
  assert.match(videoCarousel, /onPlay=\{\(\) => \{ activeVideoId\.current = videoId; pauseAllExcept\(videoId\); \}\}/);
  assert.match(videoCarousel, /observer\.disconnect\(\)[\s\S]*video\.pause\(\)/);
});

test("visited profile reactions reuse canonical counts, current reaction and PUT contract", () => {
  assert.match(videoCarousel, /item\.payload\.my_reaction === reaction/);
  assert.match(videoCarousel, /item\.payload\.likes_count \?\? 0/);
  assert.match(videoCarousel, /item\.payload\.dislikes_count \?\? 0/);
  assert.match(videoCarousel, /\/video-comments\/\$\{encodeURIComponent\(key\)\}\/reaction\//);
  assert.match(videoCarousel, /method: "PUT"/);
  assert.match(videoCarousel, /mine === reaction \? null : reaction/);
  assert.match(videoCarousel, /result\.my_reaction[\s\S]*result\.likes_count[\s\S]*result\.dislikes_count/);
  assert.match(videoCarousel, /if \(previous\) setItems/);
  assert.doesNotMatch(videoCarousel, /video_owner[\s\S]*(filter|exclude)/);
});

test("visited profile reaction controls are touch-visible and desktop-hover-only", () => {
  assert.match(videoCarousel, /<div className="xl:hidden">\{reactionButtons\}<\/div>/);
  assert.match(videoCarousel, /hidden opacity-0[\s\S]*xl:flex xl:group-hover:pointer-events-auto xl:group-hover:opacity-100/);
  assert.match(videoCarousel, /event\.preventDefault\(\); event\.stopPropagation\(\)/);
});

test("expanded viewer opens the selected carousel index with shared localized metadata and reactions", () => {
  assert.match(videoCarousel, /cards\.map\(\(\{ item, title, timestamp \}, index\)/);
  assert.match(videoCarousel, /openExpandedViewer\(index\)/);
  assert.match(videoCarousel, /const \{ item, title \} = cards\[expandedIndex\]/);
  assert.match(videoCarousel, /item\.movie\.image \|\| "\/brand\/qnext-poster-placeholder\.png"/);
  assert.match(videoCarousel, /resolveMovieTitles\(locale, item\.movie\.title_spanish, item\.movie\.title_english\)/);
  assert.match(videoCarousel, /data-visited-profile-expanded-viewer/);
  assert.doesNotMatch(videoCarousel.slice(videoCarousel.indexOf("data-visited-profile-expanded-viewer")), /actor\?\.username|video_owner|username/);
  assert.equal((videoCarousel.match(/void reactToVideo\(item\.id, commentId, reaction\)/g) ?? []).length, 2);
});

test("expanded viewer navigates in source order with bounded desktop arrows and mobile swipe", () => {
  assert.match(videoCarousel, /const next = current \+ direction/);
  assert.match(videoCarousel, /next < 0 \|\| next >= itemsRef\.current\.length/);
  assert.match(videoCarousel, /navigateExpandedViewer\(distance < 0 \? 1 : -1\)/);
  assert.match(videoCarousel, /Math\.abs\(distance\) < 50/);
  assert.match(videoCarousel, /disabled=\{expandedIndex === 0\}/);
  assert.match(videoCarousel, /disabled=\{expandedIndex === cards\.length - 1\}/);
  assert.match(videoCarousel, /hidden h-12[\s\S]*xl:flex/);
});

test("all minimized and expanded players share one mute state", () => {
  assert.match(videoCarousel, /const \[isMuted, setIsMuted\] = useState\(true\)/);
  assert.ok((videoCarousel.match(/muted=\{isMuted\}/g) ?? []).length >= 2);
  assert.ok((videoCarousel.match(/setIsMuted\(event\.currentTarget\.muted\)/g) ?? []).length >= 2);
  assert.match(videoCarousel, /videoRefs\.current\.forEach[\s\S]*video\.muted = isMuted/);
  assert.match(videoCarousel, /expandedVideoRef\.current\.muted = isMuted/);
});

test("expanded playback pauses cards, pauses between items, and restores visibility autoplay on close", () => {
  assert.match(videoCarousel, /openExpandedViewer[\s\S]*pauseAllExcept\(null\)/);
  assert.match(videoCarousel, /navigateExpandedViewer[\s\S]*expandedVideoRef\.current\?\.pause\(\)/);
  assert.match(videoCarousel, /closeExpandedViewer[\s\S]*expandedVideoRef\.current\?\.pause\(\)/);
  assert.match(videoCarousel, /requestAnimationFrame\(\(\) => playMostVisibleVideo\(\)\)/);
  assert.match(videoCarousel, /key=\{videoId\}[\s\S]*autoPlay muted=\{isMuted\}/);
});
