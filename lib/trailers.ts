import { apiFetch } from "./api";
import type { Movie } from "./movies";
import type { Country } from "./i18n";

export interface MovieTrailer {
  trailerUrl: string | null;
  watchUrl: string | null;
  youtubeKey: string | null;
  language: string | null;
  source: string | null;
  available: boolean;
  externalOnly: boolean;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function appendTrailerParams(trailerUrl: string, params: Record<string, string>): string {
  const [baseUrl, hash = ""] = trailerUrl.split("#", 2);
  const url = new URL(baseUrl, "https://www.youtube.com");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const nextUrl = baseUrl.startsWith("http") ? url.toString() : `${url.pathname}${url.search}`;

  return `${nextUrl}${hash ? `#${hash}` : ""}`;
}

export function withTrailerAutoplayParams(trailerUrl: string): string {
  return appendTrailerParams(trailerUrl, {
    autoplay: "1",
    mute: "1",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
  });
}

export function withYouTubeIframeApiParams(trailerUrl: string): string {
  const origin = typeof window === "undefined" ? undefined : window.location.origin;

  return appendTrailerParams(trailerUrl, {
    autoplay: "1",
    mute: "1",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
    ...(origin ? { origin } : {}),
  });
}

export async function fetchMovieTrailer(movieId: Movie["id"], country: Country): Promise<MovieTrailer> {
  const encodedMovieId = encodeURIComponent(String(movieId));
  const encodedCountry = encodeURIComponent(country);
  const payload = (await apiFetch(`/movies/${encodedMovieId}/trailer/?country=${encodedCountry}`, { cache: "no-store" })) as Record<string, unknown> | null;

  const trailerUrl = readString(payload?.trailer_url);

  return {
    trailerUrl,
    watchUrl: readString(payload?.watch_url),
    youtubeKey: readString(payload?.youtube_key),
    language: readString(payload?.language),
    source: readString(payload?.source),
    // An embed URL is the capability signal used by every interaction.  Some
    // responses contain an inconsistent `available: false`/`external_only:
    // true` pair even though they also include a valid embed URL. Treating the
    // URL as authoritative prevents an interaction from propagating that
    // contradictory fallback classification.
    available: trailerUrl !== null,
    externalOnly: trailerUrl === null && payload?.external_only === true,
  };
}
