import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const apiSource = fs.readFileSync("lib/onboarding/api.ts", "utf8");

function loadOnboardingApi(apiFetch) {
  const compiled = ts.transpileModule(apiSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const apiModule = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (specifier) => specifier === "../api" ? { apiFetch } : require(specifier),
    apiModule,
    apiModule.exports,
  );
  return apiModule.exports;
}

test("onboarding uses one provider and independent route definitions", () => {
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  assert.match(provider, /function GuidedTour/);
  assert.match(tours, /"feed", "profile_feed", "detail_movie"/);
  assert.match(tours, /\/movies/);
});

test("onboarding queue is scoped by user, tour and version", () => {
  const api = fs.readFileSync("lib/onboarding/api.ts", "utf8");
  assert.match(api, /qnext:onboarding:\$\{encodeURIComponent\(user\)\}:\$\{tour\}:v\$\{version\}/);
  assert.match(api, /current_step/);
});

test("stable tour selectors do not target style classes", () => {
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  assert.doesNotMatch(tours, /target:\s*["'`]\./);
  for (const key of ["feed-search", "profile-info", "detail-info"]) assert.match(tours, new RegExp(key));
});

test("onboarding GET uses the shared me endpoint and normalizes all tours", async () => {
  const requests = [];
  const api = loadOnboardingApi(async (endpoint, options) => {
    requests.push({ endpoint, options });
    return {
      feed: { status: "pending", version: 1, current_step: null },
      profile_feed: { status: "completed", version: 2, current_step: null },
      detail_movie: { status: "in_progress", version: 3, current_step: 4 },
    };
  });

  const states = await api.getOnboardingStates();
  assert.deepEqual(requests, [{ endpoint: "/me/onboarding/", options: undefined }]);
  assert.deepEqual(states.find((state) => state.tour === "detail_movie"), {
    tour: "detail_movie", status: "in_progress", version: 3, currentStep: 4,
  });
});

test("onboarding PATCH uses the same endpoint, includes version, and extracts the requested tour", async () => {
  const requests = [];
  const api = loadOnboardingApi(async (endpoint, options) => {
    requests.push({ endpoint, options });
    return {
      feed: { status: "in_progress", version: 7, current_step: 0 },
      profile_feed: { status: "pending", version: 1, current_step: null },
      detail_movie: { status: "pending", version: 1, current_step: null },
    };
  });

  const updated = await api.updateOnboardingState("feed", "in_progress", 0, 7);
  assert.equal(requests[0].endpoint, "/me/onboarding/");
  assert.equal(requests[0].options.method, "PATCH");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    tour: "feed", status: "in_progress", version: 7, current_step: 0,
  });
  assert.deepEqual(updated, { tour: "feed", status: "in_progress", version: 7, currentStep: 0 });
});

test("every onboarding ready target exists in its route markup", () => {
  const targets = [
    ["app/feed/page.tsx", "feed-search"],
    ["app/profile-feed/page.tsx", "profile-info"],
    ["app/movies/[id]/page.tsx", "detail-info"],
  ];
  for (const [file, target] of targets) {
    assert.match(fs.readFileSync(file, "utf8"), new RegExp(target));
  }
});

