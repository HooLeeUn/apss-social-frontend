import { API_BASE_URL, ApiError, apiFetch } from "./api";

export interface MovieTopUser {
  id: number | null;
  username: string | null;
  avatar: string | null;
  followersCount: number;
}

export interface Movie {
  id: number | string;
  title: string;
  displayTitle: string;
  displaySecondaryTitle: string | null;
  titleEnglish: string | null;
  titleSpanish: string | null;
  contentType: string;
  tmdbId: number | string | null;
  tmdbUrl: string | null;
  year: string;
  genres: string[];
  director: string | null;
  castMembers: string[];
  posterUrl: string | null;
  image?: string | null;
  synopsis?: string | null;
  synopsis_es?: string | null;
  displayRating: number | null;
  myRating: number | null;
  followingAvgRating: number | null;
  followingRatingsCount: number;
  topUser: MovieTopUser | null;
  isInMyList: boolean;
  isInMyRecommendations: boolean;
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
export const MY_MOVIE_LIST_ENDPOINT = process.env.NEXT_PUBLIC_MY_MOVIE_LIST_ENDPOINT || "/me/movie-list/";
export const MY_MOVIE_RECOMMENDATIONS_ENDPOINT = process.env.NEXT_PUBLIC_MY_MOVIE_RECOMMENDATIONS_ENDPOINT || "/me/movie-recommendations/";

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


function toNonNegativeInteger(value: unknown): number {
  const numeric = toNumber(value);
  if (numeric === null) return 0;

  const normalized = Math.round(numeric);
  return normalized > 0 ? normalized : 0;
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

function pickFirstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = toStringOrNull(value);
    if (normalized) return normalized;
  }

  return null;
}

export interface MovieTitleSource {
  title_spanish?: unknown;
  title_english?: unknown;
  title?: unknown;
  name?: unknown;
}

export function resolveMovieDisplayTitle(movie: MovieTitleSource, nestedMovie?: MovieTitleSource | null): string {
  return (
    pickFirstNonEmptyString(
      movie.title_spanish,
      nestedMovie?.title_spanish,
      movie.title_english,
      nestedMovie?.title_english,
      movie.title,
      nestedMovie?.title,
      movie.name,
      nestedMovie?.name,
    ) || "Sin título"
  );
}

export function resolveMovieSecondaryTitle(
  displayTitle: string,
  movie: MovieTitleSource,
  nestedMovie?: MovieTitleSource | null,
): string | null {
  const titleEnglish = pickFirstNonEmptyString(movie.title_english, nestedMovie?.title_english);
  if (!titleEnglish) return null;

  return titleEnglish.localeCompare(displayTitle, "es", { sensitivity: "accent" }) === 0 ? null : titleEnglish;
}

function resolveBackendAssetUrl(value: unknown): string | null {
  const candidate = toStringOrNull(value);
  if (!candidate) return null;

  if (
    candidate.startsWith("http://") ||
    candidate.startsWith("https://") ||
    candidate.startsWith("data:") ||
    candidate.startsWith("blob:")
  ) {
    return candidate;
  }

  const normalizedCandidate = candidate.startsWith("media/") ? `/${candidate}` : candidate;

  try {
    return new URL(normalizedCandidate, API_BASE_URL).toString();
  } catch {
    return candidate;
  }
}

