import { apiFetch } from "./api";

const POLICIES_ENDPOINT = "/legal/policies/";

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readText(record: Record<string, unknown> | null, keys: string[]): string {
  if (!record) return "";

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function extractRoot(payload: unknown): Record<string, unknown> {
  const root = toRecord(payload) ?? {};
  return toRecord(root.data) ?? root;
}

export interface PoliciesContent {
  lastUpdated: string;
  generalInformation: string;
  creditsAndSources: string;
  ratingSystem: string;
  initialPublicProfile: string;
  personalDataTreatment: string;
  intellectualProperty: string;
}

export function parsePoliciesContent(payload: unknown): PoliciesContent {
  const root = extractRoot(payload);

  return {
    lastUpdated: readText(root, ["last_updated", "updated_at", "updatedAt", "fecha_actualizacion", "date"]),
    generalInformation: readText(root, ["general_information", "informacion_general", "overview", "general_info"]),
    creditsAndSources: readText(root, ["credits_and_sources", "creditos_y_fuentes", "credits", "sources"]),
    ratingSystem: readText(root, ["rating_system", "sistema_calificaciones", "ratings", "calificaciones"]),
    initialPublicProfile: readText(root, ["initial_public_profile", "perfil_publico_inicial", "public_profile"]),
    personalDataTreatment: readText(root, ["personal_data_treatment", "tratamiento_datos_personales", "data_treatment"]),
    intellectualProperty: readText(root, ["intellectual_property", "propiedad_intelectual", "ip"]),
  };
}

export async function getPoliciesContent(): Promise<PoliciesContent> {
  const payload = await apiFetch(POLICIES_ENDPOINT);
  return parsePoliciesContent(payload);
}
