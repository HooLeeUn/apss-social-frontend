import { ApiError, apiFetch } from "../api";
import { normalizeMovie, parseMovieList } from "../movies";
import { favoriteMoviesMock } from "./mocks";
import {
  FavoriteMovie,
  PaginatedSocialActivity,
  ProfileFeedActivityResponseItem,
  SocialActivityItem,
  SocialActivityScope,
  SocialUser,
  FavoriteMovieSearchResult,
} from "./types";

const PROFILE_FAVORITES_ENDPOINT = "/profile/favorites/";
const PROFILE_FEED_ACTIVITY_ENDPOINT = process.env.NEXT_PUBLIC_PROFILE_FEED_ACTIVITY_ENDPOINT || "/profile-feed/activity/";
const PROFILE_FEED_MY_ACTIVITY_SCOPE = process.env.NEXT_PUBLIC_PROFILE_FEED_MY_ACTIVITY_SCOPE || "me";
const PROFILE_ME_ENDPOINT = process.env.NEXT_PUBLIC_PROFILE_ME_ENDPOINT || "/me/";
const PROFILE_ME_FOLLOWING_ENDPOINT = process.env.NEXT_PUBLIC_PROFILE_ME_FOLLOWING_ENDPOINT || "/me/following/";
const PROFILE_LEGACY_ME_FOLLOWING_ENDPOINT = "/users/me/following/";
const PROFILE_USER_FOLLOWING_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_PROFILE_USER_FOLLOWING_ENDPOINT_TEMPLATE || "/users/{username}/following/";
const PROFILE_FRIENDS_ENDPOINT = process.env.NEXT_PUBLIC_SOCIAL_FRIENDS_ENDPOINT || "/social/friends/";

function sortUsersByFollowersDesc(users: SocialUser[]): SocialUser[] {
  return [...users].sort((a, b) => (b.followersCount ?? 0) - (a.followersCount ?? 0));
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

function safeTrim(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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
  return safeTrim(value);
}

function resolveFollowersCount(candidate: Record<string, unknown>): number | null {
  const stats = toRecord(candidate.stats);
  const socialStats = toRecord(candidate.social_stats);
  const profile = toRecord(candidate.profile);

  const value = toNumberOrNull(
    pickFirst(
      candidate.followers_count,
      candidate.followersCount,
      candidate.follower_count,
      candidate.followers,
      stats?.followers_count,
      stats?.followersCount,
      socialStats?.followers_count,
      socialStats?.followersCount,
      profile?.followers_count,
      profile?.followersCount,
    ),
  );

  return value === null ? null : toNonNegativeInteger(value);
}

function getMovieFallbackTitle(movie: ProfileFeedActivityResponseItem["movie"]): string | null {
  if (!("title" in movie)) return null;
  return toStringOrNull(movie.title);
}

function getDisplayMovieTitle(movie: ProfileFeedActivityResponseItem["movie"]): string {
  return toStringOrNull(movie.title_spanish) || toStringOrNull(movie.title_english) || getMovieFallbackTitle(movie) || "Título";
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
      displayName: toStringOrNull(item.actor.display_name),
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
  const mapped = results
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => toActivityItem(item as unknown as ProfileFeedActivityResponseItem));

  return {
    items: mapped.sort((left, right) => {
      const leftTs = new Date(left.createdAt).getTime();
      const rightTs = new Date(right.createdAt).getTime();
      if (Number.isNaN(leftTs) || Number.isNaN(rightTs)) return 0;
      return rightTs - leftTs;
    }),
    next: typeof root?.next === "string" ? root.next : null,
  };
}

function resolveScope(scope: SocialActivityScope): string {
  if (scope === "me") return PROFILE_FEED_MY_ACTIVITY_SCOPE;
  return scope;
}

function buildActivityScopeEndpoint(scope: SocialActivityScope): string {
  if (scope === "me") return PROFILE_FEED_ACTIVITY_ENDPOINT;

  const params = new URLSearchParams({ scope: resolveScope(scope) });
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

export async function getTopFriends(): Promise<SocialUser[]> {
  const payload = await apiFetch(PROFILE_FRIENDS_ENDPOINT);
  const friends = parseAcceptedFriends(payload);
  return sortUsersByFollowersDesc(friends);
}

export async function getTopFollowing(): Promise<SocialUser[]> {
  const results = await tryFollowingEndpoints();
  return sortUsersByFollowersDesc(results);
}

function getCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const root = toRecord(payload);
  if (!root) return [];

  if (Array.isArray(root.results)) return root.results;
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.following)) return root.following;
  if (Array.isArray(root.users)) return root.users;
  if (Array.isArray(root.friends)) return root.friends;

  const data = toRecord(root.data);
  if (!data) return [];
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.following)) return data.following;
  if (Array.isArray(data.users)) return data.users;
  if (Array.isArray(data.friends)) return data.friends;

  return [];
}

function getAcceptedFriendships(payload: unknown): Record<string, unknown>[] {
  return getCollection(payload)
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((entry) => isAcceptedFriendship(entry));
}

function extractFriendCandidateUser(friendship: Record<string, unknown>): Record<string, unknown> {
  return (
    toRecord(friendship.friend) ||
    toRecord(friendship.other_user) ||
    toRecord(friendship.receiver) ||
    toRecord(friendship.sender) ||
    toRecord(friendship.requester) ||
    toRecord(friendship.addressee) ||
    toRecord(friendship.from_user) ||
    toRecord(friendship.to_user) ||
    toRecord(friendship.user) ||
    toRecord(friendship.profile) ||
    friendship
  );
}

