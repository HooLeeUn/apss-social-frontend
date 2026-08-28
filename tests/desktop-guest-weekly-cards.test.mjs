import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const feed = readFileSync(new URL("../app/feed/page.tsx", import.meta.url), "utf8");
const section = readFileSync(new URL("../components/WeeklyRecommendationsSection.tsx", import.meta.url), "utf8");
const hero = readFileSync(new URL("../components/WeeklyHeroCard.tsx", import.meta.url), "utf8");
const mini = readFileSync(new URL("../components/WeeklyMiniCard.tsx", import.meta.url), "utf8");

test("desktop guest state reaches every weekly recommendation card", () => {
  assert.match(feed, /WeeklyRecommendationsSection desktopGuest=\{isDesktopGuest\}/);
  assert.match(section, /WeeklyHeroCard[\s\S]*?desktopGuest=\{desktopGuest\}/);
  assert.match(section, /WeeklyMiniCard[\s\S]*?desktopGuest=\{desktopGuest\}/);
});

for (const [name, source] of [["hero", hero], ["mini", mini]]) {
  test(`weekly ${name} guest actions gate before writes and rating popover`, () => {
    assert.ok(source.indexOf("if (desktopGuest) { showGuestGate(`${gateBaseId}:list`") < source.indexOf("if (onToggleMyList) await"));
    assert.ok(source.indexOf("if (desktopGuest) { showGuestGate(`${gateBaseId}:recommend`") < source.indexOf("if (onToggleMyRecommendations) await"));
    assert.ok(source.indexOf("desktopGuest && movie ?") < source.indexOf("movie && onRated ?"));
    assert.match(source, /GuestContentGate gateId=\{`\$\{gateBaseId\}:list`\} placement="below-end"/);
    assert.match(source, /GuestContentGate gateId=\{`\$\{gateBaseId\}:recommend`\} placement="below-end"/);
  });
}
