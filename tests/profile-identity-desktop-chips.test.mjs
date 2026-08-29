import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cardSource = await readFile(new URL("../components/profile-feed/ProfileIdentityCard.tsx", import.meta.url), "utf8");
const profileFeedSource = await readFile(new URL("../app/profile-feed/page.tsx", import.meta.url), "utf8");
const visitedProfileSource = await readFile(new URL("../app/users/[username]/page.tsx", import.meta.url), "utf8");

test("authenticated Profile Feed fits all personal-data chips in one desktop row", () => {
  assert.match(profileFeedSource, /constrainDesktopAvatar\s+fitDesktopPersonalDataRow/);
  assert.match(cardSource, /xl:flex-nowrap xl:gap-1/);
  assert.match(cardSource, /xl:whitespace-nowrap xl:px-1\.5 xl:text-\[11px\]/);
  assert.match(cardSource, /hidden min-w-0 shrink-0 whitespace-nowrap[\s\S]*xl:inline-block/);
});

test("desktop-only fitting leaves the existing mobile follower chip in place", () => {
  assert.match(cardSource, /fitDesktopPersonalDataRow \? "xl:hidden"/);
  assert.match(cardSource, /px-3 py-1 text-right text-xs/);
  assert.match(cardSource, /const cardClassName = `[\s\S]*p-5/);
  assert.match(cardSource, /const avatarClassName = `[\s\S]*constrainDesktopAvatar/);
});

test("visited profile identity column allows long names to truncate without widening its grid track", () => {
  assert.match(visitedProfileSource, /className="min-w-0 flex flex-col gap-5 xl:self-end/);
  assert.match(cardSource, /className="truncate overflow-hidden text-ellipsis whitespace-nowrap text-base font-medium text-zinc-300"/);
});

test("visited profile keeps its desktop avatar and personal-data chips inside the fixed identity column", () => {
  assert.match(visitedProfileSource, /xl:\[&>div>div:nth-child\(2\)>div:last-child\]:right-4/);
  assert.match(visitedProfileSource, /autoHeight\s+fitDesktopPersonalDataRow/);
  assert.match(cardSource, /fitDesktopPersonalDataRow \? "xl:flex-nowrap xl:gap-1"/);
  assert.match(cardSource, /fitDesktopPersonalDataRow && canShowFollowers && canShowAge/);
});
