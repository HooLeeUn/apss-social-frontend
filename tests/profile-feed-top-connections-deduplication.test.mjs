import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const adapterSource = fs.readFileSync("lib/profile-feed/adapters.ts", "utf8");

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function loadAdapters(apiFetch) {
  const compiled = ts.transpileModule(adapterSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const adapterModule = { exports: {} };
  const importedModules = {
    "../api": { ApiError, apiFetch },
    "../notification-routing-fields": { normalizeNotificationRoutingFields: (value) => value },
    "../movies": {
      normalizeMovie: (value) => value,
      parseMovieList: (value) => value,
      resolveMovieDisplayTitle: () => "",
      resolveMovieSecondaryTitle: () => "",
    },
    "./mocks": { favoriteMoviesMock: [] },
  };

  new Function("require", "module", "exports", compiled)(
    (specifier) => importedModules[specifier] ?? require(specifier),
    adapterModule,
    adapterModule.exports,
  );
  return adapterModule.exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

for (const scenario of [
  {
    name: "getTopFollowing",
    endpoint: "/me/following/",
    payload: [
      { id: 1, username: "lower", followers_count: 2 },
      { id: 2, username: "higher", followers_count: 8 },
    ],
  },
  {
    name: "getTopFriends",
    endpoint: "/social/friends/",
    payload: [
      { id: 1, username: "lower", followers_count: 2 },
      { id: 2, username: "higher", followers_count: 8 },
    ],
  },
]) {
  test(`${scenario.name} shares only its in-flight request and preserves its contract`, async () => {
    const requests = [];
    const firstResponse = deferred();
    const adapters = loadAdapters((endpoint) => {
      requests.push(endpoint);
      return requests.length === 1 ? firstResponse.promise : Promise.resolve(scenario.payload);
    });

    const firstCall = adapters[scenario.name]();
    const simultaneousCall = adapters[scenario.name]();

    assert.strictEqual(simultaneousCall, firstCall);
    assert.deepEqual(requests, [scenario.endpoint]);

    firstResponse.resolve(scenario.payload);
    const [firstResult, simultaneousResult] = await Promise.all([firstCall, simultaneousCall]);
    assert.strictEqual(simultaneousResult, firstResult);
    assert.deepEqual(firstResult.map((user) => user.username), ["higher", "lower"]);

    const laterResult = await adapters[scenario.name]();
    assert.deepEqual(requests, [scenario.endpoint, scenario.endpoint]);
    assert.deepEqual(laterResult, firstResult);
  });

  test(`${scenario.name} clears a failed in-flight request so a later call can retry`, async () => {
    const failure = new Error(`${scenario.name} failed`);
    let requestCount = 0;
    const adapters = loadAdapters((endpoint) => {
      assert.equal(endpoint, scenario.endpoint);
      requestCount += 1;
      return requestCount === 1 ? Promise.reject(failure) : Promise.resolve(scenario.payload);
    });

    const failedCall = adapters[scenario.name]();
    assert.strictEqual(adapters[scenario.name](), failedCall);
    await assert.rejects(failedCall, (error) => error === failure);
    assert.equal(requestCount, 1);

    const retryResult = await adapters[scenario.name]();
    assert.equal(requestCount, 2);
    assert.deepEqual(retryResult.map((user) => user.username), ["higher", "lower"]);
  });
}
