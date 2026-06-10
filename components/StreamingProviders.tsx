"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { getStoredCountry, localeEventName } from "../lib/i18n";
import type { Country } from "../lib/i18n";
import type { Movie } from "../lib/movies";

const MAX_INLINE_PROVIDERS = 8;
const TMDB_LOGO_BASE_URL = "https://image.tmdb.org/t/p/w92";

type ProviderBucket = "flatrate" | "rent" | "buy";

interface StreamingProvider {
  id: string;
  name: string;
  logoUrl: string | null;
  monetizedUrl: string | null;
  isClickable: boolean;
}

interface StreamingProvidersProps {
  movieId: Movie["id"];
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function toProviderBucket(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return null;
}

function resolveLogoUrl(provider: Record<string, unknown>): string | null {
  const logoUrl = pickString(provider.logo_url, provider.logoUrl, provider.logo, provider.image, provider.icon);
  if (logoUrl) return logoUrl;

  const logoPath = pickString(provider.logo_path, provider.logoPath);
  if (!logoPath) return null;
  if (/^https?:\/\//i.test(logoPath)) return logoPath;
  return `${TMDB_LOGO_BASE_URL}${logoPath.startsWith("/") ? logoPath : `/${logoPath}`}`;
}

function getCountryPayload(payload: unknown, country: Country): Record<string, unknown> | null {
  const root = toRecord(payload);
  if (!root) return null;

  const data = toRecord(root.data);
  const results = toRecord(root.results);
  const countryFromResults = toRecord(results?.[country]);
  const countryFromDataResults = toRecord(toRecord(data?.results)?.[country]);

  return countryFromResults ?? countryFromDataResults ?? data ?? root;
}

function normalizeProvider(rawProvider: unknown, index: number, bucket: ProviderBucket): StreamingProvider | null {
  const provider = toRecord(rawProvider);
  if (!provider) return null;

  const name = pickString(provider.provider_name, provider.providerName, provider.name, provider.title);
  if (!name) return null;

  const monetizedUrl = pickString(provider.monetized_url, provider.monetizedUrl);
  const isClickable = provider.is_clickable === true || provider.isClickable === true;
  const id = pickString(provider.provider_id, provider.providerId, provider.id) ?? `${bucket}:${name}:${index}`;

  return {
    id,
    name,
    logoUrl: resolveLogoUrl(provider),
    monetizedUrl,
    isClickable: isClickable && Boolean(monetizedUrl),
  };
}

function parseStreamingProviders(payload: unknown, country: Country): StreamingProvider[] {
  const countryPayload = getCountryPayload(payload, country);
  if (!countryPayload) return [];

  const bucket = (["flatrate", "rent", "buy"] as ProviderBucket[]).find(
    (candidate) => toProviderBucket(countryPayload[candidate]).length > 0,
  );
  if (!bucket) return [];

  const providers = toProviderBucket(countryPayload[bucket])
    .map((provider, index) => normalizeProvider(provider, index, bucket))
    .filter((provider): provider is StreamingProvider => Boolean(provider));

  const dedupedByProvider = new Map<string, StreamingProvider>();
  providers.forEach((provider) => {
    const key = String(provider.id);
    if (!dedupedByProvider.has(key)) dedupedByProvider.set(key, provider);
  });

  return [...dedupedByProvider.values()];
}

function buildWatchProvidersEndpoint(movieId: Movie["id"], country: Country): string {
  return `/movies/${encodeURIComponent(String(movieId))}/watch-providers/?country=${encodeURIComponent(country)}`;
}

export default function StreamingProviders({ movieId }: StreamingProvidersProps) {
  const [country, setCountry] = useState<Country>("CO");
  const [providers, setProviders] = useState<StreamingProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncCountry = () => setCountry(getStoredCountry(null));
    syncCountry();
    window.addEventListener(localeEventName, syncCountry as EventListener);
    return () => window.removeEventListener(localeEventName, syncCountry as EventListener);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProviders() {
      setLoading(true);
      setError("");

      try {
        const payload = await apiFetch(buildWatchProvidersEndpoint(movieId, country));
        if (cancelled) return;
        setProviders(parseStreamingProviders(payload, country));
      } catch (loadError) {
        console.warn("No se pudieron cargar plataformas de streaming.", loadError);
        if (cancelled) return;
        setProviders([]);
        setError("No pudimos cargar disponibilidad");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProviders();

    return () => {
      cancelled = true;
    };
  }, [country, movieId]);

  const visibleProviders = useMemo(() => providers.slice(0, MAX_INLINE_PROVIDERS), [providers]);
  const hiddenProviders = useMemo(() => providers.slice(MAX_INLINE_PROVIDERS), [providers]);
  const hiddenProvidersCount = hiddenProviders.length;
  const logoSizeClassName = providers.length > 5 ? "h-8 w-8" : "h-9 w-9";

  return (
    <aside className="min-w-0 md:min-w-[150px] md:max-w-[220px]">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86ADE0]">Disponible en</p>

      {loading ? <p className="text-xs text-zinc-500">Cargando...</p> : null}
      {!loading && error ? <p className="text-xs leading-snug text-zinc-500">{error}</p> : null}
      {!loading && !error && providers.length === 0 ? (
        <p className="text-xs leading-snug text-zinc-500">Sin disponibilidad para tu país</p>
      ) : null}

      {!loading && !error && providers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {visibleProviders.map((provider) => {
            const logo = provider.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={provider.logoUrl} alt={provider.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <span className="text-[10px] font-semibold text-zinc-300">{provider.name.slice(0, 2).toUpperCase()}</span>
            );
            const tooltip = `Disponible en ${provider.name}`;
            const logoClassName = `flex ${logoSizeClassName} flex-shrink-0 items-center justify-center overflow-hidden rounded-full transition ${
              provider.isClickable
                ? "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                : "cursor-default opacity-70"
            }`;

            return provider.isClickable && provider.monetizedUrl ? (
              <a
                key={provider.id}
                href={provider.monetizedUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={tooltip}
                aria-label={`Ver ${provider.name}`}
                className={logoClassName}
              >
                {logo}
              </a>
            ) : (
              <span key={provider.id} title={tooltip} aria-label={tooltip} className={logoClassName}>
                {logo}
              </span>
            );
          })}
          {hiddenProvidersCount > 0 ? (
            <div className="group relative inline-flex">
              <button
                type="button"
                title={`${hiddenProvidersCount} plataformas más`}
                aria-label={`Ver ${hiddenProvidersCount} plataformas más`}
                className="rounded-full px-1 text-xs font-semibold text-zinc-400 transition hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                +{hiddenProvidersCount}
              </button>
              <div className="pointer-events-none absolute left-1/2 top-full z-20 w-52 -translate-x-1/2 rounded-xl bg-zinc-950/95 p-3 opacity-0 shadow-2xl ring-1 ring-white/10 backdrop-blur transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                  {hiddenProviders.map((provider) => {
                    const tooltip = `Disponible en ${provider.name}`;
                    const content = (
                      <>
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-900">
                          {provider.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={provider.logoUrl}
                              alt={provider.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="text-[9px] font-semibold text-zinc-300">
                              {provider.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 truncate">{provider.name}</span>
                      </>
                    );
                    const itemClassName = "flex items-center gap-2 rounded-lg p-1 text-xs text-zinc-200 transition";

                    return provider.isClickable && provider.monetizedUrl ? (
                      <a
                        key={provider.id}
                        href={provider.monetizedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={tooltip}
                        aria-label={`Ver ${provider.name}`}
                        className={`${itemClassName} hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/80`}
                      >
                        {content}
                      </a>
                    ) : (
                      <div key={provider.id} className={`${itemClassName} cursor-default opacity-80`} title={tooltip} aria-label={tooltip}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
