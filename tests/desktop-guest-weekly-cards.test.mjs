import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const feed = readFileSync(new URL("../app/feed/page.tsx", import.meta.url), "utf8");
const section = readFileSync(new URL("../components/WeeklyRecommendationsSection.tsx", import.meta.url), "utf8");
const hero = readFileSync(new URL("../components/WeeklyHeroCard.tsx", import.meta.url), "utf8");
const mini = readFileSync(new URL("../components/WeeklyMiniCard.tsx", import.meta.url), "utf8");
const gate = readFileSync(new URL("../components/GuestContentGate.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/movies/[id]/page.tsx", import.meta.url), "utf8");
const visitedProfile = readFileSync(new URL("../app/users/[username]/page.tsx", import.meta.url), "utf8");
const activity = readFileSync(new URL("../components/profile-feed/MyActivityColumn.tsx", import.meta.url), "utf8");
const movieCard = readFileSync(new URL("../components/MovieCard.tsx", import.meta.url), "utf8");
const signupRec = readFileSync(new URL("../components/GuestSignupRec.tsx", import.meta.url), "utf8");
const translations = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

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
    assert.match(source, /GuestContentGate gateId=\{`\$\{gateBaseId\}:list`\}[^>]+/);
    assert.match(source, /GuestContentGate gateId=\{`\$\{gateBaseId\}:recommend`\}[^>]+/);
  });
}

test("guest gates use a short portal-capable presentation", () => {
  assert.match(gate, /setTimeout\(closeGuestGate, 2800\)/);
  assert.match(gate, /createPortal\(content, document\.body\)/);
  assert.match(hero, /portal anchorRef=\{listGateAnchorRef\}/);
  assert.match(hero, /portal anchorRef=\{recommendGateAnchorRef\}/);
  assert.match(hero, /gateId=\{`\$\{gateBaseId\}:rate`\} portal anchorRef=\{ratingGateAnchorRef\}/);
  assert.match(mini, /gateId=\{`\$\{gateBaseId\}:rate`\} portal anchorRef=\{ratingGateAnchorRef\}/);
  assert.match(movieCard, /gateId=\{guestRatingGateId\} portal anchorRef=\{guestRatingGateAnchorRef\}/);
});

test("desktop guest contextual controls stay attached to their visible headings and tabs", () => {
  assert.match(detail, /!isDesktopGuest \? <CommentUserSearch/);
  assert.match(detail, /GuestContentGate gateId=\{guestCommentsGateId\} placement="inline-end"/);
  assert.match(visitedProfile, /headerAction=\{isDesktopGuest \? <GuestSignupRec[^>]+gateVariant="profile"/);
  assert.match(activity, /portal anchorRef=\{activeVisitedTabRef\}/);
});

test("signup REC uses the single coordinated gate without a native duplicate tooltip", () => {
  assert.match(signupRec, /instanceGateId = `\$\{gateId\}:\$\{useId\(\)\}`/);
  assert.match(signupRec, /showGuestGate\(instanceGateId, gateVariant\)/);
  assert.match(signupRec, /GuestContentGate gateId=\{instanceGateId\} portal anchorRef=\{anchorRef\}/);
  assert.doesNotMatch(signupRec, /title=\{t\("guestSignUp"\)\}/);
  assert.match(feed, /gateVariant="profile"/);
  assert.match(detail, /gateVariant="availability"/);
  assert.match(translations, /guestProfilePrefix: "Para ver tu perfil"/);
  assert.match(translations, /guestAvailabilityPrefix: "To see availability in your country,"/);
});

test("each mounted card owns a unique contextual gate id", () => {
  assert.match(movieCard, /guestGateInstanceId = useId\(\)/);
  assert.match(hero, /gateInstanceId = useId\(\)/);
  assert.match(mini, /gateInstanceId = useId\(\)/);
});

test("portal gates wait for measured coordinates instead of rendering a top-left duplicate", () => {
  assert.match(gate, /if \(portal\) return portalPosition \? createPortal\(content, document\.body\) : null/);
});