test("desktop Feed exposes every exact tour control and ten conceptual steps", () => {
  const feed = fs.readFileSync("app/feed/page.tsx", "utf8");
  const card = fs.readFileSync("components/MovieCard.tsx", "utf8");
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  for (const target of ["feed-profile", "feed-notifications", "feed-search", "feed-genres"]) {
    assert.match(feed, new RegExp(target));
  }
  for (const target of ["feed-card", "feed-card-poster", "feed-card-title", "feed-card-synopsis", "feed-card-tag", "feed-card-ticket", "feed-card-rating-overall", "feed-card-rating-following", "feed-card-rating-mine"]) {
    assert.match(card, new RegExp(target));
  }
  assert.match(tours, /for \(let index = 5; index < steps\.length/);
  assert.match(tours, /steps\[9\]\.callouts/);
});

test("Profile Feed completion returns both responsive tours to the document top", () => {
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  assert.match(tours, /Aquí puedes seleccionar y dar a conocer tus tres producciones favoritas \+/);
  assert.match(provider, /await closeWithStatus\("completed"\)/);
  assert.match(provider, /shouldResetProfileDesktop/);
  assert.match(provider, /shouldResetProfileMobile/);
  assert.match(provider, /matchMedia\("\(min-width: 768px\)"\)/);
  assert.match(provider, /requestAnimationFrame\(\(\) => window\.scrollTo\(\{ top: 0, behavior: "smooth" \}\)\)/);
  const skipBody = provider.match(/const handleSkip = useCallback\(\(\) => \{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(skipBody, /scrollTo/);
});

test("mobile Profile Feed has nine prepared structural steps and six dock targets", () => {
  const page = fs.readFileSync("app/profile-feed/page.tsx", "utf8");
  const activity = fs.readFileSync("components/profile-feed/MyActivityColumn.tsx", "utf8");
  const quickNavigation = fs.readFileSync("components/profile-feed/ProfileQuickNavigation.tsx", "utf8");
  const connections = fs.readFileSync("components/profile-feed/TopUsersSection.tsx", "utf8");
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  for (const target of ["profile-connections-mobile", "profile-activity-mobile", "profile-inbox-mobile", "profile-ratings-mobile", "profile-list-mobile", "profile-recommendations-mobile", "profile-following-activity-mobile"]) {
    assert.match(`${page}\n${activity}\n${connections}\n${tours}`, new RegExp(target));
  }
  for (const target of ["profile-quick-following", "profile-quick-friends", "profile-quick-activity", "profile-quick-list", "profile-quick-recommendations", "profile-quick-following-activity"]) {
    assert.match(page, new RegExp(target));
  }
  assert.match(quickNavigation, /visible \|\| forceVisible/);
  assert.match(tours, /mobileSteps = steps\.map/);
  assert.match(tours, /profile-mobile-following-activity/);
  assert.match(tours, /mobileScroll: index >= 2 \? "below-tooltip"/);
  assert.match(provider, /tour\.id === "profile_feed" && mobile/);
  assert.match(tours, /¡Tu Profile Feed está listo!/);
  assert.match(tours, /Your Profile Feed is ready!/);
});

test("tour navigation keeps a locked Feed card and has a dedicated final screen", () => {
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  assert.match(provider, /lockedCardRef/);
  assert.match(provider, /resolveVisible\(selector, lockedCardRef\.current\)/);
  assert.match(provider, /selector === FEED_CARD_SELECTOR/);
  assert.match(provider, /return lockedCardRef\.current/);
  assert.match(provider, /isFeedFinal/);
  assert.match(provider, /move\(available\.length - 1\)/);
  assert.doesNotMatch(provider, /useEffect\([^]*\}, \[tour\]\)/);
});

test("spotlight navigation preserves its previous rectangle and animates to the next target", () => {
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  const moveBody = provider.match(/const move = \(next: number\) => \{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(moveBody, /setRect\(null\)/);
  assert.match(moveBody, /setCallouts\(\[\]\)/);
  assert.match(provider, /left 450ms ease-in-out/);
  assert.match(provider, /top 450ms ease-in-out/);
  assert.match(provider, /width 450ms ease-in-out/);
  assert.match(provider, /height 450ms ease-in-out/);
});

test("all shared onboarding drawers and spotlights use the emerald tour palette", () => {
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  assert.match(provider, /const TOUR_BORDER_COLOR = "#20D98B"/);
  assert.match(provider, /const TOUR_SPOTLIGHT_COLOR = "rgba\(32, 217, 139, 0\.12\)"/);
  assert.equal((provider.match(/borderColor: TOUR_BORDER_COLOR/g) ?? []).length, 3);
  assert.match(provider, /backgroundColor:[^\n]+TOUR_SPOTLIGHT_COLOR/);
});

test("desktop Feed callouts use a start anchor and alternating placements", () => {
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  assert.match(tours, /feed-card-title[^}]+anchor: "start"/);
  assert.match(tours, /feed-card-tag[^}]+placement: "top"/);
  assert.match(tours, /feed-card-ticket[^}]+placement: "bottom"/);
  assert.match(tours, /feed-card-rating-following[^}]+placement: "bottom"/);
  assert.match(provider, /Math\.min\(rect\.width \* 0\.2, 30\)/);
  assert.match(provider, /boxesOverlap/);
  assert.match(provider, /placedBoxes\.some/);
});

test("completion and skip suppress resume until their optimistic state is settled", () => {
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  const closingBody = provider.match(/const closeWithStatus[^]*?\}, \[persist\]\);/)?.[0] ?? "";
  assert.ok(closingBody.indexOf("setIsClosing(true)") < closingBody.indexOf("await persist"));
  assert.ok(closingBody.indexOf("await persist") < closingBody.indexOf("setRunning(false)"));
  assert.match(provider, /if \(isClosing\) return null/);
  assert.match(provider, /resume=\{state\.status === "in_progress"\}/);
  assert.match(provider, /closeWithStatus\("skipped"\)/);
  assert.match(provider, /closeWithStatus\("completed"\)/);
});