function parseAcceptedFriends(payload: unknown): SocialUser[] {
  const acceptedFriendships = getAcceptedFriendships(payload);
  return acceptedFriendships
    .map((friendship, index): SocialUser | null => {
      const user = extractFriendCandidateUser(friendship);
      const username = safeTrim(pickFirst(user.username, user.name, user.user_name));
      if (!username) return null;

      return {
        id: String(pickFirst(user.id, user.user_id, friendship.id, `friend-${index + 1}`)),
        username,
        displayName: safeTrim(pickFirst(user.display_name, user.displayName, user.full_name)) ?? null,
        avatarUrl: safeTrim(pickFirst(user.avatar, user.avatar_url, user.profile_image, user.photo_url)) ?? null,
        followersCount: resolveFollowersCount({ ...friendship, ...user }),
      };
    })
    .filter(isNonNullSocialUser);
}

function isAcceptedFriendship(entry: Record<string, unknown>): boolean {
  const status = safeTrim(pickFirst(entry.status, entry.friendship_status, entry.request_status, entry.state))?.toLowerCase();
  if (!status) return true;
  return ["accepted", "accept", "friends", "friend", "active"].includes(status);
}

function parseFollowingUsers(payload: unknown): SocialUser[] {
  return getCollection(payload)
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((entry, index): SocialUser | null => {
      const directUsername = safeTrim(entry.username);
      if (directUsername) {
        return {
          id: String(pickFirst(entry.id, entry.user_id, `following-${index + 1}`)),
          username: directUsername,
          displayName: safeTrim(pickFirst(entry.display_name, entry.displayName)) ?? null,
          avatarUrl: safeTrim(pickFirst(entry.avatar_url, entry.avatar, entry.profile_image, entry.photo_url)) ?? null,
          followersCount: resolveFollowersCount(entry),
        };
      }

      const user =
        toRecord(entry.following) ||
        toRecord(entry.followed) ||
        toRecord(entry.followed_user) ||
        toRecord(entry.target_user) ||
        toRecord(entry.user) ||
        entry;

      const username = safeTrim(user.username);
      if (!username) return null;

      return {
        id: String(pickFirst(user.id, user.user_id, entry.id, `following-${index + 1}`)),
        username,
        displayName: safeTrim(pickFirst(user.display_name, user.displayName)) ?? null,
        avatarUrl: safeTrim(pickFirst(user.avatar, user.avatar_url, user.profile_image, user.photo_url)) ?? null,
        followersCount: resolveFollowersCount({ ...entry, ...user }),
      };
    })
    .filter(isNonNullSocialUser);
}

function isNonNullSocialUser(user: SocialUser | null): user is SocialUser {
  return user !== null;
}

function buildUserFollowingEndpoint(username: string): string {
  return PROFILE_USER_FOLLOWING_ENDPOINT_TEMPLATE.replace("{username}", encodeURIComponent(username));
}

function logFollowingDebug(label: string, value: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(label, value);
}

async function getMyUsername(): Promise<string | null> {
  const payload = await apiFetch(PROFILE_ME_ENDPOINT);
  const me = toRecord(payload);
  return safeTrim(pickFirst(me?.username, me?.user_name, me?.name));
}

async function tryFollowingEndpoints(): Promise<SocialUser[]> {
  const fetchFollowingFromEndpoint = async (endpoint: string): Promise<SocialUser[]> => {
    const payload = await apiFetch(endpoint);
    const parsed = parseFollowingUsers(payload);
    logFollowingDebug("FOLLOWING ENDPOINT USED:", endpoint);
    logFollowingDebug("FOLLOWING RAW PAYLOAD:", payload);
    logFollowingDebug("FOLLOWING PARSED USERS:", parsed);
    return parsed;
  };

  try {
    return await fetchFollowingFromEndpoint(PROFILE_ME_FOLLOWING_ENDPOINT);
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 405, 422].includes(error.status)) throw error;
  }

  try {
    return await fetchFollowingFromEndpoint(PROFILE_LEGACY_ME_FOLLOWING_ENDPOINT);
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 405, 422].includes(error.status)) throw error;
  }

  try {
    const username = await getMyUsername();
    if (!username) return [];
    return await fetchFollowingFromEndpoint(buildUserFollowingEndpoint(username));
  } catch (error) {
    if (error instanceof ApiError && [404, 405, 422].includes(error.status)) return [];
    throw error;
  }
}

export async function getSocialActivity(
  tab: SocialActivityScope,
  nextEndpoint: string | null = null,
  signal?: AbortSignal,
): Promise<PaginatedSocialActivity> {
  const endpoint = nextEndpoint || buildActivityScopeEndpoint(tab);
  let payload: unknown;

  try {
    payload = await apiFetch(endpoint, { signal });
  } catch (error) {
    const myActivityScope = resolveScope(tab);
    const isMyActivity = myActivityScope === PROFILE_FEED_MY_ACTIVITY_SCOPE;
    if (isMyActivity && error instanceof ApiError && [400, 404, 422].includes(error.status)) {
      return { items: [], next: null };
    }
    throw error;
  }
  const parsed = parseSocialActivity(payload);

  return {
    items: parsed.items,
    next: parsed.next ? normalizeActivityNextEndpoint(parsed.next) : null,
  };
}
