export type Locale = "es" | "en";
export type Country = "CO" | "US";

const STORAGE_KEY = "app_locale_country";
export const localeEventName = "app-locale-change";

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

export function getStoredCountry(): Country {
  if (typeof window === "undefined") return "CO";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "US" ? "US" : "CO";
}

export function setStoredCountry(country: Country) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, country);
  window.dispatchEvent(new CustomEvent(localeEventName, { detail: { country, locale: countryToLocale(country) } }));
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
