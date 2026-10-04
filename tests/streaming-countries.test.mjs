import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTypeScriptModule(path) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const i18n = loadTypeScriptModule("lib/i18n.ts");
const countries = loadTypeScriptModule("lib/streaming-countries.ts");
const newCountries = ["DE", "AE", "AU"];

test("Germany, United Arab Emirates, and Australia are supported in English", () => {
  for (const country of newCountries) {
    assert.equal(i18n.isSupportedCountry(country), true);
    assert.equal(i18n.normalizeCountry(country.toLowerCase()), country);
    assert.equal(i18n.countryToLocale(country), "en");
  }
});

test("new countries are visible streaming-country options with their flags", () => {
  const expected = {
    DE: { name: "Germany", flagSrc: "/flags/de.svg" },
    AE: { name: "United Arab Emirates", flagSrc: "/flags/ae.svg" },
    AU: { name: "Australia", flagSrc: "/flags/au.svg" },
  };

  for (const country of newCountries) {
    const option = countries.STREAMING_COUNTRY_OPTIONS.find(({ value }) => value === country);
    assert.deepEqual(option, { value: country, ...expected[country] });
    assert.equal(fs.existsSync(`public${expected[country].flagSrc}`), true);
  }
});

test("new country selections persist to and restore from app_locale_country", () => {
  const values = new Map();
  global.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    dispatchEvent: () => true,
  };
  global.CustomEvent = class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init?.detail; }
  };

  try {
    for (const country of newCountries) {
      i18n.setStoredCountry(country);
      assert.deepEqual(JSON.parse(values.get("app_locale_country")), { country, language: "en" });
      assert.deepEqual(i18n.getStoredLocaleSelection(), { country, language: "en" });
    }
  } finally {
    delete global.window;
    delete global.CustomEvent;
  }
});

test("watch-provider URLs preserve each new TMDB region code", () => {
  const source = fs.readFileSync("components/StreamingProviders.tsx", "utf8");
  const returnExpression = source.match(/function buildWatchProvidersEndpoint[\s\S]*?return (`[^;]+`);/)?.[1];
  assert.ok(returnExpression, "watch-provider endpoint builder must remain available");
  const buildEndpoint = new Function("movieId", "country", `return ${returnExpression}`);

  for (const country of newCountries) {
    assert.equal(buildEndpoint("movie/42", country), `/movies/movie%2F42/watch-providers/?country=${country}`);
  }
});

test("all existing selector surfaces continue to reuse the shared country options", () => {
  assert.match(fs.readFileSync("components/auth/AuthCountrySelector.tsx", "utf8"), /<StreamingCountrySelector/);
  assert.match(fs.readFileSync("app/page.tsx", "utf8"), /<AuthCountrySelector/);
  assert.match(fs.readFileSync("app/signup/page.tsx", "utf8"), /<AuthCountrySelector/);
  assert.equal((fs.readFileSync("app/feed/page.tsx", "utf8").match(/<StreamingCountrySelector/g) ?? []).length >= 3, true);
  assert.match(fs.readFileSync("app/movies/[id]/page.tsx", "utf8"), /<MovieDetailStreamingCountrySelector/);
});
