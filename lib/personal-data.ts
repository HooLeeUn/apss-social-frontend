import { apiFetch } from "./api";

const PERSONAL_DATA_ENDPOINT = "/me/personal-data/";
export const MINIMUM_AGE = 13;

export type GenderIdentity = "male" | "female" | "non_binary" | "prefer_not_to_say";

export interface PersonalData {
  first_name: string;
  last_name: string;
  email: string;
  birth_date: string | null;
  age: number | null;
  birth_date_locked: boolean;
  birth_date_visible: boolean;
  gender_identity: GenderIdentity | null;
  gender_identity_visible: boolean;
  avatar: string | null;
}

export interface PersonalDataPayload {
  first_name: string;
  last_name: string;
  email: string;
  birth_date: string | null;
  birth_date_visible: boolean;
  gender_identity: GenderIdentity | null;
  gender_identity_visible: boolean;
}

export function getAgeFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;

  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  const today = new Date();
  const birth = new Date(year, month - 1, day);

  if (Number.isNaN(birth.getTime())) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function formatBirthDate(date: string): string {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function toGenderIdentity(value: unknown): GenderIdentity | null {
  if (value === "male" || value === "female" || value === "non_binary" || value === "prefer_not_to_say") {
    return value;
  }

  return null;
}

function normalizePersonalData(payload: unknown): PersonalData {
  const source = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

  return {
    first_name: toString(source.first_name),
    last_name: toString(source.last_name),
    email: toString(source.email),
    birth_date: toNullableString(source.birth_date),
    age: toNullableNumber(source.age),
    birth_date_locked: toBoolean(source.birth_date_locked),
    birth_date_visible: toBoolean(source.birth_date_visible, true),
    gender_identity: toGenderIdentity(source.gender_identity),
    gender_identity_visible: toBoolean(source.gender_identity_visible, true),
    avatar: toNullableString(source.avatar),
  };
}

export async function getPersonalData(): Promise<PersonalData> {
  const response = await apiFetch(PERSONAL_DATA_ENDPOINT, { cache: "no-store" });
  return normalizePersonalData(response);
}

export async function updatePersonalData(payload: PersonalDataPayload): Promise<PersonalData> {
  const response = await apiFetch(PERSONAL_DATA_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return normalizePersonalData(response);
}

export async function updatePersonalAvatar(file: File): Promise<PersonalData> {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await apiFetch(PERSONAL_DATA_ENDPOINT, {
    method: "PATCH",
    body: formData,
  });

  return normalizePersonalData(response);
}
