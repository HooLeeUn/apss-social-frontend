"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { countryToLocale, getStoredCountry, localeEventName, LocaleUserScope, setStoredCountry, t } from "../lib/i18n";

export function useI18n(scope?: LocaleUserScope | null) {
  const [country, setCountry] = useState(() => getStoredCountry(scope));
  const locale = countryToLocale(country);
  const scopeKey = useMemo(() => `${String(scope?.userId ?? "")}:${String(scope?.username ?? "")}`, [scope?.userId, scope?.username]);
  useEffect(() => {
    const sync = () => {
      const nextCountry = getStoredCountry(scope);
      setCountry(nextCountry);
    };
    sync();
    window.addEventListener(localeEventName, sync as EventListener);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(localeEventName, sync as EventListener);
      window.removeEventListener("storage", sync);
    };
  }, [scope, scopeKey]);

  const translate = useCallback((key: Parameters<typeof t>[1]) => t(locale, key), [locale]);

  const updateCountry = useCallback((nextCountry: typeof country) => setStoredCountry(nextCountry), []);

  return { locale, country, setCountry: updateCountry, t: translate };
}
