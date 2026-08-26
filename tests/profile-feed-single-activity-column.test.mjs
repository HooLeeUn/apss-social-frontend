import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profileFeed = readFileSync(new URL("../app/profile-feed/page.tsx", import.meta.url), "utf8");
const activityColumn = readFileSync(new URL("../components/profile-feed/MyActivityColumn.tsx", import.meta.url), "utf8");

test("Profile Feed mounts one responsive MyActivityColumn", () => {
  const instances = profileFeed.match(/<MyActivityColumn\b/g) ?? [];

  assert.equal(instances.length, 1);
  assert.match(profileFeed, /profile-feed-mobile-content-row[^\n]+xl:contents/);
  assert.match(profileFeed, /profile-feed-mobile-content-track[^\n]+xl:contents/);
  assert.match(profileFeed, /profile-feed-mobile-content-panel[^\n]+xl:contents/);
  assert.match(activityColumn, /data-tour=\{isOwnProfile \? "profile-activity" : undefined\}/);
});

test("the single activity controller keeps responsive navigation inputs", () => {
  const instance = profileFeed.match(/<MyActivityColumn[\s\S]*?\/>/)?.[0] ?? "";

  assert.match(instance, /isOwnProfile/);
  assert.match(instance, /initialActiveTab=\{initialActivityTab\}/);
  assert.match(instance, /hidePrivateInbox=\{profileUser\?\.friendRequestsRestricted \?\? null\}/);
  assert.match(instance, /activeTabRequest=\{activityTabRequest\}/);
});
