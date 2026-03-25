export interface Movie {
  id: number | string;
  title: string;
  year: string;
  genres: string[];
  posterUrl: string | null;
  displayRating: number | null;
  myRating: number | null;
  followingAvgRating: number | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const MOVIES_FEED_ENDPOINT = process.env.NEXT_PUBLIC_MOVIES_FEED_ENDPOINT || "/feed/movies/";
export const GENRES_ENDPOINT = process.env.NEXT_PUBLIC_GENRES_ENDPOINT || "/movies/genres/";
export const SEARCH_ENDPOINT = process.env.NEXT_PUBLIC_SEARCH_ENDPOINT || "/movies/search/";

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && "name" in entry) return String(entry.name);
        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim() !== "") {
    return value
      .split(",")
      .map((genre) => genre.trim())
      .filter(Boolean);
  }

  return [];
}

function pickFirst<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

export function normalizeMovie(raw: Record<string, unknown>, index: number): Movie {
  const genres = toStringList(pickFirst(raw.genres, raw.genre));

  const title = String(pickFirst(raw.title, raw.name, `Movie ${index + 1}`));
  const id = pickFirst(raw.id, raw.movie_id, `${title}-${index + 1}`) as number | string;

  const yearValue = pickFirst(raw.year, raw.release_year, raw.release_date);
  const year = typeof yearValue === "string" ? yearValue.slice(0, 4) : String(yearValue ?? "-");

  return {
    id,
    title,
    year,
    genres,
    posterUrl: (pickFirst(raw.poster, raw.poster_url, raw.image_url, raw.image) as string | null) || null,
    displayRating: toNumber(pickFirst(raw.display_rating, raw.general_rating, raw.avg_rating, raw.rating)),
    myRating: toNumber(raw.my_rating),
    followingAvgRating: toNumber(pickFirst(raw.following_avg_rating, raw.following_rating)),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseMovieList(payload: unknown): Movie[] {
  const source =
    Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.results)
        ? payload.results
        : isRecord(payload) && Array.isArray(payload.items)
          ? payload.items
          : isRecord(payload) && Array.isArray(payload.data)
            ? payload.data
            : [];

  return source
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item, index) => normalizeMovie(item, index));
}

export function parseGenres(payload: unknown): string[] {
  const source =
    Array.isArray(payload)
      ? payload
      : typeof payload === "object" && payload !== null && "results" in payload
        ? (payload as PaginatedResponse<string>).results
        : [];

  return source
    .map((genre) => {
      if (typeof genre === "string") return genre;
      if (typeof genre === "object" && genre !== null && "name" in genre) return String(genre.name);
      return "";
    })
    .filter(Boolean);
}

export function filterMoviesByGenre(movies: Movie[], genre: string): Movie[] {
  if (!genre || genre === "Todos") return movies;
  return movies.filter((movie) => movie.genres.some((movieGenre) => movieGenre === genre));
}
