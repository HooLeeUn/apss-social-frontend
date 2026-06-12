import { API_BASE_URL, ApiError, apiFetch } from "./api";

export interface MoviePersonCredit {
  id: number | string | null;
  name: string;
  character?: string | null;
  profileUrl?: string | null;
}

export interface PersonDetail {
  id: number | string | null;
  name: string;
  profileUrl: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  instagramUrl: string | null;
  knownFor: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
}

export interface MovieCredits {
  cast: MoviePersonCredit[];
  directors: MoviePersonCredit[];
}

const CREDITS_ENDPOINT_TEMPLATE = process.env.NEXT_PUBLIC_MOVIE_CREDITS_ENDPOINT_TEMPLATE || "/movies/{id}/credits/";
const CREDITS_FALLBACK_ENDPOINT_TEMPLATES = (process.env.NEXT_PUBLIC_MOVIE_CREDITS_FALLBACK_ENDPOINT_TEMPLATES || "/movies/details/{id}/credits/,/movies/{id}/credits")
  .split(",")
  .map((endpoint) => endpoint.trim())
  .filter(Boolean)
  .filter((endpoint) => endpoint !== CREDITS_ENDPOINT_TEMPLATE);

const PERSON_DETAIL_ENDPOINT_TEMPLATE = process.env.NEXT_PUBLIC_PERSON_DETAIL_ENDPOINT_TEMPLATE || "/people/{id}/";
const PERSON_DETAIL_FALLBACK_ENDPOINT_TEMPLATES = (process.env.NEXT_PUBLIC_PERSON_DETAIL_FALLBACK_ENDPOINT_TEMPLATES || "/persons/{id}/,/person/{id}/,/people/{id}")
  .split(",")
  .map((endpoint) => endpoint.trim())
  .filter(Boolean)
  .filter((endpoint) => endpoint !== PERSON_DETAIL_ENDPOINT_TEMPLATE);

function buildEndpoint(template: string, id: number | string): string {
  return template.replace("{id}", encodeURIComponent(String(id)));
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = toStringOrNull(value);
    if (normalized) return normalized;
  }
  return null;
}

function pickFirstPresent<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function resolveBackendAssetUrl(value: unknown): string | null {
  const candidate = toStringOrNull(value);
  if (!candidate) return null;
  if (candidate.startsWith("http://") || candidate.startsWith("https://") || candidate.startsWith("data:")) return candidate;
  if (candidate.startsWith("//")) return `https:${candidate}`;
  const base = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${base}${candidate.startsWith("/") ? "" : "/"}${candidate}`;
}

function getArraySource(...values: unknown[]): unknown[] {
  for (const value of values) {
    if (Array.isArray(value)) return value;
    const record = toRecord(value);
    if (Array.isArray(record?.results)) return record.results;
  }
  return [];
}

function normalizeSocialUrl(platform: "facebook" | "x" | "instagram", value: unknown): string | null {
  const normalized = toStringOrNull(value);
  if (!normalized) return null;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;
  const clean = normalized.replace(/^@+/, "").replace(/^\/+/, "");
  if (!clean) return null;
  if (platform === "facebook") return `https://www.facebook.com/${clean}`;
  if (platform === "instagram") return `https://www.instagram.com/${clean}`;
  return `https://x.com/${clean}`;
}

export function normalizePersonCredit(value: unknown): MoviePersonCredit | null {
  if (typeof value === "string") {
    const name = value.trim();
    return name ? { id: null, name } : null;
  }

  const record = toRecord(value);
  if (!record) return null;

  const person = toRecord(record.person) ?? toRecord(record.people) ?? toRecord(record.profile);
  const name = pickFirstString(record.name, person?.name, record.full_name, person?.full_name, record.original_name, person?.original_name);
  if (!name) return null;

  return {
    id: pickFirstPresent(record.person_id as number | string | null | undefined, record.tmdb_id as number | string | null | undefined, person?.id as number | string | null | undefined, record.id as number | string | null | undefined),
    name,
    character: pickFirstString(record.character, record.role, record.job),
    profileUrl: resolveBackendAssetUrl(pickFirstPresent(record.profile_path, person?.profile_path, record.profile_url, person?.profile_url, record.photo, person?.photo, record.image, person?.image)),
  };
}

