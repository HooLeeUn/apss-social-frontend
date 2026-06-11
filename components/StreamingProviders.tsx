"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { getStoredLocaleSelection, localeEventName } from "../lib/i18n";
import type { Country, Locale } from "../lib/i18n";
import type { Movie } from "../lib/movies";

const MAX_INLINE_PROVIDERS = 4;
const TMDB_LOGO_BASE_URL = "https://image.tmdb.org/t/p/w92";

type ProviderBucket = "flatrate" | "rent" | "buy";

interface StreamingProvider {
  id: string;
  name: string;
  logoUrl: string | null;
  monetizedUrl: string | null;
  isClickable: boolean;
  availability: ProviderBucket[];
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

function pickProviderId(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    const normalized = pickString(value);
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

function normalizeProvider(rawProvider: unknown, bucket: ProviderBucket): StreamingProvider | null {
  const provider = toRecord(rawProvider);
  if (!provider) return null;

  const name = pickString(provider.provider_name, provider.providerName, provider.name, provider.title);
  if (!name) return null;

  const monetizedUrl = pickString(provider.monetized_url, provider.monetizedUrl);
  const isClickable = provider.is_clickable === true || provider.isClickable === true;
  const id = pickProviderId(provider.provider_id, provider.providerId, provider.id) ?? `name:${name.toLowerCase()}`;

  return {
    id,
    name,
    logoUrl: resolveLogoUrl(provider),
    monetizedUrl,
    isClickable: isClickable && Boolean(monetizedUrl),
    availability: [bucket],
  };
}

function parseStreamingProviders(payload: unknown, country: Country): StreamingProvider[] {
  const countryPayload = getCountryPayload(payload, country);
  if (!countryPayload) return [];

  const providersById = new Map<string, StreamingProvider>();

  (["flatrate", "rent", "buy"] as ProviderBucket[]).forEach((bucket) => {
    toProviderBucket(countryPayload[bucket])
      .map((provider) => normalizeProvider(provider, bucket))
      .filter((provider): provider is StreamingProvider => Boolean(provider))
      .forEach((provider) => {
        const existingProvider = providersById.get(provider.id);

        if (!existingProvider) {
          providersById.set(provider.id, provider);
          return;
        }

        if (!existingProvider.availability.includes(bucket)) {
          existingProvider.availability.push(bucket);
        }

        if (!existingProvider.logoUrl && provider.logoUrl) {
          existingProvider.logoUrl = provider.logoUrl;
        }

        if (!existingProvider.isClickable && provider.isClickable && provider.monetizedUrl) {
          existingProvider.isClickable = true;
          existingProvider.monetizedUrl = provider.monetizedUrl;
        }
      });
  });

  return [...providersById.values()];
}

function getAvailabilityTooltip(provider: StreamingProvider, locale: Locale): string {
  return locale === "en" ? `Available on ${provider.name}` : `Disponible en ${provider.name}`;
}

function getStreamingLabels(locale: Locale) {
  return locale === "en"
    ? {
        title: "AVAILABLE ON",
        subscription: "Subscription",
        rentBuy: "Rent/Buy",
        loading: "Loading...",
        loadError: "We couldn't load availability",
        empty: "No availability for your country",
        moreTitle: (count: number) => `${count} more platforms`,
        moreAria: (count: number) => `View ${count} more platforms`,
      }
    : {
        title: "DISPONIBLE EN",
        subscription: "Suscripción",
        rentBuy: "Renta/Compra",
        loading: "Cargando...",
        loadError: "No pudimos cargar disponibilidad",
        empty: "Sin disponibilidad para tu país",
        moreTitle: (count: number) => `${count} plataformas más`,
        moreAria: (count: number) => `Ver ${count} plataformas más`,
      };
}

function ProviderLogoMark({ provider, sizeClassName = "h-9 w-9" }: { provider: StreamingProvider; sizeClassName?: string }) {
  return (
    <span className={`flex ${sizeClassName} items-center justify-center overflow-hidden rounded-full bg-zinc-900`}>
      {provider.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={provider.logoUrl} alt={provider.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <span className="text-[10px] font-semibold text-zinc-300">{provider.name.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

function ProviderLogo({ provider, locale }: { provider: StreamingProvider; locale: Locale }) {
  const tooltip = getAvailabilityTooltip(provider, locale);
  const providerClassName = `flex flex-shrink-0 items-center justify-center transition ${
    provider.isClickable
      ? "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      : "cursor-default opacity-70"
  }`;
  const content = <ProviderLogoMark provider={provider} />;

  return provider.isClickable && provider.monetizedUrl ? (
    <a
      href={provider.monetizedUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={tooltip}
      aria-label={tooltip}
      className={providerClassName}
    >
      {content}
    </a>
  ) : (
    <span title={tooltip} aria-label={tooltip} className={providerClassName}>
      {content}
    </span>
  );
}

function ProviderOverflowMenu({ providers, locale }: { providers: StreamingProvider[]; locale: Locale }) {
  if (providers.length === 0) return null;

  const labels = getStreamingLabels(locale);

  return (
    <div className="group relative z-50 inline-flex overflow-visible">
      <button
        type="button"
        title={labels.moreTitle(providers.length)}
        aria-label={labels.moreAria(providers.length)}
        className="rounded-full px-1 text-xs font-semibold text-zinc-400 transition hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        +{providers.length}
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-[60] mt-1 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-zinc-950/95 p-2 opacity-0 shadow-2xl ring-1 ring-white/10 backdrop-blur transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="scrollbar-metallic-blue grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto overscroll-contain pr-1">
          {providers.map((provider) => {
            const tooltip = getAvailabilityTooltip(provider, locale);
            const itemClassName = "flex items-center justify-center rounded-lg p-1 transition";
            const content = <ProviderLogoMark provider={provider} sizeClassName="h-7 w-7" />;

            return provider.isClickable && provider.monetizedUrl ? (
              <a
                key={provider.id}
                href={provider.monetizedUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={tooltip}
                aria-label={tooltip}
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
  );
}

function ProviderRow({ providers, label, locale }: { providers: StreamingProvider[]; label: string; locale: Locale }) {
  if (providers.length === 0) return null;

  const visibleProviders = providers.slice(0, MAX_INLINE_PROVIDERS);
  const hiddenProviders = providers.slice(MAX_INLINE_PROVIDERS);

  return (
    <div className="space-y-1.5 overflow-visible">
      <div className="flex flex-wrap items-center justify-center gap-2 overflow-visible">
        {visibleProviders.map((provider) => (
          <ProviderLogo key={provider.id} provider={provider} locale={locale} />
        ))}
        <ProviderOverflowMenu providers={hiddenProviders} locale={locale} />
      </div>
      <p className="text-center text-[10px] font-medium leading-none text-zinc-500">{label}</p>
    </div>
  );
}

function buildWatchProvidersEndpoint(movieId: Movie["id"], country: Country): string {
  return `/movies/${encodeURIComponent(String(movieId))}/watch-providers/?country=${encodeURIComponent(country)}`;
}

export default function StreamingProviders({ movieId }: StreamingProvidersProps) {
  const [country, setCountry] = useState<Country>("CO");
  const [locale, setLocale] = useState<Locale>("es");
  const [providers, setProviders] = useState<StreamingProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncCountry = () => {
      const selection = getStoredLocaleSelection(null);
      setCountry(selection.country);
      setLocale(selection.language);
    };
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
        setError(getStreamingLabels(locale).loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProviders();

    return () => {
      cancelled = true;
    };
  }, [country, locale, movieId]);

  const labels = getStreamingLabels(locale);
  const subscriptionProviders = useMemo(() => providers.filter((provider) => provider.availability.includes("flatrate")), [providers]);
  const rentBuyProviders = useMemo(
    () => providers.filter((provider) => provider.availability.includes("rent") || provider.availability.includes("buy")),
    [providers],
  );
  const hasProviders = subscriptionProviders.length > 0 || rentBuyProviders.length > 0;

  return (
    <aside className="relative z-30 min-w-0 overflow-visible md:min-w-[150px] md:max-w-[220px]">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86ADE0]">{labels.title}</p>

      {loading ? <p className="text-xs text-zinc-500">{labels.loading}</p> : null}
      {!loading && error ? <p className="text-xs leading-snug text-zinc-500">{error}</p> : null}
      {!loading && !error && !hasProviders ? <p className="text-xs leading-snug text-zinc-500">{labels.empty}</p> : null}

      {!loading && !error && hasProviders ? (
        <div className="space-y-3">
          <ProviderRow providers={subscriptionProviders} label={labels.subscription} locale={locale} />
          <ProviderRow providers={rentBuyProviders} label={labels.rentBuy} locale={locale} />
        </div>
      ) : null}
    </aside>
  );
}
