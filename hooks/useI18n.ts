"use client";
import { useEffect, useState } from "react";
import { countryToLocale, getStoredCountry, localeEventName, Locale, t } from "../lib/i18n";

export function useI18n() {
  const [locale, setLocale] = useState<Locale>("es");
  useEffect(() => {
    const sync = () => setLocale(countryToLocale(getStoredCountry()));
    sync();
    window.addEventListener(localeEventName, sync as EventListener);
    return () => window.removeEventListener(localeEventName, sync as EventListener);
  }, []);

  return { locale, t: (key: Parameters<typeof t>[1]) => t(locale, key) };
}
