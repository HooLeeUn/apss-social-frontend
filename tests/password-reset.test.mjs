import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function load(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
const api = load("../lib/api.ts", { "./auth": { getToken: () => "old-session", clearToken: () => assert.fail("Public recovery must not change auth") } });
const reset = load("../lib/password-reset.ts", { "./api": api });

test("registered and missing emails display the exact same backend response without auth", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const sent = [];
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith("/auth/password-reset/request/"));
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, undefined);
    sent.push(JSON.parse(options.body));
    return Response.json({ detail: reset.RESET_REQUEST_MESSAGE });
  };
  assert.equal(await reset.requestPasswordReset(" Owner@Example.com "), reset.RESET_REQUEST_MESSAGE);
  assert.equal(await reset.requestPasswordReset("missing@example.com"), reset.RESET_REQUEST_MESSAGE);
  assert.deepEqual(sent, [{ email: "owner@example.com" }, { email: "missing@example.com" }]);
});

test("request displays the actual successful backend message", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => Response.json({ detail: "Mensaje genérico del backend" });
  assert.equal(await reset.requestPasswordReset("owner@example.com"), "Mensaje genérico del backend");
});

test("valid confirmation sends exact backend fields and preserves password whitespace", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith("/auth/password-reset/confirm/"));
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { uid: "MQ", token: "valid-token", new_password: "  new-password!  ", confirm_password: "  new-password!  " });
    return Response.json({ detail: "Password reset" });
  };
  await assert.doesNotReject(() => reset.confirmPasswordReset("MQ", "valid-token", "  new-password!  ", "  new-password!  "));
});

test("required fields and mismatching passwords stop before any network request", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => assert.fail("Must not send");
  for (const [password, confirmation] of [["", ""], ["password", ""], ["", "password"], ["one", "two"]]) {
    await assert.rejects(() => reset.confirmPasswordReset("MQ", "token", password, confirmation));
  }
  assert.equal(reset.validateResetPasswords("a", "a"), null, "No invented strength rules");
});

for (const state of ["invalid", "expired", "used"]) {
  test(`${state} token maps backend link rejection to generic message`, async (t) => {
    const original = globalThis.fetch;
    t.after(() => { globalThis.fetch = original; });
    globalThis.fetch = async () => Response.json({ detail: "El enlace es inválido o ha expirado." }, { status: 400 });
    try {
      await reset.confirmPasswordReset("MQ", state, "password", "password");
      assert.fail("Must reject");
    } catch (error) {
      assert.deepEqual(reset.passwordResetError(error, true), { message: reset.INVALID_RESET_LINK, invalidLink: true });
    }
  });
}

test("backend password validator messages remain readable and do not mark token invalid", () => {
  const error = new api.ApiError(400, JSON.stringify({ new_password: ["This password is too common.", "This password is too short."] }));
  assert.deepEqual(reset.passwordResetError(error, true), { message: "This password is too common. This password is too short.", invalidLink: false });
});

test("email format errors, rate limits and network failures have distinct retryable messages", () => {
  assert.deepEqual(reset.passwordResetError(new api.ApiError(400, JSON.stringify({ email: ["Enter a valid email address."] })), false), { message: "Enter a valid email address.", invalidLink: false });
  for (const error of [new api.ApiError(429, "Rate limited"), new api.ApiError(500, "Server error"), new TypeError("Failed to fetch")]) {
    const result = reset.passwordResetError(error, true);
    assert.equal(result.invalidLink, false);
    assert.notEqual(result.message, reset.INVALID_RESET_LINK);
  }
});

test("routes use URL credentials, success links to login and invalid links allow requesting again", () => {
  const route = readFileSync(new URL("../app/reset-password/[uid]/[token]/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../components/auth/PasswordResetForm.tsx", import.meta.url), "utf8");
  assert.match(route, /const \{ uid, token \} = await params/);
  assert.match(form, /Tu contraseña fue restablecida correctamente\./);
  assert.match(form, /href="\/login"/);
  assert.match(form, /href="\/forgot-password"/);
  assert.match(form, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(form, /type=\{showConfirmation \? "text" : "password"\}/);
});
