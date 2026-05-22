import { apiFetch } from "./api";

const POLICIES_ENDPOINT = "/legal/policies/";

type JsonRecord = Record<string, unknown>;

export interface PoliciesBlock {
  type: "paragraph" | "bullet";
  text: string;
}

export interface PoliciesSection {
  title: string;
  blocks: PoliciesBlock[];
}

export interface PoliciesContent {
  lastUpdated: string;
  sections: PoliciesSection[];
}

function toRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : null;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toText(item)).filter(Boolean);
}

function extractRoot(payload: unknown): JsonRecord {
  const root = toRecord(payload) ?? {};
  return toRecord(root.data) ?? root;
}

function readText(record: JsonRecord | null, keys: string[]): string {
  if (!record) return "";

  for (const key of keys) {
    const found = toText(record[key]);
    if (found) return found;
  }

  return "";
}

function extractBlocks(source: JsonRecord): PoliciesBlock[] {
  const blocks: PoliciesBlock[] = [];

  const singleContent = toText(source.content);
  if (singleContent) blocks.push({ type: "paragraph", text: singleContent });

  const paragraphValues = [
    toText(source.text),
    ...toStringList(source.paragraphs),
    ...toStringList(source.content),
    ...toStringList(source.items),
  ];

  for (const paragraph of paragraphValues.filter(Boolean)) {
    blocks.push({ type: "paragraph", text: paragraph });
  }

  const bulletValues = [
    ...toStringList(source.bullets),
    ...toStringList(source.list),
  ];

  for (const bullet of bulletValues) {
    blocks.push({ type: "bullet", text: bullet });
  }

  return blocks;
}

function parseSection(value: unknown): PoliciesSection | null {
  const section = toRecord(value);
  if (!section) return null;

  const title = readText(section, ["title", "heading", "name", "label"]);
  const blocks = extractBlocks(section);

  const nested = Array.isArray(section.sections)
    ? section.sections
        .map((child) => parseSection(child))
        .filter((child): child is PoliciesSection => Boolean(child))
    : [];

  if (nested.length > 0) {
    for (const child of nested) {
      blocks.push({ type: "paragraph", text: child.title });
      blocks.push(...child.blocks);
    }
  }

  if (!title || blocks.length === 0) return null;
  return { title, blocks };
}

const SECTION_KEY_ALIASES: Array<{ key: string; title: string }> = [
  { key: "general_information", title: "Información general" },
  { key: "sobre_qnext", title: "Sobre QNext" },
  { key: "credits_and_sources", title: "Créditos y fuentes" },
  { key: "imdb_credits", title: "Créditos IMDb" },
  { key: "tmdb_credits", title: "Créditos TMDB" },
  { key: "rating_system", title: "Sistema de calificaciones" },
  { key: "initial_public_profile", title: "Perfil público inicial" },
  { key: "conducta_y_contenido", title: "Conducta y contenido" },
  { key: "exactitud_datos_externos", title: "Exactitud de datos externos" },
  { key: "eliminacion_contenido", title: "Eliminación de contenido" },
  { key: "restriccion_edad", title: "Restricción de edad" },
  { key: "ley_1581_articulos", title: "Artículos relevantes de Ley 1581 de 2012" },
  { key: "personal_data_treatment", title: "Tratamiento de Datos Personales" },
  { key: "intellectual_property", title: "Propiedad intelectual" },
];

export function parsePoliciesContent(payload: unknown): PoliciesContent {
  const root = extractRoot(payload);
  const lastUpdated = readText(root, ["last_updated", "updated_at", "updatedAt", "fecha_actualizacion", "date"]);

  const dynamicSections = Array.isArray(root.sections)
    ? root.sections
        .map((section) => parseSection(section))
        .filter((section): section is PoliciesSection => Boolean(section))
    : [];

  const mappedSections: PoliciesSection[] = [];
  for (const { key, title } of SECTION_KEY_ALIASES) {
    const value = root[key];
    const fromRecord = parseSection({ title, ...(toRecord(value) ?? {}), content: value });
    if (fromRecord) mappedSections.push(fromRecord);
  }

  const merged = [...dynamicSections, ...mappedSections].filter((section, index, arr) => arr.findIndex((item) => item.title === section.title) === index);

  return { lastUpdated, sections: merged };
}

export async function getPoliciesContent(): Promise<PoliciesContent> {
  const payload = await apiFetch(POLICIES_ENDPOINT);
  return parsePoliciesContent(payload);
}
