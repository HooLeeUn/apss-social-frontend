import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adapters = readFileSync(new URL("../lib/profile-feed/adapters.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/profile-feed/page.tsx", import.meta.url), "utf8");

test("getMyProfile shares only its in-flight request and clears it after settlement", () => {
  assert.match(adapters, /let inFlightMyProfileRequest: Promise<SocialUser \| null> \| null = null/);
  assert.match(adapters, /if \(inFlightMyProfileRequest\) return inFlightMyProfileRequest/);
  assert.match(adapters, /inFlightMyProfileRequest = request/);
  assert.match(adapters, /request\.then\(clearInFlightRequest, clearInFlightRequest\)/);
  assert.match(adapters, /inFlightMyProfileRequest === request\) inFlightMyProfileRequest = null/);
});

test("profile identity reconciles independent profile, personal-data, and privacy requests", () => {
  const loader = page.slice(page.indexOf("const loadOwnProfileData"), page.indexOf("const handleAcceptFriendRequest"));
  assert.doesNotMatch(loader, /Promise\.all/);
  assert.equal((loader.match(/getMyProfile\(\)/g) ?? []).length, 1);
  assert.match(loader, /myProfileSettled = true/);
  assert.match(loader, /personalData\?\.avatar \?\? myProfile\?\.avatarUrl/);
  assert.match(loader, /privacySettings\?\.visibility \?\? myProfile\?\.profileVisibility/);
  assert.match(loader, /setLoadingProfileUser\(false\)/);
});

test("partial personal-data or privacy failures do not clear a successful profile", () => {
  const loader = page.slice(page.indexOf("const loadOwnProfileData"), page.indexOf("const handleAcceptFriendRequest"));
  assert.equal((loader.match(/\.catch\(\(\) => undefined\)/g) ?? []).length, 3);
  assert.doesNotMatch(loader, /setProfileUser\(null\)/);
  assert.equal((loader.match(/getProfilePrivacySettings\(\)/g) ?? []).length, 1);
});

test("profile onboarding target remains intact", () => {
  assert.match(page, /data-tour="profile-info"/);
});