test("desktop Feed fades in only its initial spotlight without resetting geometry", () => {
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  assert.match(provider, /initialSpotlightRevealedRef/);
  assert.match(provider, /index === 0/);
  assert.match(provider, /background-color 420ms ease-out/);
  assert.match(provider, /requestAnimationFrame\(\(\) => setInitialSpotlightVisible\(true\)\)/);
  assert.doesNotMatch(provider.match(/initialSpotlightRevealedRef[^]*?return <div className="fixed inset-0 z-\[10000\]"/)?.[0] ?? "", /setRect\(null\)/);
});

test("desktop Feed provides six decorative step icons and updated localized copy", () => {
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  for (const icon of ["search", "filter", "profile", "notifications", "menu", "productions"]) {
    assert.match(tours, new RegExp(`"${icon}"`));
  }
  assert.match(provider, /function TourStepIcon/);
  assert.match(provider, /"aria-hidden": true/);
  assert.match(tours, /acceder a tu Perfil personal/);
  assert.match(tours, /abrir el detalle de la producción/);
  assert.match(tours, /hará parte del promedio en Calificación general/);
  assert.match(tours, /contribute to the Overall Rating average/);
  assert.match(tours, /access your Profile Feed/);
});

test("desktop Profile Feed exposes all nine structural targets", () => {
  const page = fs.readFileSync("app/profile-feed/page.tsx", "utf8");
  const activity = fs.readFileSync("components/profile-feed/MyActivityColumn.tsx", "utf8");
  const connections = fs.readFileSync("components/profile-feed/TopUsersSection.tsx", "utf8");
  for (const target of ["profile-info", "profile-favorites", "profile-list", "profile-recommendations", "profile-following-activity"]) assert.match(page, new RegExp(target));
  for (const target of ["profile-inbox", "profile-ratings"]) assert.match(activity, new RegExp(target));
  assert.match(connections, /data-tour=\{tourTarget\}/);
  assert.match(page, /tourTarget="profile-connections"/);
  assert.doesNotMatch(page, /<section data-tour="profile-connections"[^>]+profile-feed-connections-search/);
});

