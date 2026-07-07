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
