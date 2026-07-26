import { apiFetch } from "./api";
import type { Movie } from "./movies";
import type { Country } from "./i18n";
import { saveTrailerDebugSnapshot, trailerDebugLog } from "./trailerDebug";

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

export async function fetchMovieTrailer(movieId: Movie["id"], country: Country, title: string | null = null): Promise<MovieTrailer> {
  const encodedMovieId = encodeURIComponent(String(movieId));
  const encodedCountry = encodeURIComponent(country);
  const payload = (await apiFetch(`/movies/${encodedMovieId}/trailer/?country=${encodedCountry}`, { cache: "no-store" })) as Record<string, unknown> | null;

  const trailerUrl = readString(payload?.trailer_url);

  const normalized: MovieTrailer = {
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

  const snapshot = {
    movieId,
    title: title ?? readString(payload?.title),
    tmdbId: payload?.tmdb_id ?? payload?.tmdbId ?? null,
    videoId: payload?.video_id ?? payload?.videoId ?? payload?.youtube_key ?? null,
    trailerKey: payload?.trailer_key ?? payload?.trailerKey ?? payload?.youtube_key ?? null,
    trailer_url: payload?.trailer_url ?? null,
    watchUrl: payload?.watch_url ?? null,
    available: payload?.available ?? null,
    external_only: payload?.external_only ?? null,
    source: payload?.source ?? null,
    language: payload?.language ?? null,
    normalizedResponse: normalized,
  };
  saveTrailerDebugSnapshot(snapshot);
  trailerDebugLog("Backend trailer response", snapshot);
  trailerDebugLog("Internal trailer object constructed", {
    videoId: snapshot.videoId,
    watchUrl: normalized.watchUrl,
    available: normalized.available,
    externalOnly: normalized.externalOnly,
    embedUrl: normalized.trailerUrl,
    youtubeUrl: normalized.watchUrl,
    normalizedState: normalized,
  });

  return normalized;
}