test("Profile Feed prepares React view state before resolving each controlled step", () => {
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  const page = fs.readFileSync("app/profile-feed/page.tsx", "utf8");
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  assert.match(provider, /onboardingPrepareStepEventName/);
  assert.match(provider, /requestAnimationFrame\(\(\) => \{ secondFrame = window\.requestAnimationFrame\(setupTarget\)/);
  assert.doesNotMatch(provider, /querySelector\([^)]*\)\.click\(/);
  for (const action of ["profile-activity", "profile-inbox", "profile-ratings", "profile-list", "profile-recommendations"]) {
    assert.match(tours, new RegExp(`"${action}"`));
    assert.match(page, new RegExp(`action === "${action}"`));
  }
  assert.match(page, /activeTabRequest=\{activityTabRequest\}/);
});

test("Profile Feed has nine icons, complete copy, and no optional structural steps", () => {
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  assert.match(tours, /"profile", "favorite", "connections", "activity", "inbox", "ratings", "list", "recommendations", "menu"/);
  assert.match(tours, /step\.optional = false/);
  assert.match(tours, /Buzón privado/);
  assert.match(tours, /Private Inbox/);
  assert.match(tours, /descubre qué están viendo, calificando, comentando o recomendando/);
  assert.match(provider, /tour\.id === "profile_feed"/);
});

test("desktop Detail Movie keeps its approved independent eight-step sequence", () => {
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  const types = fs.readFileSync("lib/onboarding/types.ts", "utf8");
  assert.match(tours, /const detailDesktopSelectors = \["detail-info", "detail-trailer", "detail-video-reactions", "detail-rec", "detail-comment-composer", "detail-public-comments", "detail-directed-comments", "detail-profile"\]/);
  assert.match(tours, /desktopSteps = id === "detail_movie"/);
  assert.match(types, /desktopSteps\?: TourStepDefinition\[\]/);
  assert.match(tours, /incluida la información de disponibilidad en plataformas según tu país, director y reparto/);
  assert.match(tours, /including platform availability in your country, director and cast/);
  assert.doesNotMatch(tours.match(/const detailDesktopCopy[^]*?} as const;/)?.[0] ?? "", /Compara las calificaciones|Interactúa con otras reacciones|Participa en los comentarios/);
});

test("mobile Detail Movie exposes and prepares eight structural steps plus its final screen", () => {
  const page = fs.readFileSync("app/movies/[id]/page.tsx", "utf8");
  const card = fs.readFileSync("components/MovieCard.tsx", "utf8");
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  for (const target of ["detail-info-mobile", "detail-poster-mobile", "detail-more-mobile"]) assert.match(card, new RegExp(target));
  for (const target of ["detail-video-tab-mobile", "detail-rec-mobile", "detail-comment-tab-mobile", "detail-public-comments-mobile", "detail-directed-comments-mobile", "detail-profile-avatar-mobile"]) assert.match(page, new RegExp(target));
  for (const action of ["detail-mobile-video", "detail-mobile-comments-public", "detail-mobile-comments-directed", "detail-mobile-restore"]) assert.match(page + tours + provider, new RegExp(action));
  assert.match(tours, /Mantén presionado el póster para reproducir el tráiler de la producción/);
  assert.match(tours, /Desliza a la izquierda para ver más detalles/);
  assert.match(tours, /¡Ya conoces el detalle de una producción!/);
  assert.match(provider, /shouldResetDetailMobile/);
  assert.match(page, /detail-\$\{activeCommentsTab\}-comments-section-mobile/);
  assert.match(tours, /index === 3 \? "minimal-sticky"/);
  assert.match(tours, /index === 5 \|\| index === 6 \? "below-tooltip"/);
  assert.match(provider, /targetRect\.top < safeTop/);
  assert.match(provider, /targetRect\.bottom > safeBottom/);
  assert.match(provider, /selector\.includes\("comments-section-mobile"\)/);
  assert.match(provider, /window\.visualViewport\?\.addEventListener\("resize", update\)/);
});

test("desktop Detail Movie exposes precise structural targets and prepares React view state", () => {
  const page = fs.readFileSync("app/movies/[id]/page.tsx", "utf8");
  const card = fs.readFileSync("components/MovieCard.tsx", "utf8");
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  for (const target of ["detail-video-reactions", "detail-rec", "detail-comment-composer", "detail-public-comments", "detail-directed-comments", "detail-profile"]) assert.match(page, new RegExp(target));
  for (const target of ["detail-info", "detail-trailer"]) assert.match(card, new RegExp(target));
  assert.match(page, /<div data-tour="detail-info"><MovieCard/);
  assert.match(page + card, /data-tour-desktop/);
  assert.match(provider, /measureSpotlightRect/);
  assert.match(provider, /posterRect\.bottom, targetRect\.bottom/);
  assert.match(provider, /tour\.id === "feed" \|\| \(tour\.id === "detail_movie" && !mobile\)/);
  for (const action of ["detail-video", "detail-comments-public", "detail-comments-directed", "detail-restore"]) {
    assert.match(page + provider, new RegExp(`"${action}"`));
  }
  assert.doesNotMatch(provider, /querySelector\([^)]*\)\.click\(/);
});

test("mobile Feed has ten breakpoint-specific targets without replacing desktop targets", () => {
  const feed = fs.readFileSync("app/feed/page.tsx", "utf8");
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  for (const target of ["feed-search-mobile", "feed-profile-mobile", "feed-notifications-mobile", "feed-menu-mobile"]) assert.match(feed, new RegExp(target));
  assert.match(tours, /const mobileTargets = \["feed-search-mobile", "feed-genres", "feed-profile-mobile", "feed-notifications-mobile", "feed-menu-mobile", "feed-card", "feed-card", "feed-card", "feed-card", "feed-card"\]/);
  assert.match(tours, /mobileSteps = steps\.map/);
  assert.match(provider, /mobile && tour\.mobileSteps \? tour\.mobileSteps/);
  assert.match(provider, /tour\.id === "feed" \? "\(max-width: 1023px\)" : "\(max-width: 767px\)"/);
  for (const desktopTarget of ["feed-search", "feed-profile", "feed-notifications", "feed-menu"]) assert.match(feed, new RegExp(desktopTarget));
});

test("mobile Feed forces and restores its dock and has adaptive card positioning and final screen", () => {
  const feed = fs.readFileSync("app/feed/page.tsx", "utf8");
  const tours = fs.readFileSync("lib/onboarding/tours.ts", "utf8");
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  assert.match(feed, /isMobileBottomNavVisible \|\| isMobileOnboardingNavForced/);
  assert.match(feed, /action === "feed-mobile-panel-show"/);
  assert.match(feed, /action === "feed-mobile-panel-release"/);
  assert.match(tours, /feed-mobile-panel-show/);
  assert.match(provider, /window\.visualViewport/);
  assert.match(provider, /safe-area-inset-bottom/);
  assert.match(provider, /viewportHeight - targetRect\.height - bottomMargin/);
  assert.match(provider, /tour\.id === "feed" \|\| \(tour\.id === "detail_movie" && !mobile\)/);
  assert.match(provider, /shouldResetFeedMobile/);
  assert.match(provider, /restoreFeedMobilePanel/);
});
