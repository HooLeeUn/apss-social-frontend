import { apiFetch } from "./api";

export interface LegalSection {
  subtitle: string;
  paragraphs: string[];
  showTmdbAttribution?: boolean;
}

export interface LegalPoliciesContent {
  title: string;
  lastUpdated: string | null;
  sections: LegalSection[];
}

type UnknownRecord = Record<string, unknown>;

const SECTION_KEYS = ["sections", "data_protection_sections", "intellectual_property_sections"] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function firstText(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeParagraphArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function normalizeSection(entry: unknown): LegalSection | null {
  if (!isRecord(entry)) return null;

  const subtitle = firstText([entry.subtitle, entry.heading, entry.name, entry.label]);
  const paragraphs = [
    ...normalizeParagraphArray(entry.content),
    ...normalizeParagraphArray(entry.paragraphs),
    ...normalizeParagraphArray(entry.items),
    ...normalizeParagraphArray(entry.bullets),
    ...normalizeParagraphArray(entry.list),
  ];

  if (!subtitle || paragraphs.length === 0) return null;

  return {
    subtitle,
    paragraphs,
    showTmdbAttribution: subtitle.toLowerCase().includes("créditos") || subtitle.toLowerCase().includes("creditos"),
  };
}

function normalizeCreditsSection(credits: unknown): LegalSection | null {
  if (!isRecord(credits)) return null;
  const subtitle = firstText([credits.subtitle, credits.heading, credits.name, credits.label]) || "Créditos y fuentes externas";

  const paragraphs = [
    ...normalizeParagraphArray(credits.content),
    ...normalizeParagraphArray(credits.paragraphs),
    ...normalizeParagraphArray(credits.items),
  ];

  return {
    subtitle,
    paragraphs,
    showTmdbAttribution: true,
  };
}

export async function getLegalPolicies(): Promise<LegalPoliciesContent> {
  const payload = (await apiFetch("/legal/policies/")) as UnknownRecord;
  const title = firstText([payload?.title, payload?.heading, payload?.name, payload?.label]) || "Políticas y Términos";
  const lastUpdated = firstText([payload?.last_updated, payload?.updated_at]) || null;

  const sections: LegalSection[] = [];

  for (const key of SECTION_KEYS) {
    const rawSections = isRecord(payload) ? payload[key] : null;
    if (Array.isArray(rawSections)) {
      for (const entry of rawSections) {
        const normalized = normalizeSection(entry);
        if (normalized) sections.push(normalized);
      }
    }
  }

  const credits = normalizeCreditsSection(isRecord(payload) ? payload.credits : null);
  if (credits) sections.push(credits);

  return { title, lastUpdated, sections };
}
