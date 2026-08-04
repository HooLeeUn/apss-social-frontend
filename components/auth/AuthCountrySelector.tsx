"use client";

import StreamingCountrySelector from "../StreamingCountrySelector";
import { useI18n } from "../../hooks/useI18n";
import { setStoredCountry } from "../../lib/i18n";
import { getAuthTranslations } from "../../lib/auth-translations";

export function useAuthLocale() {
  const { country, locale } = useI18n(null);
  return { country, locale, text: getAuthTranslations(locale) };
}

export default function AuthCountrySelector() {
  const { country, text } = useAuthLocale();
  return <StreamingCountrySelector country={country} onCountryChange={(next) => setStoredCountry(next, null)} buttonId="auth-country-button" labels={{ country: text.countryLabel, search: text.countrySearch, noResults: text.noCountries }} />;
}