function parseTopUser(raw: Record<string, unknown>): MovieTopUser | null {
  const nestedTopUser = toRecord(pickFirst(raw.top_user, raw.topUser, raw.recommended_by));

  const id = toNumber(
    pickFirst(
      nestedTopUser?.id,
      nestedTopUser?.user_id,
      raw.top_user_id,
      raw.topUserId,
      raw.recommended_by_id,
    ),
  );

  const username = toStringOrNull(
    pickFirst(
      nestedTopUser?.username,
      nestedTopUser?.name,
      raw.top_user_username,
      raw.topUserUsername,
      raw.top_user_name,
      raw.topUserName,
      raw.recommended_by_name,
    ),
  );

  const avatar = resolveBackendAssetUrl(
    pickFirst(
      nestedTopUser?.avatar,
      nestedTopUser?.avatar_url,
      nestedTopUser?.profile_image,
      raw.top_user_avatar_url,
      raw.top_user_avatar,
      raw.topUserAvatar,
      raw.recommended_by_avatar,
    ),
  );

  const followersCount = toNonNegativeInteger(
    pickFirst(
      nestedTopUser?.followers_count,
      nestedTopUser?.followersCount,
      raw.top_user_followers_count,
      raw.topUserFollowersCount,
    ),
  );

  if (id === null && !username && !avatar && followersCount === 0) return null;

  return { id, username, avatar, followersCount };
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
  const debugTitleEnglish = pickFirstNonEmptyString(raw.title_english, nestedMovie?.title_english);
  const debugTitleSpanish = pickFirstNonEmptyString(raw.title_spanish, nestedMovie?.title_spanish);
  const isBeautifulMind =
    [debugTitleEnglish, debugTitleSpanish]
      .filter((value): value is string => Boolean(value))
      .some((value) => {
        const normalized = value.toLowerCase();
        return normalized.includes("a beautiful mind") || normalized.includes("una mente brillante");
      });

  if (process.env.NODE_ENV === "development" && isBeautifulMind) {
    console.log("[WeeklyRecommendations][raw]", {
      title_english: debugTitleEnglish,
      title_spanish: debugTitleSpanish,
      synopsis: pickFirstNonEmptyString(raw.synopsis, nestedMovie?.synopsis),
      synopsis_es: pickFirstNonEmptyString(raw.synopsis_es, nestedMovie?.synopsis_es),
    });
  }

  const genres = resolveGenres(raw, nestedMovie);
  const titleSpanish = pickFirstNonEmptyString(raw.title_spanish, nestedMovie?.title_spanish);
  const titleEnglish = pickFirstNonEmptyString(raw.title_english, nestedMovie?.title_english);
  const displayTitle = resolveMovieDisplayTitle(raw, nestedMovie);
  const displaySecondaryTitle = resolveMovieSecondaryTitle(displayTitle, raw, nestedMovie);
  const title = displayTitle;
  const id = pickFirst(raw.movie_id, nestedMovie?.id, raw.id, `${title}-${index + 1}`) as number | string;

  const yearValue = pickFirst(raw.release_year, raw.year, nestedMovie?.release_year, nestedMovie?.year, raw.release_date);
  const year = typeof yearValue === "string" ? yearValue.slice(0, 4) : String(yearValue ?? "-");
  const contentType = pickFirst(raw.type, nestedMovie?.type);
  const tmdbId = pickFirst(raw.tmdb_id, nestedMovie?.tmdb_id, raw.tmdbId, nestedMovie?.tmdbId);
  const tmdbUrl = pickFirstNonEmptyString(raw.tmdb_url, nestedMovie?.tmdb_url, raw.tmdbUrl, nestedMovie?.tmdbUrl);
  const director = pickFirstNonEmptyString(raw.director, nestedMovie?.director, raw.director_name, nestedMovie?.director_name);
  const castMembers = toStringList(pickFirst(raw.cast_members, nestedMovie?.cast_members, raw.cast, nestedMovie?.cast));
  const synopsis = pickFirstNonEmptyString(
    raw.synopsis_en,
    nestedMovie?.synopsis_en,
    raw.synopsis_english,
    nestedMovie?.synopsis_english,
    raw.overview_en,
    nestedMovie?.overview_en,
    raw.overview_english,
    nestedMovie?.overview_english,
    raw.synopsis,
    nestedMovie?.synopsis,
    raw.overview,
    nestedMovie?.overview,
  );
  const synopsis_es = pickFirstNonEmptyString(
    raw.synopsis_es,
    nestedMovie?.synopsis_es,
    raw.synopsis_spanish,
    nestedMovie?.synopsis_spanish,
    raw.overview_es,
    nestedMovie?.overview_es,
    raw.overview_spanish,
    nestedMovie?.overview_spanish,
    raw.overview,
    nestedMovie?.overview,
  );

  if (process.env.NODE_ENV === "development" && isBeautifulMind) {
    console.log("[WeeklyRecommendations][normalized]", {
      synopsis,
      synopsis_es,
    });
  }

  return {
    id,
    title,
    displayTitle,
    displaySecondaryTitle,
    titleEnglish,
    titleSpanish,
    contentType: normalizeContentType(contentType),
    tmdbId: typeof tmdbId === "number" || typeof tmdbId === "string" ? tmdbId : null,
    tmdbUrl,
    year,
    genres,
    director,
    castMembers,
    posterUrl:
      resolveBackendAssetUrl(
        pickFirst(
          raw.image,
          raw.poster,
          raw.poster_url,
          nestedMovie?.image,
          nestedMovie?.poster,
          nestedMovie?.poster_url,
          raw.image_url,
        ),
      ),
    image:
      resolveBackendAssetUrl(
        pickFirst(
          raw.image,
          nestedMovie?.image,
          raw.image_url,
        ),
      ),
    synopsis,
    synopsis_es,
    displayRating: toNumber(pickFirst(raw.display_rating, raw.general_rating, raw.avg_rating, raw.rating)),
    myRating: toNumber(raw.my_rating),
    followingAvgRating: toNumber(pickFirst(raw.following_avg_rating, raw.following_rating)),
    followingRatingsCount: toNonNegativeInteger(
      pickFirst(
        raw.following_ratings_count,
        nestedMovie?.following_ratings_count,
        raw.following_rating_count,
        nestedMovie?.following_rating_count,
        raw.following_count,
      ),
    ),
    topUser: parseTopUser(raw),
    isInMyList: Boolean(pickFirst(raw.is_in_my_list, nestedMovie?.is_in_my_list, raw.isInMyList, nestedMovie?.isInMyList)),
    isInMyRecommendations: Boolean(pickFirst(raw.is_in_my_recommendations, nestedMovie?.is_in_my_recommendations, raw.isInMyRecommendations, nestedMovie?.isInMyRecommendations)),
  };
}