function uniqueCredits(credits: MoviePersonCredit[]): MoviePersonCredit[] {
  const seen = new Set<string>();
  return credits.filter((credit) => {
    const key = credit.id !== null && credit.id !== undefined ? `id:${credit.id}` : `name:${credit.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeMovieCredits(payload: unknown): MovieCredits {
  const root = toRecord(payload);
  const nestedCredits = toRecord(root?.credits);
  const crew = getArraySource(root?.crew, nestedCredits?.crew);
  const cast = uniqueCredits(getArraySource(root?.cast, root?.cast_members, nestedCredits?.cast, nestedCredits?.cast_members).map(normalizePersonCredit).filter((credit): credit is MoviePersonCredit => Boolean(credit)));
  const directors = uniqueCredits([
    ...getArraySource(root?.directors, root?.director, nestedCredits?.directors, nestedCredits?.director).map(normalizePersonCredit),
    ...crew
      .filter((entry) => {
        const record = toRecord(entry);
        return pickFirstString(record?.job, record?.role)?.toLowerCase() === "director";
      })
      .map(normalizePersonCredit),
  ].filter((credit): credit is MoviePersonCredit => Boolean(credit)));

  return { cast, directors };
}

export function normalizePersonDetail(payload: unknown, fallback?: MoviePersonCredit): PersonDetail | null {
  const root = toRecord(payload);
  const record = toRecord(root?.person) ?? root;
  if (!record) return fallback ? { id: fallback.id, name: fallback.name, profileUrl: fallback.profileUrl ?? null, facebookUrl: null, xUrl: null, instagramUrl: null, knownFor: null, birthday: null, deathday: null, placeOfBirth: null } : null;
  const externalIds = toRecord(record.external_ids) ?? toRecord(record.externalIds) ?? toRecord(record.socials) ?? toRecord(record.social);
  const name = pickFirstString(record.name, record.full_name, fallback?.name);
  if (!name) return null;

  return {
    id: pickFirstPresent(record.id as number | string | null | undefined, record.person_id as number | string | null | undefined, record.tmdb_id as number | string | null | undefined, fallback?.id),
    name,
    profileUrl: resolveBackendAssetUrl(pickFirstPresent(record.profile_path, record.profile_url, record.photo, record.image, fallback?.profileUrl)),
    facebookUrl: normalizeSocialUrl("facebook", pickFirstPresent(record.facebook, record.facebook_url, externalIds?.facebook_id, externalIds?.facebook)),
    xUrl: normalizeSocialUrl("x", pickFirstPresent(record.x, record.twitter, record.twitter_url, record.x_url, externalIds?.twitter_id, externalIds?.x, externalIds?.twitter)),
    instagramUrl: normalizeSocialUrl("instagram", pickFirstPresent(record.instagram, record.instagram_url, externalIds?.instagram_id, externalIds?.instagram)),
    knownFor: pickFirstString(record.known_for_department, record.known_for, record.department),
    birthday: pickFirstString(record.birthday, record.birth_date, record.date_of_birth),
    deathday: pickFirstString(record.deathday, record.day_of_death, record.death_date, record.date_of_death),
    placeOfBirth: pickFirstString(record.place_of_birth, record.birthplace, record.birth_place),
  };
}

export async function fetchMovieCredits(movieId: number | string): Promise<MovieCredits> {
  const endpoints = [CREDITS_ENDPOINT_TEMPLATE, ...CREDITS_FALLBACK_ENDPOINT_TEMPLATES].map((template) => buildEndpoint(template, movieId));
  for (let index = 0; index < endpoints.length; index += 1) {
    try {
      return normalizeMovieCredits(await apiFetch(endpoints[index]));
    } catch (error) {
      if (!(error instanceof ApiError) || ![404, 405].includes(error.status) || index >= endpoints.length - 1) throw error;
    }
  }
  return { cast: [], directors: [] };
}

export async function fetchPersonDetail(person: MoviePersonCredit): Promise<PersonDetail | null> {
  if (person.id === null || person.id === undefined) return normalizePersonDetail(null, person);
  const endpoints = [PERSON_DETAIL_ENDPOINT_TEMPLATE, ...PERSON_DETAIL_FALLBACK_ENDPOINT_TEMPLATES].map((template) => buildEndpoint(template, person.id as number | string));
  for (let index = 0; index < endpoints.length; index += 1) {
    try {
      return normalizePersonDetail(await apiFetch(endpoints[index]), person);
    } catch (error) {
      if (!(error instanceof ApiError) || ![404, 405].includes(error.status) || index >= endpoints.length - 1) throw error;
    }
  }
  return normalizePersonDetail(null, person);
}
