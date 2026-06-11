"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { countryToLocale, getStoredCountry, localeEventName, Locale, LocaleUserScope, t } from "../lib/i18n";

export function useI18n(scope?: LocaleUserScope | null) {
  const [locale, setLocale] = useState<Locale>("es");
  const [country, setCountry] = useState(() => getStoredCountry(scope));
  const scopeKey = useMemo(() => `${String(scope?.userId ?? "")}:${String(scope?.username ?? "")}`, [scope?.userId, scope?.username]);
  useEffect(() => {
    const sync = () => {
      const nextCountry = getStoredCountry(scope);
      setCountry(nextCountry);
      setLocale(countryToLocale(nextCountry));
    };
    sync();
    window.addEventListener(localeEventName, sync as EventListener);
    return () => window.removeEventListener(localeEventName, sync as EventListener);
  }, [scope, scopeKey]);

  const translate = useCallback((key: Parameters<typeof t>[1]) => t(locale, key), [locale]);

  return { locale, country, t: translate };
}
