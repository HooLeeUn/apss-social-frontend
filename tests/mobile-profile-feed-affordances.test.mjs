import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const mini = read("../components/WeeklyMiniCard.tsx");
const gate = read("../components/GuestContentGate.tsx");
const connections = read("../components/profile-feed/TopUsersSection.tsx");
const navigation = read("../components/profile-feed/ProfileQuickNavigation.tsx");

test("weekly mini-card Tag and Ticket gates use mobile viewport-safe portal positioning", () => {
  assert.match(mini, /gateId=\{`\$\{gateBaseId\}:list`\} placement="below-end" mobilePortal anchorRef=\{listGateAnchorRef\}/);
  assert.match(mini, /gateId=\{`\$\{gateBaseId\}:recommend`\} placement="below-end" mobilePortal anchorRef=\{recommendGateAnchorRef\}/);
  assert.match(gate, /matchMedia\("\(max-width: 1279px\)"\)/);
  assert.match(gate, /Math\.min\(Math\.max\(rect\.left \+ rect\.width \/ 2, 150\), window\.innerWidth - 150\)/);
  assert.match(gate, /createPortal\(content, document\.body\)/);
});

test("both connection slides show both informational directions only on mobile", () => {
  assert.equal((connections.match(/mobileHeaderIndicator="←  →"/g) ?? []).length, 3);
  assert.match(connections, /pointer-events-none[^\n]+xl:hidden/);
});

test("back-to-top keeps its handler and gains a transparent blue circular treatment", () => {
  assert.match(navigation, /onClick=\{onBackToTop\}/);
  assert.match(navigation, /h-8 w-8[^\n]+rounded-full[^\n]+border border-\[#86ADE0\][^\n]+bg-transparent/);
  assert.match(navigation, /showBackToTop && onBackToTop/);
});
