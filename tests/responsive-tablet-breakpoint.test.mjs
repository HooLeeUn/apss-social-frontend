import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("tablet widths stay on the mobile branches until the xl desktop breakpoint", () => {
  const profile = read("app/profile-feed/page.tsx");
  const detail = read("app/movies/[id]/page.tsx");
  const feed = read("app/feed/page.tsx");
  const tours = read("components/onboarding/OnboardingProvider.tsx");

  assert.match(profile, /profile-feed-mobile-content-row[^\n]+xl:hidden/);
  assert.match(profile, /data-tour="profile-activity"[^\n]+hidden xl:block/);
  assert.match(profile, /renderMovieListPanel\("hidden h-\[30rem\] xl:flex/);
  assert.match(detail, /data-mobile-comment-tabs[^\n]+xl:hidden/);
  assert.match(detail, /data-desktop-comment-tabs[^\n]+hidden[^\n]+xl:flex/);
  assert.match(feed, /feed-mobile-only[^\n]+xl:hidden/);
  assert.match(feed, /feed-desktop-only[^\n]+hidden[^\n]+xl:/);
  assert.match(tours, /const mobile =[^\n]+\(max-width: 1279px\)/);
});
