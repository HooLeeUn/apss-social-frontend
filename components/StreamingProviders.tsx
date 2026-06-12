"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../lib/api";
import { getStoredLocaleSelection, localeEventName } from "../lib/i18n";
import type { Country, Locale } from "../lib/i18n";
import type { Movie } from "../lib/movies";
import { STREAMING_COUNTRY_OPTIONS } from "../lib/streaming-countries";

const MAX_INLINE_PROVIDERS = 4;
const TMDB_LOGO_BASE_URL = "https://image.tmdb.org/t/p/w92";
const TOOLTIP_OFFSET_PX = 10;
const TOOLTIP_VIEWPORT_PADDING_PX = 16;
const TOOLTIP_MAX_WIDTH_PX = 280;

const COUNTRY_NAMES_BY_LOCALE: Record<Locale, Partial<Record<Country, string>>> = {
  es: Object.fromEntries(STREAMING_COUNTRY_OPTIONS.map((countryOption) => [countryOption.value, countryOption.name])) as Partial<
    Record<Country, string>
  >,
  en: {
    AR: "Argentina",
    BO: "Bolivia",
    BZ: "Belize",
    CA: "Canada",
    CL: "Chile",
    CO: "Colombia",
    CR: "Costa Rica",
    DO: "Dominican Republic",
    EC: "Ecuador",
    ES: "Spain",
    GT: "Guatemala",
    HN: "Honduras",
    MX: "Mexico",
    NI: "Nicaragua",
    PA: "Panama",
    PE: "Peru",
    PR: "Puerto Rico",
    PY: "Paraguay",
    SV: "El Salvador",
    UK: "United Kingdom",
    US: "United States",
    UY: "Uruguay",
    VE: "Venezuela",
  },
};

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

interface TooltipPosition {
  left: number;
  top: number;
  transform: string;
}

function getCountryName(country: Country, locale: Locale): string {
  return COUNTRY_NAMES_BY_LOCALE[locale][country] ?? COUNTRY_NAMES_BY_LOCALE.es[country] ?? country;
}

function getCountryAvailabilityWarning(country: Country, locale: Locale): string {
  const countryName = getCountryName(country, locale);

  return locale === "en"
    ? `Availability based on selected country: ${countryName}.\nThis availability corresponds to the country selected in QNext. Actual availability may vary depending on your location, account, or platform region.`
    : `Disponibilidad según país seleccionado: ${countryName}.\nEsta disponibilidad corresponde al país seleccionado en QNext. La disponibilidad real puede variar según tu ubicación, cuenta o región de la plataforma.`;
}

function getTooltipPosition(target: HTMLElement): TooltipPosition {
  const rect = target.getBoundingClientRect();
  const centeredLeft = rect.left + rect.width / 2;
  const minLeft = TOOLTIP_VIEWPORT_PADDING_PX + TOOLTIP_MAX_WIDTH_PX / 2;
  const maxLeft = window.innerWidth - TOOLTIP_VIEWPORT_PADDING_PX - TOOLTIP_MAX_WIDTH_PX / 2;
  const left = Math.min(Math.max(centeredLeft, minLeft), Math.max(minLeft, maxLeft));
  const shouldShowBelow = rect.top < 96;

  return {
    left,
    top: shouldShowBelow ? rect.bottom + TOOLTIP_OFFSET_PX : rect.top - TOOLTIP_OFFSET_PX,
    transform: shouldShowBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
  };
}

function QNextTooltip({ text, position }: { text: string; position: TooltipPosition }) {
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[9999] whitespace-pre-line rounded-lg border border-[#86ADE0]/30 bg-zinc-950/95 px-3 py-2 text-center text-[11px] font-medium leading-snug text-zinc-100 shadow-[0_14px_32px_rgba(0,0,0,0.45)] ring-1 ring-black/40 backdrop-blur-sm"
      style={{
        left: position.left,
        top: position.top,
        maxWidth: TOOLTIP_MAX_WIDTH_PX,
        transform: position.transform,
      }}
    >
      {text}
    </div>,
    document.body,
  );
}

