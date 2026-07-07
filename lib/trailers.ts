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
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function withTrailerAutoplayParams(trailerUrl: string): string {
  const [baseUrl, hash = ""] = trailerUrl.split("#", 2);
  const separator = baseUrl.includes("?") ? "&" : "?";
  const params = "autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1";

  return `${baseUrl}${separator}${params}${hash ? `#${hash}` : ""}`;
}

export async function fetchMovieTrailer(movieId: Movie["id"], country: Country): Promise<MovieTrailer> {
  const encodedMovieId = encodeURIComponent(String(movieId));
  const encodedCountry = encodeURIComponent(country);
  const payload = (await apiFetch(`/movies/${encodedMovieId}/trailer/?country=${encodedCountry}`, { cache: "no-store" })) as Record<string, unknown> | null;

  return {
    trailerUrl: readString(payload?.trailer_url),
    watchUrl: readString(payload?.watch_url),
    youtubeKey: readString(payload?.youtube_key),
    language: readString(payload?.language),
    source: readString(payload?.source),
    available: payload?.available === true,
  };
}
