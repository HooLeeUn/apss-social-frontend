export type Locale = "es" | "en";
export type Country = "CO" | "US";

const STORAGE_KEY = "app_locale_country";
const USER_STORAGE_KEY_PREFIX = "app_locale_country:";
const ACTIVE_SCOPE_STORAGE_KEY = "app_locale_active_scope";
export const localeEventName = "app-locale-change";

export interface LocaleUserScope {
  userId?: string | number | null;
  username?: string | null;
}

const translations = {
  es: {
    searchMovies: "Buscar películas, género o año",
    chooseGenres: "*Escoge hasta 3 géneros",
    weeklyRecs: "Recomendaciones de la semana",
    yourWatchlist: "Tu Cartelera",
    following: "Seguidos",
    myRating: "Mi Calif.",
    noPoster: "Sin poster",
    personalData: "Datos Personales",
    policies: "Políticas y Términos",
    privacySecurity: "Privacidad y Seguridad",
    logout: "Cerrar Sesión",
  },
  en: {
    searchMovies: "Search movies, genre or year",
    chooseGenres: "*Choose up to 3 genres",
    weeklyRecs: "Weekly Recommendations",
    yourWatchlist: "Your Watchlist",
    following: "Following",
    myRating: "My Rating",
    noPoster: "No Poster",
    personalData: "Personal Data",
    policies: "Policies & Terms",
    privacySecurity: "Privacy & Security",
    logout: "Log Out",
  },
} as const;

type TranslationKey = keyof typeof translations.es;

export function countryToLocale(country: Country): Locale { return country === "US" ? "en" : "es"; }
export function localeToCountry(locale: Locale): Country { return locale === "en" ? "US" : "CO"; }

function normalizeUsername(username?: string | null): string | null {
  if (typeof username !== "string") return null;
  const normalized = username.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function resolveLocaleScope(scope?: LocaleUserScope | null): string | null {
  if (!scope) return null;
  if (scope.userId !== null && scope.userId !== undefined) {
    const normalizedId = String(scope.userId).trim();
    if (normalizedId) return `id:${normalizedId}`;
  }

  const normalizedUsername = normalizeUsername(scope.username);
  return normalizedUsername ? `username:${normalizedUsername}` : null;
}

function buildScopedStorageKey(scopeKey: string): string {
  return `${USER_STORAGE_KEY_PREFIX}${scopeKey}`;
}

function getActiveScopeKey(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ACTIVE_SCOPE_STORAGE_KEY);
  return value?.trim() || null;
}

export function setActiveLocaleScope(scope?: LocaleUserScope | null): Country {
  if (typeof window === "undefined") return "CO";
  const scopeKey = resolveLocaleScope(scope);
  if (!scopeKey) {
    window.localStorage.removeItem(ACTIVE_SCOPE_STORAGE_KEY);
  } else {
    window.localStorage.setItem(ACTIVE_SCOPE_STORAGE_KEY, scopeKey);
  }
  const country = getStoredCountry(scope);
  window.dispatchEvent(new CustomEvent(localeEventName, { detail: { country, locale: countryToLocale(country), scopeKey } }));
  return country;
}

export function getStoredCountry(scope?: LocaleUserScope | null): Country {
  if (typeof window === "undefined") return "CO";
  const scopeKey = resolveLocaleScope(scope) ?? getActiveScopeKey();
  const value = scopeKey
    ? window.localStorage.getItem(buildScopedStorageKey(scopeKey)) ?? window.localStorage.getItem(STORAGE_KEY)
    : window.localStorage.getItem(STORAGE_KEY);
  return value === "US" ? "US" : "CO";
}

export function setStoredCountry(country: Country, scope?: LocaleUserScope | null) {
  if (typeof window === "undefined") return;
  const scopeKey = resolveLocaleScope(scope);
  if (scopeKey) {
    window.localStorage.setItem(buildScopedStorageKey(scopeKey), country);
    window.localStorage.setItem(ACTIVE_SCOPE_STORAGE_KEY, scopeKey);
  } else {
    window.localStorage.setItem(STORAGE_KEY, country);
  }
  window.dispatchEvent(new CustomEvent(localeEventName, { detail: { country, locale: countryToLocale(country), scopeKey } }));
}

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale]?.[key] ?? translations.es[key] ?? key;
}

export function resolveMovieTitles(locale: Locale, titleSpanish?: string | null, titleEnglish?: string | null, fallback?: string | null) {
  const es = titleSpanish?.trim() || null;
  const en = titleEnglish?.trim() || null;
  const base = fallback?.trim() || null;
  const primary = locale === "en" ? en ?? es ?? base ?? "Sin título" : es ?? en ?? base ?? "Sin título";
  const secondaryCandidate = locale === "en" ? es : en;
  const secondary = secondaryCandidate && secondaryCandidate !== primary ? secondaryCandidate : null;
  return { primary, secondary };
}

export function resolveSynopsis(locale: Locale, synopsis?: string | null, synopsisEs?: string | null) {
  if (locale === "en") return synopsis?.trim() || synopsisEs?.trim() || "";
  return synopsisEs?.trim() || synopsis?.trim() || "";
}
