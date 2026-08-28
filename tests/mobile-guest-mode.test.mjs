import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const guestHook = read("../hooks/useDesktopGuest.ts");
const routeGuard = read("../components/GuestRouteGuard.tsx");
const login = read("../app/page.tsx");
const feed = read("../app/feed/page.tsx");
const detail = read("../app/movies/[id]/page.tsx");
const movieCard = read("../components/MovieCard.tsx");
const profile = read("../app/users/[username]/page.tsx");
const activity = read("../components/profile-feed/MyActivityColumn.tsx");
const profileVideos = read("../components/profile-feed/VisitedProfileVideoReactions.tsx");
const comments = read("../components/social/CommentsList.tsx");

test("the existing guest session supports phones without classifying tablets as phones", () => {
  assert.match(guestHook, /matchMedia\("\(max-width: 767px\)"\)/);
  assert.match(guestHook, /isGuestExperience: auth\.isGuest && \(desktop \|\| mobile\)/);
  assert.match(routeGuard, /!isDesktop && !isMobile/);
  assert.match(login, /onClick=\{continueAsGuest\} className="mx-auto mt-4 block[^\"]*md:hidden xl:block/);
});

test("mobile feed reuses guest controls and write gates", () => {
  assert.match(feed, /isGuestExperience: isDesktopGuest/);
  assert.match(feed, /feed-mobile-only[\s\S]*?isDesktopGuest \? <GuestSignupRec[^>]+gateVariant="profile"/);
  assert.match(feed, /guestActions=\{isDesktopGuest\}/);
  assert.match(feed, /ratingReadOnly=\{isDesktopGuest\}/);
  assert.match(feed, /showGuestGate\("feed-mobile-avatar", "explore-profile"\)/);
  assert.match(feed, /showGuestGate\("feed-mobile-notifications", "notifications"\)/);
});

test("mobile detail is read-only, keeps public content, and gates expansion", () => {
  assert.match(detail, /data-video-reaction-rec[\s\S]*?className=\{desktopGuest \? "hidden"/);
  assert.match(detail, /overflow-y-hidden[\s\S]*?showGuestGate\(guestVideoGateId, "more"\)/);
  assert.match(detail, /if \(desktopGuest\) \{ showGuestGate\(guestVideoGateId, "expand"\); return; \}/);
  assert.match(detail, /!isDesktopGuest \? <CommentComposer/);
  assert.match(detail, /unboundedOnMobile=\{!isDesktopGuest\}/);
  assert.match(detail, /placement="section-center" anchorRef=\{videoGateAnchorRef\}/);
  assert.match(detail, /placement="section-center" anchorRef=\{publicCommentsScrollRef\}/);
  assert.match(movieCard, /guestActions \? <span aria-label=\{tmdbTooltip\}/);
});

test("mobile visited profiles reuse viewport gates and preserve outer scrolling", () => {
  assert.match(profile, /isGuestExperience: isDesktopGuest/);
  assert.match(profile, /gateVariant="profile"/);
  assert.match(activity, /outerScroller\.scrollTop \+= scrollDelta/);
  assert.match(profileVideos, /cards\.slice\(0, Math\.max\(1, guestVisibleCount\)\)/);
  assert.doesNotMatch(profileVideos, /max-h-\[70dvh\] overflow-y-hidden/);
  assert.match(profileVideos, /showGuestGate\(guestGateId, "expand"\)/);
  assert.match(comments, /outer\.scrollTop \+= delta/);
  assert.match(activity, /placement=\{isMobile \? "viewport-center" : "below"\}/);
});
