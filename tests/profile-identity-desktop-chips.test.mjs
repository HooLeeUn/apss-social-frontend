import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cardSource = await readFile(new URL("../components/profile-feed/ProfileIdentityCard.tsx", import.meta.url), "utf8");
const profileFeedSource = await readFile(new URL("../app/profile-feed/page.tsx", import.meta.url), "utf8");

test("authenticated Profile Feed fits all personal-data chips in one desktop row", () => {
  assert.match(profileFeedSource, /constrainDesktopAvatar\s+fitDesktopPersonalDataRow/);
  assert.match(cardSource, /lg:flex-nowrap lg:gap-1/);
  assert.match(cardSource, /lg:whitespace-nowrap lg:px-1\.5 lg:text-\[11px\]/);
  assert.match(cardSource, /hidden min-w-0 shrink-0 whitespace-nowrap[\s\S]*lg:inline-block/);
});

test("desktop-only fitting leaves the existing mobile follower chip in place", () => {
  assert.match(cardSource, /fitDesktopPersonalDataRow \? "lg:hidden"/);
  assert.match(cardSource, /px-3 py-1 text-right text-xs/);
  assert.match(cardSource, /const cardClassName = `[\s\S]*p-5/);
  assert.match(cardSource, /const avatarClassName = `[\s\S]*constrainDesktopAvatar/);
});