export async function getMovieDetailById(movieId: Movie["id"]): Promise<Movie | null> {
  const normalizedMovieId = String(movieId).trim();
  if (!normalizedMovieId) return null;

  const movieEndpoints = [
    buildMovieDetailEndpoint(normalizedMovieId, MOVIE_DETAIL_ENDPOINT_TEMPLATE),
    ...MOVIE_DETAIL_FALLBACK_ENDPOINT_TEMPLATES.map((template) => buildMovieDetailEndpoint(normalizedMovieId, template)),
  ];

  for (let index = 0; index < movieEndpoints.length; index += 1) {
    try {
      const payload = await apiFetch(movieEndpoints[index]);
      const rawMovie = toRecord(payload);
      return rawMovie ? normalizeMovie(rawMovie, 0) : null;
    } catch (error) {
      const canTryNextEndpoint = error instanceof ApiError && [404, 405].includes(error.status) && index < movieEndpoints.length - 1;
      if (!canTryNextEndpoint) throw error;
    }
  }

  return null;
}

export async function getMyMovieList(): Promise<Movie[]> {
  const payload = await apiFetch(MY_MOVIE_LIST_ENDPOINT);
  return parseMovieList(payload);
}

export async function getMyMovieRecommendations(): Promise<Movie[]> {
  const payload = await apiFetch(MY_MOVIE_RECOMMENDATIONS_ENDPOINT);
  return parseMovieList(payload);
}

export async function addMovieToMyRecommendations(movieId: Movie["id"]): Promise<void> {
  await apiFetch(`/movies/${encodeURIComponent(String(movieId))}/recommendation/`, { method: "POST" });
}

export async function removeMovieFromMyRecommendations(movieId: Movie["id"]): Promise<void> {
  await apiFetch(`/movies/${encodeURIComponent(String(movieId))}/recommendation/`, { method: "DELETE" });
}

export async function addMovieToMyList(movieId: Movie["id"]): Promise<void> {
  await apiFetch(`/movies/${encodeURIComponent(String(movieId))}/list/`, { method: "POST" });
}

export async function removeMovieFromMyList(movieId: Movie["id"]): Promise<void> {
  await apiFetch(`/movies/${encodeURIComponent(String(movieId))}/list/`, { method: "DELETE" });
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
