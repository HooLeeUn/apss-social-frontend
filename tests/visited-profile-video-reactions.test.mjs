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
  assert.match(videoCarousel, /preload="auto" muted=\{muted\} playsInline controls=\{false\}/);
  assert.match(videoCarousel, /onPlay=\{\(\) => \{ activeVideoId\.current = videoId; activeVideoIndex\.current = index; pauseAllExcept\(videoId\); \}\}/);
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

test("expanded viewer navigates in source order with bounded desktop arrows and vertical mobile swipe", () => {
  assert.match(videoCarousel, /const next = current \+ direction/);
  assert.match(videoCarousel, /next < 0 \|\| next >= itemsRef\.current\.length/);
  assert.match(videoCarousel, /const deltaX = touch\.clientX - start\.x/);
  assert.match(videoCarousel, /const deltaY = touch\.clientY - start\.y/);
  assert.match(videoCarousel, /setSwipeOffset\(canMove \?/);
  assert.match(videoCarousel, /translateY\(\$\{swipeOffset\}px\)/);
  assert.match(videoCarousel, /navigateExpandedViewer\(direction\)/);
  assert.match(videoCarousel, /Math\.abs\(deltaY\) < 60/);
  assert.match(videoCarousel, /Math\.abs\(deltaY\) <= Math\.abs\(deltaX\) \* 1\.25/);
  assert.match(videoCarousel, /bottom - 72/);
  assert.match(videoCarousel, /disabled=\{expandedIndex === 0\}/);
  assert.match(videoCarousel, /disabled=\{expandedIndex === cards\.length - 1\}/);
  assert.match(videoCarousel, /hidden h-12[\s\S]*xl:flex/);
});

test("each card exposes only the enriched top expand action and suppresses native lower fullscreen", () => {
  assert.equal((videoCarousel.match(/openExpandedViewer\(index\)/g) ?? []).length, 1);
  assert.match(videoCarousel, /absolute bottom-2 right-2[\s\S]*openExpandedViewer\(index\)/);
  assert.match(videoCarousel, /controls=\{false\}/);
  assert.doesNotMatch(videoCarousel, /controlsList=|nofullscreen/);
  assert.doesNotMatch(videoCarousel, /data-custom-video-controls|type="range"|formatVideoTime|setDuration/);
  assert.match(videoCarousel, /data-video-mute-control[\s\S]*absolute bottom-2 left-2/);
  assert.match(videoCarousel, /absolute bottom-2 right-2[\s\S]*openExpandedViewer\(index\)/);
});

test("expanded movie metadata is the only header link and targets the canonical movie id", () => {
  assert.match(videoCarousel, /<Link href=\{`\/movies\/\$\{encodeURIComponent\(String\(item\.movie\.id\)\)\}`\}[\s\S]*<img[\s\S]*\{title\}[\s\S]*<\/Link>/);
  const expandedHeader = videoCarousel.slice(videoCarousel.indexOf("<header className=\"relative z-10"), videoCarousel.indexOf("</header>", videoCarousel.indexOf("<header className=\"relative z-10")));
  assert.equal((expandedHeader.match(/<Link /g) ?? []).length, 1);
});

test("desktop expanded viewer overlays compact metadata on a full-height video", () => {
  assert.match(videoCarousel, /xl:h-\[100dvh\] xl:max-h-full/);
  assert.match(videoCarousel, /xl:absolute xl:inset-x-0 xl:top-0/);
  assert.match(videoCarousel, /xl:bg-transparent/);
  assert.doesNotMatch(videoCarousel, /xl:bg-gradient-to-b|xl:from-black\/90/);
  assert.match(videoCarousel, /flex shrink-0 gap-1 xl:flex-col/);
  assert.match(videoCarousel, /object-contain xl:h-\[100dvh\]/);
  assert.match(videoCarousel, /xl:h-11 xl:w-8/);
});

test("desktop enriched viewer owns real fullscreen and synchronizes native exit", () => {
  assert.match(videoCarousel, /ref=\{fullscreenViewerRef\}/);
  assert.match(videoCarousel, /flushSync\(\(\) => setExpandedIndex\(index\)\)/);
  assert.match(videoCarousel, /viewer\.requestFullscreen\(\)/);
  assert.match(videoCarousel, /document\.addEventListener\("fullscreenchange"/);
  assert.match(videoCarousel, /document\.fullscreenElement !== fullscreenViewerRef\.current/);
  assert.match(videoCarousel, /document\.exitFullscreen\(\)/);
});

test("desktop minimized autoplay starts at zero and loops in order on ended", () => {
  assert.match(videoCarousel, /const activeVideoIndex = useRef\(0\)/);
  assert.match(videoCarousel, /const desktopSequenceStarted = useRef\(false\)/);
  assert.match(videoCarousel, /const firstItem = itemsRef\.current\[0\]/);
  assert.match(videoCarousel, /\(index \+ 1\) % itemsRef\.current\.length/);
  assert.match(videoCarousel, /onEnded=\{\(\) => playNextDesktopVideo\(index\)\}/);
  assert.match(videoCarousel, /pauseAllExcept\(nextId\)/);
});

test("all minimized and expanded players share one mute state", () => {
  assert.match(videoCarousel, /const \[isMuted, setIsMuted\] = useState\(true\)/);
  assert.ok((videoCarousel.match(/muted=\{isMuted\}/g) ?? []).length >= 2);
  assert.ok((videoCarousel.match(/onMutedChange=\{setIsMuted\}/g) ?? []).length >= 2);
  assert.match(videoCarousel, /videoRefs\.current\.forEach[\s\S]*video\.muted = isMuted/);
  assert.match(videoCarousel, /expandedVideoRef\.current\.muted = isMuted/);
});

test("expanded playback pauses cards, pauses between items, and restores visibility autoplay on close", () => {
  assert.match(videoCarousel, /openExpandedViewer[\s\S]*pauseAllExcept\(null\)/);
  assert.match(videoCarousel, /navigateExpandedViewer[\s\S]*expandedVideoRef\.current\?\.pause\(\)/);
  assert.match(videoCarousel, /closeExpandedViewer[\s\S]*expandedVideoRef\.current\?\.pause\(\)/);
  assert.match(videoCarousel, /requestAnimationFrame\(\(\) => playMostVisibleVideo\(\)\)/);
  assert.match(videoCarousel, /VisitedProfileVideoPlayer src=\{slide\.item\.payload\.video_url\} autoPlay=\{slideActive\}/);
});

test("mobile swipe previews adjacent videos and snaps or cancels in 260ms", () => {
  assert.match(videoCarousel, /expandedSlideIndices\.map/);
  assert.match(videoCarousel, /data-expanded-video-slide=\{slideActive \? "current" : slideIndex < expandedIndex \? "previous" : "next"\}/);
  assert.match(videoCarousel, /key=\{slideId\}/);
  assert.match(videoCarousel, /translateY\(\$\{\(slideIndex - expandedIndex\) \* 100\}%\)/);
  assert.match(videoCarousel, /preload="auto"/);
  assert.match(videoCarousel, /transition: swipeAnimating \? "transform 260ms ease-out" : "none"/);
  assert.match(videoCarousel, /setSwipeOffset\(0\)[\s\S]*return/);
  assert.match(videoCarousel, /window\.setTimeout\([\s\S]*260/);
  assert.match(videoCarousel, /readyState >= HTMLMediaElement\.HAVE_CURRENT_DATA/);
  assert.match(videoCarousel, /addEventListener\("loadeddata"/);
  assert.doesNotMatch(videoCarousel, /swipeCoverSrc/);
});

test("expanded current slide has a non-collapsing viewport and starts at position zero", () => {
  assert.match(videoCarousel, /relative flex h-full w-full max-h-full max-w-full flex-col/);
  assert.match(videoCarousel, /relative min-h-0 w-full max-w-full flex-1 overflow-hidden/);
  assert.match(videoCarousel, /const slideActive = slideIndex === expandedIndex/);
  assert.match(videoCarousel, /src=\{slide\.item\.payload\.video_url\}/);
  assert.match(videoCarousel, /transform: `translateY\(\$\{\(slideIndex - expandedIndex\) \* 100\}%\)`/);
  assert.doesNotMatch(videoCarousel, /data-expanded-video-slide=\{slideActive[^\n]*(opacity-0|invisible|hidden)/);
});

test("video surface toggles playback without persistent transport controls", () => {
  assert.match(videoCarousel, /const togglePlayback = \(\) =>/);
  assert.match(videoCarousel, /if \(willPlay\) void video\.play\(\)\.catch/);
  assert.match(videoCarousel, /else video\.pause\(\)/);
  assert.match(videoCarousel, /onClick=\{interactive \? togglePlayback : undefined\}/);
  assert.match(videoCarousel, /manuallyPausedVideoId\.current === nextId/);
  assert.match(videoCarousel, /onManualToggle=\{\(paused\)/);
  assert.match(videoCarousel, /event\.stopPropagation\(\); onMutedChange/);
});

test("visited tab and document visibility pause and resume the same in-memory player", () => {
  assert.match(activityColumn, /VisitedProfileVideoReactions key=\{normalizedViewedUsername\} username=\{normalizedViewedUsername\} isActive=\{effectiveActiveTab === "activity" && visitedActivityTab === "video_reactions"\}/);
  assert.match(videoCarousel, /isVideoTabActive\.current = isActive/);
  assert.match(videoCarousel, /pauseForInterruption/);
  assert.match(videoCarousel, /resumeAfterInterruption/);
  assert.match(videoCarousel, /if \(!isActive\) pauseForInterruption\(\)/);
  assert.match(videoCarousel, /document\.addEventListener\("visibilitychange"/);
  assert.match(videoCarousel, /if \(document\.hidden\) pauseForInterruption\(\)/);
  assert.match(videoCarousel, /manuallyPausedVideoId\.current === resume\.videoId/);
  assert.doesNotMatch(videoCarousel, /localStorage|sessionStorage/);
});

test("a new visited username resets transient playback and mute state", () => {
  assert.match(videoCarousel, /activeVideoIndex\.current = 0/);
  assert.match(videoCarousel, /activeVideoId\.current = null/);
  assert.match(videoCarousel, /manuallyPausedVideoId\.current = null/);
  assert.match(videoCarousel, /resumeAfterInterruption\.current = null/);
  assert.match(videoCarousel, /setIsMuted\(true\)/);
  assert.match(activityColumn, /key=\{normalizedViewedUsername\}/);
  assert.match(videoCarousel, /\}, \[username\]\)/);
});
