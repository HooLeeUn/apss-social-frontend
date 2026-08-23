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
    assert.match(fs.readFileSync(file, "utf8"), new RegExp(`(?:data-tour|tourTarget)=["']${target}["']`));
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

test("tour navigation keeps a locked Feed card and has a dedicated final screen", () => {
  const provider = fs.readFileSync("components/onboarding/OnboardingProvider.tsx", "utf8");
  assert.match(provider, /lockedCardRef/);
  assert.match(provider, /resolveVisible\(selector, lockedCardRef\.current\)/);
  assert.match(provider, /isFeedFinal/);
  assert.match(provider, /move\(available\.length - 1\)/);
  assert.doesNotMatch(provider, /useEffect\([^]*\}, \[tour\]\)/);
});
