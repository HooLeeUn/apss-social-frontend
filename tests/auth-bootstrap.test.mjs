import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const authSource = readFileSync(new URL("../lib/auth.ts", import.meta.url), "utf8");
const authHookSource = readFileSync(new URL("../hooks/useAuthState.ts", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const compiledAuth = ts.transpileModule(authSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function withAuth(localStorage, sessionStorage, run) {
  const previous = {
    window: globalThis.window,
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.localStorage = localStorage;
  globalThis.sessionStorage = sessionStorage;
  const authModule = { exports: {} };
  new Function("require", "module", "exports", compiledAuth)(require, authModule, authModule.exports);
  try {
    run(authModule.exports);
  } finally {
    globalThis.window = previous.window;
    globalThis.localStorage = previous.localStorage;
    globalThis.sessionStorage = previous.sessionStorage;
  }
}

test("checking renders only the neutral bootstrap and never mounts LoginForm", () => {
  assert.match(authHookSource, /authStatus: "checking"/);
  assert.match(loginSource, /if \(authStatus !== "unauthenticated"\) \{\s*return <main data-auth-bootstrap className="min-h-screen bg-black"/);
  assert.match(loginSource, /return <LoginForm \/>;/);
});

test("a persisted token resolves authenticated and redirects directly to Feed", () => {
  withAuth(storage({ token: "valid-token" }), storage(), (auth) => {
    assert.deepEqual(auth.getAuthState(), { isAuthenticated: true, isGuest: false });
  });
  assert.match(loginSource, /authStatus === "authenticated"/);
  assert.match(loginSource, /router\.replace\("\/feed"\)/);
});

test("without a token bootstrap resolves unauthenticated so Login mounts", () => {
  withAuth(storage(), storage(), (auth) => {
    assert.deepEqual(auth.getAuthState(), { isAuthenticated: false, isGuest: false });
  });
  assert.match(loginSource, /authStatus !== "unauthenticated"/);
  assert.match(loginSource, /return <LoginForm \/>;/);
});

test("logout removes the token and resolves unauthenticated", () => {
  withAuth(storage({ token: "valid-token" }), storage(), (auth) => {
    auth.clearToken();
    assert.deepEqual(auth.getAuthState(), { isAuthenticated: false, isGuest: false });
  });
});

test("an invalid token response clears persistence before Login is shown", () => {
  assert.match(apiSource, /if \(res\.status === 401\) \{\s*clearToken\(\);\s*\}/);
});

test("explicit guest mode remains credential-free and usable", () => {
  withAuth(storage({ token: "old-token" }), storage(), (auth) => {
    auth.enterGuestMode();
    assert.deepEqual(auth.getAuthState(), { isAuthenticated: false, isGuest: true });
  });
  assert.match(loginSource, /enterGuestMode\(\); router\.push\("\/feed"\)/);
});
