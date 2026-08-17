import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/profile-feed/page.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("../components/profile-feed/ProfileIdentityCard.tsx", import.meta.url), "utf8");
const visitedProfile = readFileSync(new URL("../app/users/[username]/page.tsx", import.meta.url), "utf8");

test("own Profile Feed avatar links to Personal Data with a localized label", () => {
  assert.match(page, /avatarHref="\/settings\/personal-data"/);
  assert.match(page, /avatarLinkLabel=\{t\("profileFeedPersonalDataAvatarLink"\)\}/);
  assert.match(card, /<Link href=\{avatarHref\} aria-label=\{avatarLinkLabel\}/);
});

test("avatar containment adjustment is desktop-only and opt-in", () => {
  assert.match(card, /constrainDesktopAvatar \? "lg:top-20 lg:h-\[72px\] lg:w-\[72px\]" : ""/);
  assert.match(card, /top-24 h-20 w-20/);
  assert.match(page, /constrainDesktopAvatar/);
  assert.doesNotMatch(visitedProfile, /constrainDesktopAvatar|avatarHref/);
});
