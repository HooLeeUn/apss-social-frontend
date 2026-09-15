import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const policiesPage = readFileSync(new URL("../app/policies/page.tsx", import.meta.url), "utf8");
const guestRouteGuard = readFileSync(new URL("../components/GuestRouteGuard.tsx", import.meta.url), "utf8");

test("valid policy language parameters override the existing RecCool locale", () => {
  assert.match(policiesPage, /const requestedLocale = searchParams\.get\("lang"\)/);
  assert.match(
    policiesPage,
    /requestedLocale === "es" \|\| requestedLocale === "en" \? requestedLocale : locale/,
  );
  assert.match(policiesPage, /const isEnglishLocale = policyLocale === "en"/);
});

test("the policy selector navigates locally without changing global locale storage", () => {
  assert.match(policiesPage, /router\.push\(`\/policies\?lang=\$\{nextLocale\}`\)/);
  assert.doesNotMatch(policiesPage, /setCountry|setStoredCountry|localStorage|document\.cookie/);
  assert.match(policiesPage, /\["es", "en"\] as const/);
  assert.match(policiesPage, /aria-pressed=\{active\}/);
});

test("the policies page keeps both existing legal content sources unchanged", () => {
  assert.match(policiesPage, /englishLegalPolicies\.sections/);
  assert.match(policiesPage, /prepareSpanishLegalPolicies\(payload\)/);
  assert.match(policiesPage, /<Suspense fallback=/);
});

test("policies remain accessible to public guest sessions", () => {
  assert.match(guestRouteGuard, /\\\/policies/);
});
