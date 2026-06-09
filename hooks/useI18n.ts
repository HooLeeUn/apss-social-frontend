"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { countryToLocale, getStoredCountry, localeEventName, Locale, LocaleUserScope, t } from "../lib/i18n";

export function useI18n(scope?: LocaleUserScope | null) {
  const [locale, setLocale] = useState<Locale>("es");
  const scopeKey = useMemo(() => `${String(scope?.userId ?? "")}:${String(scope?.username ?? "")}`, [scope?.userId, scope?.username]);
  useEffect(() => {
    const sync = () => setLocale(countryToLocale(getStoredCountry(scope)));
    sync();
    window.addEventListener(localeEventName, sync as EventListener);
    return () => window.removeEventListener(localeEventName, sync as EventListener);
  }, [scope, scopeKey]);

  const translate = useCallback((key: Parameters<typeof t>[1]) => t(locale, key), [locale]);

  return { locale, t: translate };
}
