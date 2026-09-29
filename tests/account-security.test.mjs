import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const helper = read("../lib/account-security.ts");
const settings = read("../components/settings/AccountSecuritySettings.tsx");
const personalDataPage = read("../app/settings/personal-data/page.tsx");
const requestPage = read("../app/delete-account/page.tsx");
const confirmPage = read("../app/delete-account/confirm/[token]/page.tsx");
const emailPage = read("../app/confirm-email-change/[token]/page.tsx");
const guard = read("../components/GuestRouteGuard.tsx");

test("change password submits the exact backend payload and mismatch stops before the request", () => {
  assert.match(settings, /current_password: passwords\.current, new_password: passwords\.next, new_password_confirmation: passwords\.confirm/);
  assert.match(settings, /passwords\.next !== passwords\.confirm[^}]+return/);
  assert.match(helper, /apiFetch\("\/me\/change-password\/", \{ method: "POST", body: JSON\.stringify\(payload\) \}\)/);
});

test("password success clears the session while a 400 only renders a friendly error", () => {
  assert.match(settings, /await changePassword[\s\S]+logout\(text\.changed\)/);
  assert.match(settings, /const logout[\s\S]+clearToken\(\)[\s\S]+clearGuestMode\(\)[\s\S]+router\.replace\("\/login"\)/);
  assert.match(settings, /catch \(error\) \{ setChangeError/);
  assert.doesNotMatch(settings, /catch \(error\) \{[^}]+logout/);
});

test("authenticated deletion requires a password confirmation modal and preserves auth on errors", () => {
  assert.match(settings, /setDeleteOpen\(true\)/);
  assert.match(settings, /role="dialog" aria-modal="true"/);
  assert.match(settings, /if \(!deletePassword\)/);
  assert.match(settings, /await deleteAuthenticatedAccount\(deletePassword\)[\s\S]+logout\(text\.deleted\)/);
  assert.match(settings, /catch \(error\) \{ setDeleteError/);
});

test("personal-data actions keep the profile save before the independent security blocks", () => {
  const saveButton = personalDataPage.indexOf("void handleSave()");
  const securityBlocks = personalDataPage.indexOf("<AccountSecuritySettings />");

  assert.ok(saveButton > -1 && securityBlocks > saveButton);
  assert.doesNotMatch(settings, /Zona de riesgo|Danger zone|text\.danger/);
  assert.match(settings, /border border-red-500\/35 bg-red-950\/15/);
});

test("public deletion request is guest-accessible and always uses generic success copy", () => {
  assert.match(guard, /\\\/delete-account/);
  assert.match(helper, /\/account-deletion\/request\//);
  assert.match(helper, /omitAuth: true/);
  assert.match(requestPage, /If an account exists for this email, you will receive instructions to delete it\./);
  assert.match(requestPage, /Si existe una cuenta asociada a este correo, recibirás instrucciones para eliminarla\./);
});

test("confirmation never posts on mount and only posts after the destructive action", () => {
  assert.doesNotMatch(confirmPage, /useEffect/);
  assert.match(confirmPage, /onClick=\{\(\) => void confirm\(\)\}/);
  assert.match(confirmPage, /await confirmAccountDeletion\(token\)/);
  assert.match(helper, /\/account-deletion\/confirm\/\$\{encodeURIComponent\(token\)\}\//);
});

test("invalid deletion tokens and email-change failures stay inside friendly RecCool UI", () => {
  assert.match(confirmPage, /This deletion link is no longer valid/);
  assert.match(confirmPage, /Este enlace de eliminación ya no es válido/);
  assert.match(emailPage, /confirmEmailChange\(token\)/);
  assert.match(emailPage, /AuthShell/);
  assert.doesNotMatch(emailPage, /window\.location|API_BASE_URL/);
});

test("all public account flows expose deterministic ES and EN navigation", () => {
  for (const page of [requestPage, confirmPage, emailPage]) {
    assert.match(page, /requested === "es" \|\| requested === "en"/);
    assert.match(page, /PublicLanguageSelector/);
    assert.match(page, /\?lang=\$\{next\}/);
  }
});
