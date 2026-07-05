"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { getToken } from "../lib/auth";
import { getStoredCountry, isSupportedCountry, localeEventName, normalizeCountry, setActiveLocaleScope, setStoredCountry } from "../lib/i18n";
import type { Country } from "../lib/i18n";
import StreamingCountrySelector from "./StreamingCountrySelector";

export default function MovieDetailStreamingCountrySelector() {
  const [country, setCountry] = useState<Country>("CO");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const syncCountry = () => setCountry(getStoredCountry(null));

    const loadBackendCountry = async () => {
      if (!getToken()) {
        syncCountry();
        return;
      }

      try {
        const me = await apiFetch("/me/", { cache: "no-store" });
        if (cancelled) return;

        const meRecord = me && typeof me === "object" ? (me as Record<string, unknown>) : null;
        const userId = meRecord?.id !== null && meRecord?.id !== undefined ? String(meRecord?.id) : null;
        const username = typeof meRecord?.username === "string"
          ? meRecord.username
          : typeof meRecord?.user_name === "string"
            ? meRecord.user_name
            : null;
        setActiveLocaleScope({ userId, username });
        const backendCountry = isSupportedCountry(meRecord?.streaming_country)
          ? normalizeCountry(meRecord?.streaming_country)
          : isSupportedCountry(meRecord?.country)
            ? normalizeCountry(meRecord?.country)
            : getStoredCountry({ userId, username });
        setStoredCountry(backendCountry, { userId, username });
        setCountry(backendCountry);
      } catch (loadError) {
        console.warn("No se pudo cargar streaming_country desde el backend; se usó la caché local.", loadError);
        syncCountry();
      }
    };

    void loadBackendCountry();
    window.addEventListener(localeEventName, syncCountry as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener(localeEventName, syncCountry as EventListener);
    };
  }, []);

  const handleCountryChange = useCallback(
    async (nextCountry: Country) => {
      if (nextCountry === country || isSaving) return;

      setCountry(nextCountry);
      setStoredCountry(nextCountry, null);
      setError("");
      setIsSaving(true);

      try {
        if (getToken()) {
          await apiFetch("/me/", {
            method: "PATCH",
            body: JSON.stringify({ streaming_country: nextCountry }),
          });
        }
      } catch (streamingCountryPatchError) {
        console.warn("No se pudo actualizar streaming_country en el backend; se conservó la selección local.", streamingCountryPatchError);
      } finally {
        setIsSaving(false);
      }
    },
    [country, isSaving],
  );

  return (
    <StreamingCountrySelector
      country={country}
      onCountryChange={handleCountryChange}
      disabled={isSaving}
      error={error}
      buttonId="movie-detail-streaming-country-button"
      compact
    />
  );
}
