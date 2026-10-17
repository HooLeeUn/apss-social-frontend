import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
let payload;
const cache = new Map();
function load(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path);
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (id) => id === "./api" ? { apiFetch: async () => payload }
    : id.startsWith(".") ? load(resolve(dirname(path), `${id}.ts`)) : require(id);
  new Function("require", "module", "exports", compiled)(localRequire, loaded, loaded.exports);
  cache.set(path, loaded.exports);
  return loaded.exports;
}
const { englishLegalPolicies: english } = load("lib/legalPoliciesEnglish.ts");
const { LEGAL_LAST_UPDATED, TERMS_VERSION } = load("lib/legal-constants.ts");
const { getLegalPolicies } = load("lib/legal.ts");
const { prepareSpanishLegalPolicies } = load("lib/legalPoliciesSpanish.ts");
const page = readFileSync("app/policies/page.tsx", "utf8");
const attribution = "This product uses the TMDB API but is not endorsed or certified by TMDB.";

test("English policies use current date and describe the exact rating threshold", () => {
  assert.equal(LEGAL_LAST_UPDATED, "2026-10-16");
  assert.equal(english.lastUpdated, LEGAL_LAST_UPDATED);
  assert.equal(TERMS_VERSION, "2026-09"); // acceptance/authentication flow stays unchanged
  const rating = english.sections[1].paragraphs.join(" ");
  assert.match(rating, /fewer than 100.*TMDB.*progressively/);
  assert.match(rating, /reaches 100.*exclusively/);
  assert.match(rating, /not necessarily synchronized in real time/);
  assert.doesNotMatch(JSON.stringify(english), /imdb|5,000|volatile|manipulate/i);
});

test("English credits preserve attribution, acknowledge JustWatch and explain external data timing", () => {
  const credits = english.sections[9];
  assert.equal(credits.paragraphs[0], attribution);
  assert.equal(credits.paragraphs.length, 5);
  assert.match(credits.paragraphs[4], /JustWatch/);
  assert.match(credits.paragraphs[2], /not necessarily synchronized/);
  assert.equal(credits.showTmdbAttribution, true);
  assert.doesNotMatch(english.sections[5].paragraphs.join(" "), /adjust/i);
});

test("Spanish API credits render as section 10 without duplicated attribution or legacy hardcoded copy", async () => {
  payload = {
    title: "Políticas y Términos", last_updated: "2026-10-16",
    sections: ["Información general", "Sistema de calificaciones de RecCool", "Privacidad básica", "Conducta y contenido", "Exactitud de datos externos", "Eliminación de contenido y cuentas"].map(subtitle => ({ subtitle, content: ["Texto conservado"] })),
    data_protection_sections: [{ subtitle: "Tratamiento de Datos Personales", content: ["Texto conservado"] }],
    intellectual_property_sections: [{ subtitle: "Propiedad Intelectual", content: ["Texto conservado"] }],
    credits: { content: [attribution, "Disponibilidad TMDB y JustWatch"] },
  };
  const spanish = prepareSpanishLegalPolicies(await getLegalPolicies());
  assert.equal(spanish.lastUpdated, LEGAL_LAST_UPDATED);
  assert.equal(spanish.sections.length, 10);
  assert.equal(spanish.sections[5].subtitle, "6. Exactitud de datos externos");
  assert.equal(spanish.sections[9].subtitle, "10. Créditos y fuentes externas");
  assert.deepEqual(spanish.sections[9].paragraphs, payload.credits.content);
  assert.match(spanish.sections[4].subtitle, /Contenido generado por usuarios/);
  assert.doesNotMatch(page, /imdb/i);
  assert.doesNotMatch(page, /This product uses the TMDB API/);
  assert.match(page, /section\.paragraphs\.map/);
  assert.match(page, /\/brand\/tmdb.svg/);
});
