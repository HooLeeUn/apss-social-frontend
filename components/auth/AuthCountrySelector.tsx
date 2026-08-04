"use client";

import StreamingCountrySelector from "../StreamingCountrySelector";
import { useI18n } from "../../hooks/useI18n";
import { getAuthTranslations } from "../../lib/auth-translations";

export function useAuthLocale() {
  const { country, locale, setCountry } = useI18n(null);
  return { country, locale, setCountry, text: getAuthTranslations(locale) };
}

export default function AuthCountrySelector() {
  const { country, setCountry, text } = useAuthLocale();
  return <StreamingCountrySelector country={country} onCountryChange={setCountry} buttonId="auth-country-button" labels={{ country: text.countryLabel, search: text.countrySearch, noResults: text.noCountries }} />;
}
