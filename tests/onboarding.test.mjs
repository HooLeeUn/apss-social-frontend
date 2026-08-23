import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

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