function TooltipTarget({ text, children }: { text: string; children: ReactNode }) {
  const targetRef = useRef<HTMLSpanElement | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const showTooltip = () => {
    if (!targetRef.current) return;
    setPosition(getTooltipPosition(targetRef.current));
  };

  const hideTooltip = () => setPosition(null);

  return (
    <span
      ref={targetRef}
      className="inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {position ? <QNextTooltip text={text} position={position} /> : null}
    </span>
  );
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
        moreAria: (count: number) => `View ${count} more platforms`,
      }
    : {
        title: "DISPONIBLE EN",
        subscription: "Suscripción",
        rentBuy: "Renta/Compra",
        loading: "Cargando...",
        loadError: "No pudimos cargar disponibilidad",
        empty: "Sin disponibilidad para tu país",
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

  return (
    <TooltipTarget text={tooltip}>
      {provider.isClickable && provider.monetizedUrl ? (
        <a href={provider.monetizedUrl} target="_blank" rel="noopener noreferrer" aria-label={tooltip} className={providerClassName}>
          {content}
        </a>
      ) : (
        <span aria-label={tooltip} className={providerClassName}>
          {content}
        </span>
      )}
    </TooltipTarget>
  );
}

function ProviderOverflowMenu({ providers, locale }: { providers: StreamingProvider[]; locale: Locale }) {
  if (providers.length === 0) return null;

  const labels = getStreamingLabels(locale);
  const visibleColumns = Math.min(providers.length, MAX_INLINE_PROVIDERS);
  const overflowListStyle = {
    width: `calc(${visibleColumns} * 2.25rem + ${Math.max(visibleColumns - 1, 0)} * 0.375rem)`,
  } satisfies CSSProperties;

  return (
    <div className="group relative z-50 inline-flex overflow-visible">
      <button
        type="button"
        aria-label={labels.moreAria(providers.length)}
        className="rounded-full px-1 text-xs font-semibold text-zinc-400 transition hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        +{providers.length}
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-[60] mt-1 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-zinc-950/95 p-2 opacity-0 shadow-2xl ring-1 ring-white/10 backdrop-blur transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div
          className="scrollbar-metallic-blue flex max-w-full gap-1.5 overflow-x-auto overflow-y-hidden overscroll-contain pb-1"
          style={overflowListStyle}
        >
          {providers.map((provider) => {
            const tooltip = getAvailabilityTooltip(provider, locale);
            const itemClassName = "flex w-9 flex-shrink-0 items-center justify-center rounded-lg p-1 transition";
            const content = <ProviderLogoMark provider={provider} sizeClassName="h-7 w-7" />;

            return (
              <TooltipTarget key={provider.id} text={tooltip}>
                {provider.isClickable && provider.monetizedUrl ? (
                  <a
                    href={provider.monetizedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tooltip}
                    className={`${itemClassName} hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/80`}
                  >
                    {content}
                  </a>
                ) : (
                  <div className={`${itemClassName} cursor-default opacity-80`} aria-label={tooltip}>
                    {content}
                  </div>
                )}
              </TooltipTarget>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AvailabilityCountryWarning({ country, locale }: { country: Country; locale: Locale }) {
  const tooltip = getCountryAvailabilityWarning(country, locale);

  return (
    <TooltipTarget text={tooltip}>
      <button
        type="button"
        aria-label={tooltip}
        className="-mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-bold leading-none text-[#86ADE0]/80 transition hover:text-[#AFC7E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        *
      </button>
    </TooltipTarget>
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
      <div className="mb-2 inline-flex items-center gap-1.5 align-middle">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86ADE0]">{labels.title}</p>
        <AvailabilityCountryWarning country={country} locale={locale} />
      </div>

      {loading ? (
        <div className="space-y-2" aria-label={labels.loading}>
          <div className="h-3 w-20 animate-pulse rounded-full bg-white/10" />
          <div className="flex items-center justify-center gap-2">
            <span className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
            <span className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
            <span className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      ) : null}
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
