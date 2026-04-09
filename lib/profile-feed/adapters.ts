import { ApiError, apiFetch } from "../api";
import { normalizeMovie, parseMovieList } from "../movies";
import { favoriteMoviesMock, followingMock, friendsMock, socialActivityMock } from "./mocks";
import {
  FavoriteMovie,
  PaginatedSocialActivity,
  SocialActivityItem,
  SocialTab,
  SocialUser,
  FavoriteMovieSearchResult,
} from "./types";

const PAGE_SIZE_DEFAULT = 6;
const PROFILE_FAVORITES_ENDPOINT = "/profile/favorites/";

function sortUsersByFollowersDesc(users: SocialUser[]): SocialUser[] {
  return [...users].sort((a, b) => b.followersCount - a.followersCount);
}

function sortActivityByFollowersAndRecency(items: SocialActivityItem[]): SocialActivityItem[] {
  return [...items].sort((a, b) => {
    if (b.user.followersCount !== a.user.followersCount) {
      return b.user.followersCount - a.user.followersCount;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function withArtificialDelay<T>(payload: T, delayMs = 240): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(payload), delayMs);
  });
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function pickFirst<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }

  return null;
}

function extractMovieInfo(rawFavorite: Record<string, unknown>): FavoriteMovie {
  const nestedMovie = toRecord(rawFavorite.movie) ?? rawFavorite;
  const slot = toNumberOrNull(pickFirst(rawFavorite.slot, rawFavorite.position, rawFavorite.index, nestedMovie.slot)) ?? 1;
  const id = pickFirst(nestedMovie.id, nestedMovie.movie_id, rawFavorite.movie_id, `slot-${slot}`);

  const titleSpanish = typeof nestedMovie.title_spanish === "string" ? nestedMovie.title_spanish : null;
  const titleEnglish = typeof nestedMovie.title_english === "string" ? nestedMovie.title_english : null;
  const fallbackTitle = typeof nestedMovie.title === "string" ? nestedMovie.title : null;
  const title = titleSpanish || titleEnglish || fallbackTitle || "Sin título";

  const yearCandidate = pickFirst(nestedMovie.release_year, nestedMovie.year, nestedMovie.release_date);
  const year = typeof yearCandidate === "string" ? yearCandidate.slice(0, 4) : toNumberOrNull(yearCandidate)?.toString() || "-";

  const genreValue = pickFirst(nestedMovie.genre, nestedMovie.genres, rawFavorite.genre);
  const genre =
    Array.isArray(genreValue) && genreValue.length > 0
      ? String(genreValue[0])
      : typeof genreValue === "string"
        ? genreValue
        : "-";

  const typeValue = pickFirst(nestedMovie.type, nestedMovie.content_type, rawFavorite.type);
  const type = typeof typeValue === "string" && typeValue.trim() !== "" ? typeValue : "-";

  return {
    id: String(id),
    slot,
    title,
    titleSpanish,
    titleEnglish,
    year,
    genre,
    type,
    posterUrl:
      (pickFirst(
        nestedMovie.image,
        nestedMovie.poster,
        nestedMovie.poster_url,
        nestedMovie.image_url,
        rawFavorite.poster_url,
      ) as string | null) || null,
    generalRating: toNumberOrNull(pickFirst(nestedMovie.display_rating, nestedMovie.general_rating, rawFavorite.general_rating)),
    followingRating: toNumberOrNull(
      pickFirst(nestedMovie.following_avg_rating, nestedMovie.following_rating, rawFavorite.following_rating),
    ),
    myRating: toNumberOrNull(pickFirst(nestedMovie.my_rating, rawFavorite.my_rating)),
  };
}

function parseFavorites(payload: unknown): FavoriteMovie[] {
  const asRecord = toRecord(payload);
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(asRecord?.results)
      ? asRecord.results
      : Array.isArray(asRecord?.items)
        ? asRecord.items
        : [];

  return source
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => extractMovieInfo(item));
}

export async function getFavoriteMovies(): Promise<FavoriteMovie[]> {
  try {
    const payload = await apiFetch(PROFILE_FAVORITES_ENDPOINT);
    return parseFavorites(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status >= 500) {
      return withArtificialDelay([...favoriteMoviesMock]);
    }

    throw error;
  }
}

export async function setFavoriteMovie(slot: number, movieId: string | number): Promise<void> {
  await apiFetch(`${PROFILE_FAVORITES_ENDPOINT}${slot}/`, {
    method: "PUT",
    body: JSON.stringify({ movie_id: movieId }),
  });
}

export async function removeFavoriteMovie(slot: number): Promise<void> {
  await apiFetch(`${PROFILE_FAVORITES_ENDPOINT}${slot}/`, {
    method: "DELETE",
  });
}

export async function searchFavoriteMovieCandidates(query: string): Promise<FavoriteMovieSearchResult[]> {
  const endpoint = `/movies/?${new URLSearchParams({ search: query.trim(), page: "1" }).toString()}`;
  const payload = await apiFetch(endpoint);
  const movies = parseMovieList(payload);

  return movies.map((movie, index) => {
    const normalized = normalizeMovie(
      {
        id: movie.id,
        title: movie.title,
        year: movie.year,
        type: movie.contentType,
        genre: movie.genres,
        display_rating: movie.displayRating,
        following_avg_rating: movie.followingAvgRating,
        my_rating: movie.myRating,
      },
      index,
    );

    return {
      id: String(normalized.id),
      title: normalized.title,
      year: normalized.year,
      genre: normalized.genres[0] || "-",
      type: normalized.contentType,
      generalRating: normalized.displayRating,
      followingRating: normalized.followingAvgRating,
      myRating: normalized.myRating,
    };
  });
}

export async function getTopFriends(limit = 5): Promise<SocialUser[]> {
  return withArtificialDelay(sortUsersByFollowersDesc(friendsMock).slice(0, limit));
}

export async function getTopFollowing(limit = 5): Promise<SocialUser[]> {
  return withArtificialDelay(sortUsersByFollowersDesc(followingMock).slice(0, limit));
}

export async function getSocialActivity(
  tab: SocialTab,
  page = 1,
  pageSize = PAGE_SIZE_DEFAULT,
): Promise<PaginatedSocialActivity> {
  const sorted = sortActivityByFollowersAndRecency(socialActivityMock.filter((item) => item.tab === tab));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = sorted.slice(start, end);

  return withArtificialDelay({
    items,
    nextPage: end < sorted.length ? page + 1 : null,
  });
}
