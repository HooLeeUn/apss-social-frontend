export interface MovieTopUser {
  name: string | null;
  avatarUrl: string | null;
}

export interface Movie {
  id: number | string;
  title: string;
  contentType: string;
  year: string;
  genres: string[];
  posterUrl: string | null;
  displayRating: number | null;
  myRating: number | null;
  followingAvgRating: number | null;
  topUser: MovieTopUser | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface MoviePaginationMeta {
  count: number | null;
  next: string | null;
  previous: string | null;
}

export const MOVIES_FEED_ENDPOINT = process.env.NEXT_PUBLIC_MOVIES_FEED_ENDPOINT || "/feed/movies/";
export const WEEKLY_MOVIES_FEED_ENDPOINT = process.env.NEXT_PUBLIC_WEEKLY_MOVIES_FEED_ENDPOINT || "/movies/weekly/";
export const PERSONALIZED_MOVIES_FEED_ENDPOINT =
  process.env.NEXT_PUBLIC_PERSONALIZED_MOVIES_FEED_ENDPOINT || "/feed/personalized/";
export const MOVIE_DETAIL_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_MOVIE_DETAIL_ENDPOINT_TEMPLATE || "/movies/{id}/";
export const MOVIE_DETAIL_FALLBACK_ENDPOINT_TEMPLATES = (
  process.env.NEXT_PUBLIC_MOVIE_DETAIL_FALLBACK_ENDPOINT_TEMPLATES || "/movies/details/{id}/"
)
  .split(",")
  .map((endpoint) => endpoint.trim())
  .filter(Boolean)
  .filter((endpoint) => endpoint !== MOVIE_DETAIL_ENDPOINT_TEMPLATE);
export const GENRES_ENDPOINT = process.env.NEXT_PUBLIC_GENRES_ENDPOINT || "/movies/genres/";
export const SEARCH_ENDPOINT = process.env.NEXT_PUBLIC_SEARCH_ENDPOINT || "/movies/search/";

export function buildMovieDetailEndpoint(movieId: string, template: string = MOVIE_DETAIL_ENDPOINT_TEMPLATE): string {
  return template.replace("{id}", encodeURIComponent(movieId));
}

export function normalizeNextEndpoint(nextUrl: string, apiBaseUrl: string): string {
  if (nextUrl.startsWith("http://") || nextUrl.startsWith("https://")) {
    const { pathname, search } = new URL(nextUrl);
    const normalizedPath = pathname.startsWith("/api/") ? pathname.replace(/^\/api/, "") : pathname;
    return `${normalizedPath}${search}`;
  }

  if (nextUrl.startsWith("/api/")) {
    return nextUrl.replace(/^\/api/, "");
  }

  if (nextUrl.startsWith("/")) {
    return nextUrl;
  }

  const basePath = new URL(apiBaseUrl).pathname.replace(/\/$/, "");
  return `${basePath ? `${basePath}/` : "/"}${nextUrl}`;
}

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

function toGenreList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return toStringList(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }

  return [];
}

function resolveGenres(raw: Record<string, unknown>, nestedMovie: Record<string, unknown> | null): string[] {
  const candidates = [raw.genre, nestedMovie?.genre, raw.genres, nestedMovie?.genres];
  let bestGenres: string[] = [];
  let bestScore = 0;

  for (const candidate of candidates) {
    const parsedGenres = toGenreList(candidate);
    if (!parsedGenres.length) continue;

    const score = parsedGenres.join(", ").length;
    if (score > bestScore) {
      bestGenres = parsedGenres;
      bestScore = score;
    }
  }

  return bestGenres;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function parseTopUser(raw: Record<string, unknown>): MovieTopUser | null {
  const nestedTopUser = toRecord(pickFirst(raw.top_user, raw.topUser, raw.recommended_by));

  const name = toStringOrNull(
    pickFirst(
      nestedTopUser?.name,
      nestedTopUser?.username,
      raw.top_user_name,
      raw.topUserName,
      raw.recommended_by_name,
    ),
  );

  const avatarUrl = toStringOrNull(
    pickFirst(
      nestedTopUser?.avatar,
      nestedTopUser?.avatar_url,
      nestedTopUser?.profile_image,
      raw.top_user_avatar,
      raw.topUserAvatar,
      raw.recommended_by_avatar,
    ),
  );

  if (!name && !avatarUrl) return null;

  return { name, avatarUrl };
}

function pickFirst<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function normalizeContentType(value: unknown): string {
  if (typeof value !== "string") return "Desconocido";

  const normalized = value.trim();
  if (!normalized) return "Desconocido";

  const lower = normalized.toLowerCase();
  if (lower === "movie") return "Movie";
  if (lower === "tvseries" || lower === "series") return "Series";

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeMovie(raw: Record<string, unknown>, index: number): Movie {
  const nestedMovie = toRecord(raw.movie);
  const genres = resolveGenres(raw, nestedMovie);

  const title = String(
    pickFirst(
      raw.title_english,
      raw.title_spanish,
      raw.title,
      nestedMovie?.title_english,
      nestedMovie?.title_spanish,
      nestedMovie?.title,
      raw.name,
      nestedMovie?.name,
      "Sin título",
    ),
  );
  const id = pickFirst(raw.movie_id, nestedMovie?.id, raw.id, `${title}-${index + 1}`) as number | string;

  const yearValue = pickFirst(raw.release_year, raw.year, nestedMovie?.release_year, nestedMovie?.year, raw.release_date);
  const year = typeof yearValue === "string" ? yearValue.slice(0, 4) : String(yearValue ?? "-");
  const contentType = pickFirst(raw.type, nestedMovie?.type);

  return {
    id,
    title,
    contentType: normalizeContentType(contentType),
    year,
    genres,
    posterUrl:
      (pickFirst(
        raw.image,
        raw.poster,
        raw.poster_url,
        nestedMovie?.image,
        nestedMovie?.poster,
        nestedMovie?.poster_url,
        raw.image_url,
      ) as string | null) || null,
    displayRating: toNumber(pickFirst(raw.display_rating, raw.general_rating, raw.avg_rating, raw.rating)),
    myRating: toNumber(raw.my_rating),
    followingAvgRating: toNumber(pickFirst(raw.following_avg_rating, raw.following_rating)),
    topUser: parseTopUser(raw),
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

export function parseMoviePagination(payload: unknown): MoviePaginationMeta {
  if (isRecord(payload)) {
    return {
      count: typeof payload.count === "number" ? payload.count : null,
      next: typeof payload.next === "string" ? payload.next : null,
      previous: typeof payload.previous === "string" ? payload.previous : null,
    };
  }

  return {
    count: null,
    next: null,
    previous: null,
  };
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
