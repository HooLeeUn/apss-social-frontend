import { ApiError, apiFetch } from "../api";
import { normalizeMovie, parseMovieList } from "../movies";
import { favoriteMoviesMock, followingMock, friendsMock } from "./mocks";
import {
  FavoriteMovie,
  PaginatedSocialActivity,
  ProfileFeedActivityResponseItem,
  SocialActivityItem,
  SocialTab,
  SocialUser,
  FavoriteMovieSearchResult,
} from "./types";

const PROFILE_FAVORITES_ENDPOINT = "/profile/favorites/";
const PROFILE_FEED_ACTIVITY_ENDPOINT = process.env.NEXT_PUBLIC_PROFILE_FEED_ACTIVITY_ENDPOINT || "/profile-feed/activity/";

function sortUsersByFollowersDesc(users: SocialUser[]): SocialUser[] {
  return [...users].sort((a, b) => b.followersCount - a.followersCount);
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

function toNonNegativeInteger(value: unknown): number {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return 0;

  const normalized = Math.round(numeric);
  return normalized > 0 ? normalized : 0;
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
    followingRatingsCount: toNonNegativeInteger(
      pickFirst(nestedMovie.following_ratings_count, nestedMovie.following_rating_count, rawFavorite.following_ratings_count),
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

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function getDisplayMovieTitle(movie: ProfileFeedActivityResponseItem["movie"]): string {
  return toStringOrNull(movie.title_spanish) || toStringOrNull(movie.title_english) || toStringOrNull((movie as Record<string, unknown>).title) || "Sin título";
}

function toActivityItem(item: ProfileFeedActivityResponseItem): SocialActivityItem {
  const payload = toRecord(item.payload) ?? {};
  const movie = toRecord(item.movie) ?? {};
  const score = toNumberOrNull(payload.score);
  const commentText = toStringOrNull(pickFirst(payload.content, payload.text));
  const likedCommentSnippet = toStringOrNull(payload.comment_excerpt);
  const likedCommentAuthor = toRecord(payload.comment_author);
  const likedCommentAuthorUsername = toStringOrNull(likedCommentAuthor?.username);

  const movieType = toStringOrNull(movie.type);
  const movieGenre = toStringOrNull(movie.genre) || undefined;
  const generalRating = toNumberOrNull(movie.display_rating);
  const followingRating = toNumberOrNull(pickFirst(movie.following_avg_rating, movie.following_rating));
  const followingRatingsCount = toNonNegativeInteger(pickFirst(movie.following_ratings_count, movie.following_rating_count));
  const myRating = toNumberOrNull(movie.my_rating);

  return {
    id: item.id,
    user: {
      id: String(item.actor.id),
      username: item.actor.username,
      avatarUrl: item.actor.avatar,
      followersCount: 0,
    },
    userDisplayName: toStringOrNull(item.actor.display_name),
    movieTitle: getDisplayMovieTitle(item.movie),
    movieYear: item.movie.release_year,
    movieId: item.movie.id,
    moviePosterUrl: (pickFirst(movie.image, movie.poster, movie.poster_url, movie.image_url) as string | null) ?? null,
    movieType: movieType ?? undefined,
    movieGenre,
    generalRating: generalRating ?? undefined,
    followingRating: followingRating ?? undefined,
    followingRatingsCount: followingRatingsCount > 0 ? followingRatingsCount : undefined,
    myRating: myRating ?? undefined,
    createdAt: item.created_at,
    interactionType:
      item.activity_type === "rating"
        ? "rating"
        : item.activity_type === "public_comment"
          ? "comment"
          : item.activity_type === "public_comment_dislike"
            ? "dislike"
            : "like",
    ratingValue: score ?? undefined,
    commentText: commentText ?? undefined,
    likedCommentSnippet: likedCommentSnippet ?? undefined,
    likedCommentAuthorUsername: likedCommentAuthorUsername ?? undefined,
  };
}

function parseSocialActivity(payload: unknown): PaginatedSocialActivity {
  const root = toRecord(payload);
  const results = Array.isArray(root?.results) ? root.results : [];

  return {
    items: results
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => toActivityItem(item as unknown as ProfileFeedActivityResponseItem)),
    next: typeof root?.next === "string" ? root.next : null,
  };
}

function buildActivityScopeEndpoint(scope: SocialTab): string {
  const params = new URLSearchParams({ scope });
  return `${PROFILE_FEED_ACTIVITY_ENDPOINT}?${params.toString()}`;
}

function normalizeActivityNextEndpoint(next: string): string {
  if (next.startsWith("http://") || next.startsWith("https://")) {
    const { pathname, search } = new URL(next);
    const normalizedPath = pathname.startsWith("/api/") ? pathname.replace(/^\/api/, "") : pathname;
    return `${normalizedPath}${search}`;
  }

  if (next.startsWith("/api/")) {
    return next.replace(/^\/api/, "");
  }

  return next;
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

export async function rateFavoriteMovie(movieId: string | number, score: number): Promise<unknown> {
  return apiFetch(`/movies/${encodeURIComponent(String(movieId))}/rating/`, {
    method: "PUT",
    body: JSON.stringify({ score }),
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
        following_ratings_count: movie.followingRatingsCount,
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
      followingRatingsCount: normalized.followingRatingsCount,
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
  nextEndpoint: string | null = null,
  signal?: AbortSignal,
): Promise<PaginatedSocialActivity> {
  const endpoint = nextEndpoint || buildActivityScopeEndpoint(tab);
  const payload = await apiFetch(endpoint, { signal });
  const parsed = parseSocialActivity(payload);

  return {
    items: parsed.items,
    next: parsed.next ? normalizeActivityNextEndpoint(parsed.next) : null,
  };
}
