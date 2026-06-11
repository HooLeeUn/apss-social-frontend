"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { getStoredCountry, localeEventName, setStoredCountry } from "../lib/i18n";
import type { Country } from "../lib/i18n";
import StreamingCountrySelector from "./StreamingCountrySelector";

export default function MovieDetailStreamingCountrySelector() {
  const [country, setCountry] = useState<Country>("CO");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncCountry = () => setCountry(getStoredCountry(null));

    syncCountry();
    window.addEventListener(localeEventName, syncCountry as EventListener);
    return () => window.removeEventListener(localeEventName, syncCountry as EventListener);
  }, []);

  const handleCountryChange = useCallback(
    async (nextCountry: Country) => {
      if (nextCountry === country || isSaving) return;

      setCountry(nextCountry);
      setStoredCountry(nextCountry, null);
      setError("");
      setIsSaving(true);

      try {
        await apiFetch("/me/", {
          method: "PATCH",
          body: JSON.stringify({ streaming_country: nextCountry }),
        });
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
