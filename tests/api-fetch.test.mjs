import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(new URL("../lib/api.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const apiModule = { exports: {} };
const loadDependency = (specifier) => {
  if (specifier === "./auth") return { clearToken() {}, getToken() { return null; } };
  return require(specifier);
};
new Function("require", "module", "exports", compiled)(loadDependency, apiModule, apiModule.exports);
const { ApiError, apiFetch } = apiModule.exports;

test("apiFetch accepts successful no-content writes without parsing JSON", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => new Response("", {
    status: 201,
    headers: { "content-type": "application/json" },
  });

  await assert.doesNotReject(() => apiFetch("/comments/directed/", { method: "POST", expectJson: false }));
  assert.equal(await apiFetch("/comments/directed/", { method: "POST" }), null);
});

test("apiFetch still rejects HTTP errors", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: "Invalid payload" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(() => apiFetch("/comments/directed/", { method: "POST", expectJson: false }), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    return true;
  });
});

test("apiFetch still rejects network failures", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const networkError = new TypeError("Failed to fetch");
  globalThis.fetch = async () => { throw networkError; };

  await assert.rejects(() => apiFetch("/comments/directed/", { method: "POST", expectJson: false }), networkError);
});
