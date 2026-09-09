import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const authSource = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(authSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function loadAuth(localStorage, sessionStorage) {
  const authModule = { exports: {} };
  const previousWindow = globalThis.window;
  const previousLocalStorage = globalThis.localStorage;
  const previousSessionStorage = globalThis.sessionStorage;
  globalThis.window = { dispatchEvent() {} };
  globalThis.localStorage = localStorage;
  globalThis.sessionStorage = sessionStorage;
  new Function("require", "module", "exports", compiled)(require, authModule, authModule.exports);
  return {
    auth: authModule.exports,
    restore() {
      globalThis.window = previousWindow;
      globalThis.localStorage = previousLocalStorage;
      globalThis.sessionStorage = previousSessionStorage;
    },
  };
}

test("login token survives a fresh auth initialization and the launcher route restores the session", () => {
  const persistentStorage = storage();
  const first = loadAuth(persistentStorage, storage());
  first.auth.setToken("drf-token");
  first.restore();

  const reopened = loadAuth(persistentStorage, storage());
  assert.equal(reopened.auth.getToken(), "drf-token");
  assert.deepEqual(reopened.auth.getAuthState(), { isAuthenticated: true, isGuest: false });
  reopened.restore();

  assert.match(loginSource, /useEffect\(\(\) => \{\s*if \(getToken\(\)\) router\.replace\("\/feed"\);/);
});

test("explicit logout removes the persisted token and guest mode remains credential-free", () => {
  const persistentStorage = storage();
  const session = storage();
  const loaded = loadAuth(persistentStorage, session);
  loaded.auth.setToken("drf-token");
  loaded.auth.clearToken();
  assert.equal(persistentStorage.getItem("token"), null);

  loaded.auth.enterGuestMode();
  assert.equal(persistentStorage.getItem("token"), null);
  assert.deepEqual(loaded.auth.getAuthState(), { isAuthenticated: false, isGuest: true });
  loaded.restore();
});
