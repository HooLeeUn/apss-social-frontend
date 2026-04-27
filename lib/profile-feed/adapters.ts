import { ApiError, apiFetch } from "../api";
import { normalizeMovie, parseMovieList, resolveMovieDisplayTitle, resolveMovieSecondaryTitle } from "../movies";
import { favoriteMoviesMock } from "./mocks";
import {
  FavoriteMovie,
  PaginatedSocialActivity,
  ProfileFeedActivityResponseItem,
  PaginatedMyMessages,
  SocialActivityItem,
  SocialActivityScope,
  MyMessageItem,
  SocialUser,
  FavoriteMovieSearchResult,
  MyMessagesSummary,
  MyNotificationsSummary,
  MyNotificationItem,
  NotificationTargetTab,
} from "./types";

const PROFILE_FAVORITES_ENDPOINT = "/profile/favorites/";
const PROFILE_FEED_ACTIVITY_ENDPOINT = process.env.NEXT_PUBLIC_PROFILE_FEED_ACTIVITY_ENDPOINT || "/profile-feed/activity/";
const PROFILE_ME_ENDPOINT = process.env.NEXT_PUBLIC_PROFILE_ME_ENDPOINT || "/me/";
const PROFILE_USER_ENDPOINT_TEMPLATE = process.env.NEXT_PUBLIC_PROFILE_USER_ENDPOINT_TEMPLATE || "/users/{username}/";
const PROFILE_PUBLIC_USER_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_PROFILE_PUBLIC_USER_ENDPOINT_TEMPLATE || "/profile/{username}/";
const PROFILE_USER_FAVORITES_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_PROFILE_USER_FAVORITES_ENDPOINT_TEMPLATE || "/users/{username}/favorites/";
const PROFILE_USER_FRIENDS_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_PROFILE_USER_FRIENDS_ENDPOINT_TEMPLATE || "/users/{username}/friends/";
const PROFILE_SOCIAL_USER_FRIENDS_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_SOCIAL_USER_FRIENDS_ENDPOINT_TEMPLATE || "/social/friends/{username}/";
const PROFILE_ME_FOLLOWING_ENDPOINT = process.env.NEXT_PUBLIC_PROFILE_ME_FOLLOWING_ENDPOINT || "/me/following/";
const PROFILE_LEGACY_ME_FOLLOWING_ENDPOINT = "/users/me/following/";
const PROFILE_USER_FOLLOWING_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_PROFILE_USER_FOLLOWING_ENDPOINT_TEMPLATE || "/users/{username}/following/";
const PROFILE_FRIENDS_ENDPOINT = process.env.NEXT_PUBLIC_SOCIAL_FRIENDS_ENDPOINT || "/social/friends/";
const PROFILE_USER_ACTIVITY_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_PROFILE_USER_ACTIVITY_ENDPOINT_TEMPLATE || "/users/{username}/activity/";
const PROFILE_ME_MESSAGES_ENDPOINT = process.env.NEXT_PUBLIC_PROFILE_ME_MESSAGES_ENDPOINT || "/me/messages/";
const PROFILE_ME_MESSAGES_SUMMARY_ENDPOINT = process.env.NEXT_PUBLIC_PROFILE_ME_MESSAGES_SUMMARY_ENDPOINT || "/me/messages/summary/";
const PROFILE_ME_MESSAGES_MARK_AS_READ_ENDPOINT =
  process.env.NEXT_PUBLIC_PROFILE_ME_MESSAGES_MARK_AS_READ_ENDPOINT || "/me/messages/mark-as-read/";
const PROFILE_ME_NOTIFICATIONS_ENDPOINT = process.env.NEXT_PUBLIC_PROFILE_ME_NOTIFICATIONS_ENDPOINT || "/me/notifications/";
const PROFILE_ME_NOTIFICATIONS_MARK_AS_READ_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_PROFILE_ME_NOTIFICATIONS_MARK_AS_READ_ENDPOINT_TEMPLATE || "/me/notifications/{id}/mark-read/";
const PROFILE_ME_NOTIFICATIONS_MARK_AS_READ_BULK_ENDPOINT =
  process.env.NEXT_PUBLIC_PROFILE_ME_NOTIFICATIONS_MARK_AS_READ_BULK_ENDPOINT || "/me/notifications/mark-as-read/";

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

function isTrueValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLocaleLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "si" || normalized === "sí";
  }
  return false;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "si", "sí"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
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

function extractMovieInfo(rawFavorite: Record<string, unknown>, options?: { forVisitedProfile?: boolean }): FavoriteMovie {
  const nestedMovie = toRecord(rawFavorite.movie) ?? rawFavorite;
  const slot = toNumberOrNull(pickFirst(rawFavorite.slot, rawFavorite.position, rawFavorite.index, nestedMovie.slot)) ?? 1;
  const id = pickFirst(nestedMovie.id, nestedMovie.movie_id, rawFavorite.movie_id, `slot-${slot}`);

  const titleSpanish = typeof nestedMovie.title_spanish === "string" ? nestedMovie.title_spanish : null;
  const titleEnglish = typeof nestedMovie.title_english === "string" ? nestedMovie.title_english : null;
  const title = resolveMovieDisplayTitle(rawFavorite, nestedMovie);
  const displaySecondaryTitle = resolveMovieSecondaryTitle(title, rawFavorite, nestedMovie);

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

  const visitedOwnerRating = toNumberOrNull(
    pickFirst(
      nestedMovie.visited_owner_rating,
      nestedMovie.profile_owner_rating,
      nestedMovie.owner_rating,
      rawFavorite.visited_owner_rating,
      rawFavorite.profile_owner_rating,
      rawFavorite.owner_rating,
    ),
  );
  const visitedFollowingAvgRating = toNumberOrNull(
    pickFirst(
      nestedMovie.visited_following_avg_rating,
      nestedMovie.profile_following_avg_rating,
      nestedMovie.owner_following_avg_rating,
      rawFavorite.visited_following_avg_rating,
      rawFavorite.profile_following_avg_rating,
      rawFavorite.owner_following_avg_rating,
    ),
  );
  const visitedFollowingRatingsCount = toNonNegativeInteger(
    pickFirst(
      nestedMovie.visited_following_ratings_count,
      nestedMovie.profile_following_ratings_count,
      nestedMovie.owner_following_ratings_count,
      rawFavorite.visited_following_ratings_count,
      rawFavorite.profile_following_ratings_count,
      rawFavorite.owner_following_ratings_count,
    ),
  );
  const followingRatingDefault = toNumberOrNull(
    pickFirst(nestedMovie.following_avg_rating, nestedMovie.following_rating, rawFavorite.following_rating),
  );
  const followingRatingsCountDefault = toNonNegativeInteger(
    pickFirst(nestedMovie.following_ratings_count, nestedMovie.following_rating_count, rawFavorite.following_ratings_count),
  );
  const myRatingDefault = toNumberOrNull(pickFirst(nestedMovie.my_rating, rawFavorite.my_rating));
  const useVisitedPerspective = Boolean(options?.forVisitedProfile);

  return {
    id: String(id),
    slot,
    title,
    displaySecondaryTitle,
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
    followingRating: useVisitedPerspective ? (visitedFollowingAvgRating ?? followingRatingDefault) : followingRatingDefault,
    followingRatingsCount: useVisitedPerspective
      ? (visitedFollowingRatingsCount || followingRatingsCountDefault)
      : followingRatingsCountDefault,
    myRating: useVisitedPerspective ? (visitedOwnerRating ?? myRatingDefault) : myRatingDefault,
    visitedOwnerRating,
    visitedFollowingAvgRating,
    visitedFollowingRatingsCount,
  };
}

function parseFavorites(payload: unknown, options?: { forVisitedProfile?: boolean }): FavoriteMovie[] {
  const asRecord = toRecord(payload);
  const dataRecord = toRecord(asRecord?.data);
  const unwrapCollection = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;

    const record = toRecord(value);
    if (!record) return [];

    const nested =
      pickFirst(
        record.results,
        record.items,
        record.favorites,
        record.favorite_movies,
        record.top_favorites,
        record.top_movies,
      ) ?? null;

    if (Array.isArray(nested)) return nested;

    const nestedRecord = toRecord(nested);
    if (!nestedRecord) return [];

    return Object.values(nestedRecord).filter((item) => toRecord(item));
  };

  const source = unwrapCollection(
    pickFirst(
      payload,
      asRecord?.results,
      asRecord?.items,
      asRecord?.favorites,
      asRecord?.favorite_movies,
      asRecord?.top_favorites,
      asRecord?.top_movies,
      dataRecord?.results,
      dataRecord?.items,
      dataRecord?.favorites,
      dataRecord?.favorite_movies,
      dataRecord?.top_favorites,
      dataRecord?.top_movies,
    ),
  );

  return source
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => extractMovieInfo(item, options));
}

function toStringOrNull(value: unknown): string | null {
  return safeTrim(value);
}

function resolveFollowersCount(candidate: Record<string, unknown>): number | null {
  const stats = toRecord(candidate.stats);
  const socialStats = toRecord(candidate.social_stats);
  const profile = toRecord(candidate.profile);
  const nestedUser =
    toRecord(candidate.user) ||
    toRecord(candidate.following) ||
    toRecord(candidate.followed) ||
    toRecord(candidate.followed_user) ||
    toRecord(candidate.target_user);
  const nestedStats = toRecord(nestedUser?.stats);
  const nestedSocialStats = toRecord(nestedUser?.social_stats);
  const nestedProfile = toRecord(nestedUser?.profile);

  const value = toNumberOrNull(
    pickFirst(
      candidate.followers_count,
      candidate.followersCount,
      candidate.follower_count,
      candidate.followerCount,
      candidate.total_followers,
      candidate.totalFollowers,
      candidate.followers,
      stats?.followers_count,
      stats?.followersCount,
      stats?.follower_count,
      stats?.followerCount,
      socialStats?.followers_count,
      socialStats?.followersCount,
      socialStats?.follower_count,
      socialStats?.followerCount,
      profile?.followers_count,
      profile?.followersCount,
      profile?.follower_count,
      profile?.followerCount,
      nestedUser?.followers_count,
      nestedUser?.followersCount,
      nestedUser?.follower_count,
      nestedUser?.followerCount,
      nestedUser?.followers,
      nestedStats?.followers_count,
      nestedStats?.followersCount,
      nestedStats?.follower_count,
      nestedStats?.followerCount,
      nestedSocialStats?.followers_count,
      nestedSocialStats?.followersCount,
      nestedSocialStats?.follower_count,
      nestedSocialStats?.followerCount,
      nestedProfile?.followers_count,
      nestedProfile?.followersCount,
      nestedProfile?.follower_count,
      nestedProfile?.followerCount,
    ),
  );

  return value === null ? null : toNonNegativeInteger(value);
}

function getDisplayMovieTitle(movie: ProfileFeedActivityResponseItem["movie"]): string {
  return resolveMovieDisplayTitle(movie);
}

function getDisplayMovieSecondaryTitle(movie: ProfileFeedActivityResponseItem["movie"]): string | null {
  const displayTitle = getDisplayMovieTitle(movie);
  return resolveMovieSecondaryTitle(displayTitle, movie);
}

function toTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareByCreatedAtDesc(left: SocialActivityItem, right: SocialActivityItem): number {
  return toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
}

function pickMostRelevantReaction(current: SocialActivityItem, candidate: SocialActivityItem): SocialActivityItem {
  if (!current.reactionId && candidate.reactionId) return candidate;
  if (current.reactionId && !candidate.reactionId) return current;

  const currentTimestamp = toTimestamp(current.createdAt);
  const candidateTimestamp = toTimestamp(candidate.createdAt);
  if (currentTimestamp !== candidateTimestamp) {
    return candidateTimestamp > currentTimestamp ? candidate : current;
  }

  return String(candidate.id) > String(current.id) ? candidate : current;
}

function dedupeReactionItems(items: SocialActivityItem[]): SocialActivityItem[] {
  const dedupedByCommentAndActor = new Map<string, SocialActivityItem>();
  const passthrough: SocialActivityItem[] = [];

  for (const item of items) {
    const isReaction = item.interactionType === "like" || item.interactionType === "dislike";
    if (!isReaction || !item.commentId || !item.actorId) {
      passthrough.push(item);
      continue;
    }

    const dedupeKey = `${item.commentId}::${item.actorId}`;
    const current = dedupedByCommentAndActor.get(dedupeKey);
    if (!current) {
      dedupedByCommentAndActor.set(dedupeKey, item);
      continue;
    }

    dedupedByCommentAndActor.set(dedupeKey, pickMostRelevantReaction(current, item));
  }

  return [...passthrough, ...dedupedByCommentAndActor.values()].sort(compareByCreatedAtDesc);
}

function toActivityItem(item: ProfileFeedActivityResponseItem): SocialActivityItem {
  const activityRecord = item as unknown as Record<string, unknown>;
  const actor = toRecord(item.actor) ?? {};
  const payload = toRecord(item.payload) ?? {};
  const movie = toRecord(item.movie) ?? {};
  const normalizedActivityType =
    safeTrim(
      pickFirst(
        item.activity_type,
        activityRecord.activity_type,
        activityRecord.type,
      ),
    )?.toLocaleLowerCase() || "";
  const isPublicCommentType = normalizedActivityType === "public_comment";
  const isPublicReactionType =
    normalizedActivityType === "public_comment_reaction" ||
    normalizedActivityType === "public_comment_like" ||
    normalizedActivityType === "public_comment_dislike";
  const isPrivateType =
    normalizedActivityType === "private_message" ||
    normalizedActivityType === "directed_comment" ||
    normalizedActivityType === "directed_comment_reaction" ||
    normalizedActivityType === "directed_comment_like" ||
    normalizedActivityType === "directed_comment_dislike" ||
    normalizedActivityType === "private_comment_reaction";
  const payloadCommentType = safeTrim(pickFirst(payload.comment_type, payload.type, payload.comment_scope))?.toLocaleLowerCase();
  const hasPrivatePayloadCommentType = payloadCommentType === "directed" || payloadCommentType === "private";
  const isDirectedComment =
    isPrivateType || hasPrivatePayloadCommentType || isTrueValue(payload.is_directed);
  const isReactionType =
    isPublicReactionType ||
    normalizedActivityType.includes("reaction") ||
    normalizedActivityType.includes("comment_like") ||
    normalizedActivityType.includes("comment_dislike");
  const normalizedReactionValue = safeTrim(
    pickFirst(
      payload.reaction_value,
      payload.reactionValue,
      payload.reaction_type,
      payload.reactionType,
      activityRecord.reaction_value,
      activityRecord.reaction_type,
      payload.reaction,
      payload.value,
    ),
  )?.toLocaleLowerCase();
  const reactionValue: "like" | "dislike" | undefined =
    normalizedReactionValue === "like" || normalizedReactionValue === "thumbs_up"
      ? "like"
      : normalizedReactionValue === "dislike" || normalizedReactionValue === "thumbs_down"
        ? "dislike"
        : undefined;
  const isDislikeReaction =
    normalizedActivityType === "public_comment_dislike" ||
    normalizedActivityType === "directed_comment_dislike" ||
    reactionValue === "dislike" ||
    normalizedActivityType.includes("dislike");
  const isPrivateReaction =
    isPrivateType ||
    hasPrivatePayloadCommentType ||
    isTrueValue(payload.is_directed);
  const score = toNumberOrNull(pickFirst(payload.score, activityRecord.score, movie.my_rating));
  const commentText = toStringOrNull(
    pickFirst(payload.content, payload.text, activityRecord.comment_text),
  );
  const commentId = toStringOrNull(pickFirst(payload.comment_id, payload.commentId));
  const likedCommentSnippet = toStringOrNull(
    pickFirst(payload.comment_excerpt, activityRecord.comment_text, payload.content, payload.text),
  );
  const likedCommentAuthor = toRecord(pickFirst(payload.comment_author, activityRecord.comment_author));
  const likedCommentAuthorUsername = toStringOrNull(likedCommentAuthor?.username);
  const reactionActor = toRecord(payload.actor);
  const reactionActorUsername = toStringOrNull(pickFirst(reactionActor?.username, actor.username));
  const reactionId = toStringOrNull(pickFirst(payload.reaction_id, payload.reactionId, payload.active_reaction_id, payload.current_reaction_id));
  const isGivenReaction = isTrueValue(
    pickFirst(payload.is_given_reaction, payload.isGivenReaction, activityRecord.is_given_reaction, activityRecord.isGivenReaction),
  );
  const isReceivedReaction = isTrueValue(
    pickFirst(
      payload.is_received_reaction,
      payload.isReceivedReaction,
      activityRecord.is_received_reaction,
      activityRecord.isReceivedReaction,
    ),
  );
  const directedTargetUser = toRecord(payload.target_user);
  const directedCommentTargetUsername = toStringOrNull(
    typeof payload.target_user === "string" ? payload.target_user : directedTargetUser?.username,
  );

  const movieType = toStringOrNull(movie.type);
  const movieGenre = toStringOrNull(movie.genre) || undefined;
  const generalRating = toNumberOrNull(movie.display_rating);
  const followingRating = toNumberOrNull(pickFirst(movie.following_avg_rating, movie.following_rating));
  const followingRatingsCount = toNonNegativeInteger(pickFirst(movie.following_ratings_count, movie.following_rating_count));
  const myRating = toNumberOrNull(movie.my_rating);
  const interactionType: SocialActivityItem["interactionType"] =
    normalizedActivityType === "rating"
      ? "rating"
      : isPublicCommentType || normalizedActivityType === "directed_comment" || normalizedActivityType === "private_message"
        ? "comment"
        : isReactionType
          ? reactionValue === "like"
            ? "like"
            : isDislikeReaction
            ? "dislike"
            : "like"
          : normalizedActivityType === "public_comment_dislike"
            ? "dislike"
            : "like";
  const scope: NotificationTargetTab = isPublicCommentType || isPublicReactionType
    ? "activity"
    : isDirectedComment || (isReactionType && isPrivateReaction)
      ? "private_inbox"
      : "activity";

  return {
    id: item.id,
    activityType: normalizedActivityType || undefined,
    user: {
      id: String(pickFirst(actor.id, `actor-${item.id}`)),
      username: toStringOrNull(actor.username) || "usuario",
      displayName: toStringOrNull(actor.display_name),
      avatarUrl: toStringOrNull(actor.avatar),
      followersCount: 0,
    },
    userDisplayName: toStringOrNull(actor.display_name),
    movieTitle: getDisplayMovieTitle(movie as unknown as ProfileFeedActivityResponseItem["movie"]) || "Título desconocido",
    movieSecondaryTitle: getDisplayMovieSecondaryTitle(movie as unknown as ProfileFeedActivityResponseItem["movie"]),
    movieYear: toNumberOrNull(movie.release_year),
    movieId: pickFirst(movie.id, `movie-${item.id}`) as number | string,
    moviePosterUrl: (pickFirst(movie.image, movie.poster, movie.poster_url, movie.image_url) as string | null) ?? null,
    movieType: movieType ?? undefined,
    movieGenre,
    generalRating: generalRating ?? undefined,
    followingRating: followingRating ?? undefined,
    followingRatingsCount: followingRatingsCount > 0 ? followingRatingsCount : undefined,
    myRating: myRating ?? undefined,
    createdAt: item.created_at,
    interactionType,
    isDirectedComment: isDirectedComment || undefined,
    directedCommentTargetUsername: directedCommentTargetUsername ?? undefined,
    ratingValue: score ?? undefined,
    commentText: commentText ?? undefined,
    likedCommentSnippet: likedCommentSnippet ?? undefined,
    likedCommentAuthorUsername: likedCommentAuthorUsername ?? undefined,
    reactionActorUsername: reactionActorUsername ?? undefined,
    commentId: commentId ?? undefined,
    reactionId: reactionId ?? undefined,
    actorId: toStringOrNull(actor.id) ?? undefined,
    isGivenReaction: isReactionType ? isGivenReaction : undefined,
    isReceivedReaction: isReactionType ? isReceivedReaction : undefined,
    scope,
    reactionScope:
      interactionType === "like" || interactionType === "dislike"
        ? isPublicReactionType
          ? "public"
          : isPrivateReaction
            ? "private"
            : "public"
        : undefined,
    reactionValue: interactionType === "like" || interactionType === "dislike" ? interactionType : undefined,
  };
}

function parseSocialActivity(payload: unknown): PaginatedSocialActivity {
  const root = toRecord(payload);
  const data = toRecord(root?.data);
  const results = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.results)
      ? root.results
      : Array.isArray(root?.items)
        ? root.items
        : Array.isArray(root?.activity)
          ? root.activity
          : Array.isArray(root?.activities)
            ? root.activities
            : Array.isArray(data?.results)
              ? data.results
              : Array.isArray(data?.items)
                ? data.items
                : Array.isArray(data?.activity)
                  ? data.activity
                  : Array.isArray(data?.activities)
                    ? data.activities
                    : [];
  const mapped = results
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => toActivityItem(item as unknown as ProfileFeedActivityResponseItem));

  return {
    items: dedupeReactionItems(mapped),
    next: typeof root?.next === "string" ? root.next : null,
  };
}

interface MyMessageApiSender {
  id?: number | string;
  username?: string | null;
  avatar?: string | null;
}

interface MyMessageApiMovie {
  id?: number | string;
  title_spanish?: string | null;
  title_english?: string | null;
  type?: string | null;
  genre?: string | null;
}

interface MyMessageApiItem {
  id?: number | string;
  message_id?: number | string;
  comment_id?: number | string;
  body?: string | null;
  content?: string | null;
  text?: string | null;
  comment?: string | null;
  message?: string | null;
  created_at?: string | null;
  direction?: string | null;
  activity_type?: string | null;
  event_type?: string | null;
  type?: string | null;
  movie_id?: number | string | null;
  is_sent?: boolean | null;
  likes_count?: number | null;
  dislikes_count?: number | null;
  my_reaction?: string | null;
  author?: MyMessageApiSender | null;
  sender?: MyMessageApiSender | null;
  recipient?: MyMessageApiSender | null;
  receiver?: MyMessageApiSender | null;
  target_user?: MyMessageApiSender | null;
  counterpart?: MyMessageApiSender | null;
  movie?: MyMessageApiMovie | null;
}

function resolveMessageEntityId(value: unknown, fallback: string): string | number {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function normalizeMessageContent(value: string | null | undefined): string {
  return (value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function resolveMessageText(item: MyMessageApiItem): string | null {
  return (
    safeTrim(item.body) ||
    safeTrim(item.content) ||
    safeTrim(item.text) ||
    safeTrim(item.comment) ||
    safeTrim(item.message) ||
    null
  );
}

function isPrivateMessageType(item: MyMessageApiItem): boolean {
  const normalizedType = safeTrim(item.activity_type)?.toLocaleLowerCase();
  return normalizedType === "private_message";
}

function isReactionOrActivitySummary(item: MyMessageApiItem): boolean {
  const normalizedType = safeTrim(pickFirst(item.activity_type, item.event_type, item.type))?.toLocaleLowerCase();
  if (!normalizedType) return false;
  return (
    normalizedType.includes("reaction") ||
    normalizedType.includes("like") ||
    normalizedType.includes("dislike") ||
    normalizedType.includes("activity")
  );
}

function isReactionSummaryText(text: string): boolean {
  const normalized = text.trim().toLocaleLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes("le gustó tu mensaje") ||
    normalized.includes("te gustó el mensaje de") ||
    normalized.includes("no le gustó tu mensaje") ||
    normalized.includes("no te gustó el mensaje de")
  );
}

interface ParsedMessageCandidate {
  item: MyMessageItem;
  messageId: string | null;
  commentId: string | null;
  isPrivateMessage: boolean;
  normalizedContent: string;
  fallbackKey: string;
}

function getMessageCounterpartUsername(item: MyMessageItem): string {
  const counterpart = item.direction === "sent" ? item.recipient || item.sender : item.sender;
  return counterpart.username.trim().toLocaleLowerCase();
}

function toParsedMessageCandidate(item: MyMessageApiItem, index: number): ParsedMessageCandidate | null {
  const text = resolveMessageText(item);
  if (!text) return null;
  if (isReactionOrActivitySummary(item)) return null;
  if (isReactionSummaryText(text)) return null;

  const mapped = toMessageItem(item, index, text);
  const normalizedContent = normalizeMessageContent(text);
  const messageId = toStringOrNull(item.message_id);
  const commentId = toStringOrNull(item.comment_id);
  const movieId = String(resolveMessageEntityId(pickFirst(item.movie?.id, item.movie_id), `movie-${index}`));
  const counterpartUsername = getMessageCounterpartUsername(mapped);
  const fallbackKey = [
    movieId,
    mapped.createdAt,
    counterpartUsername,
    normalizedContent,
  ].join("::");

  return {
    item: mapped,
    messageId,
    commentId,
    isPrivateMessage: isPrivateMessageType(item),
    normalizedContent,
    fallbackKey,
  };
}

function dedupeMessageCandidates(candidates: ParsedMessageCandidate[]): MyMessageItem[] {
  const byMessageId = new Map<string, ParsedMessageCandidate>();
  const byCommentId = new Map<string, ParsedMessageCandidate>();
  const byPrivateId = new Map<string, ParsedMessageCandidate>();
  const byFallback = new Map<string, ParsedMessageCandidate>();
  const deduped: ParsedMessageCandidate[] = [];

  for (const candidate of candidates) {
    const id = candidate.item.id;

    if (candidate.messageId && byMessageId.has(candidate.messageId)) continue;
    if (candidate.commentId && byCommentId.has(candidate.commentId)) continue;
    if (candidate.isPrivateMessage && byPrivateId.has(id)) continue;
    if (byFallback.has(candidate.fallbackKey)) continue;

    deduped.push(candidate);
    if (candidate.messageId) byMessageId.set(candidate.messageId, candidate);
    if (candidate.commentId) byCommentId.set(candidate.commentId, candidate);
    if (candidate.isPrivateMessage) byPrivateId.set(id, candidate);
    byFallback.set(candidate.fallbackKey, candidate);
  }

  return deduped.map((candidate) => candidate.item);
}

function toMessageItem(item: MyMessageApiItem, index: number, resolvedText?: string): MyMessageItem {
  const sender = item.author || item.sender || item.counterpart || item.target_user;
  const recipient = item.recipient || item.receiver || item.target_user || item.counterpart;
  const normalizedDirection = safeTrim(item.direction)?.toLocaleLowerCase();
  const direction: MyMessageItem["direction"] =
    normalizedDirection === "sent" || normalizedDirection === "outgoing"
      ? "sent"
      : normalizedDirection === "received" || normalizedDirection === "incoming"
        ? "received"
        : isTrueValue(item.is_sent)
          ? "sent"
          : "received";
  const movie = item.movie;
  const titleSpanish = safeTrim(movie?.title_spanish);
  const titleEnglish = safeTrim(movie?.title_english);
  const movieTitle = titleSpanish || titleEnglish || "Título desconocido";
  const movieSecondaryTitle = titleSpanish && titleEnglish && titleSpanish !== titleEnglish ? titleEnglish : null;
  const metadataType = safeTrim(movie?.type) || undefined;
  const metadataGenre = safeTrim(movie?.genre) || undefined;

  return {
    id: String(pickFirst(item.id, `message-${index}`)),
    direction,
    sender: {
      id: String(pickFirst(sender?.id, `sender-${index}`)),
      username: safeTrim(sender?.username) || "usuario",
      displayName: null,
      avatarUrl: safeTrim(sender?.avatar),
      followersCount: null,
    },
    recipient: recipient
      ? {
          id: String(pickFirst(recipient.id, `recipient-${index}`)),
          username: safeTrim(recipient.username) || "usuario",
          displayName: null,
          avatarUrl: safeTrim(recipient.avatar),
          followersCount: null,
        }
      : null,
    movieId: resolveMessageEntityId(movie?.id, `movie-${index}`),
    movieTitle,
    movieSecondaryTitle,
    moviePosterUrl: null,
    movieType: metadataType,
    movieGenre: metadataGenre,
    text: resolvedText || resolveMessageText(item) || "",
    createdAt: safeTrim(item.created_at) || new Date().toISOString(),
  };
}

function parseMyMessages(payload: unknown): PaginatedMyMessages {
  const root = toRecord(payload);
  const data = toRecord(root?.data);
  const results = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.results)
      ? root.results
      : Array.isArray(root?.items)
        ? root.items
        : Array.isArray(root?.messages)
          ? root.messages
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.items)
              ? data.items
              : Array.isArray(data?.messages)
                ? data.messages
      : [];

  const items = dedupeMessageCandidates(
    results
    .map((entry) => toRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => entry as MyMessageApiItem)
    .map((entry, index) => toParsedMessageCandidate(entry, index))
    .filter((entry): entry is ParsedMessageCandidate => Boolean(entry)),
  )
    .sort((left, right) => {
      const leftTs = new Date(left.createdAt).getTime();
      const rightTs = new Date(right.createdAt).getTime();
      if (Number.isNaN(leftTs) || Number.isNaN(rightTs)) return 0;
      return rightTs - leftTs;
    });

  return {
    items,
    next: typeof root?.next === "string" ? root.next : typeof data?.next === "string" ? data.next : null,
  };
}

function buildUserProfileEndpoint(username: string): string {
  return PROFILE_USER_ENDPOINT_TEMPLATE.replace("{username}", encodeURIComponent(username));
}

function buildPublicUserProfileEndpoint(username: string): string {
  return PROFILE_PUBLIC_USER_ENDPOINT_TEMPLATE.replace("{username}", encodeURIComponent(username));
}

function buildUserFavoritesEndpoint(username: string): string {
  return PROFILE_USER_FAVORITES_ENDPOINT_TEMPLATE.replace("{username}", encodeURIComponent(username));
}

function buildUserFriendsEndpoint(username: string): string {
  return PROFILE_USER_FRIENDS_ENDPOINT_TEMPLATE.replace("{username}", encodeURIComponent(username));
}

function buildSocialUserFriendsEndpoint(username: string): string {
  return PROFILE_SOCIAL_USER_FRIENDS_ENDPOINT_TEMPLATE.replace("{username}", encodeURIComponent(username));
}

function parseUserScope(scope: SocialActivityScope): string | null {
  if (!scope.startsWith("user:")) return null;
  const username = scope.slice(5).trim();
  return username || null;
}

function buildUserActivityEndpoint(username: string): string {
  return PROFILE_USER_ACTIVITY_ENDPOINT_TEMPLATE.replace("{username}", encodeURIComponent(username));
}

function filterUsernameScopedActivity(items: SocialActivityItem[], username: string): SocialActivityItem[] {
  const normalizedExpected = username.trim().toLocaleLowerCase();
  if (!normalizedExpected || items.length === 0) return items;

  return items.filter((item) => item.user.username.toLocaleLowerCase() === normalizedExpected);
}

function buildActivityScopeEndpoint(scope: SocialActivityScope): string {
  if (scope === "me") return PROFILE_FEED_ACTIVITY_ENDPOINT;

  const username = parseUserScope(scope);
  if (username) {
    return buildUserActivityEndpoint(username);
  }

  const params = new URLSearchParams({ scope: scope });
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

function toSocialUser(user: Record<string, unknown>, fallbackId: string): SocialUser | null {
  const username = safeTrim(pickFirst(user.username, user.user_name, user.name));
  if (!username) return null;
  const profile = toRecord(user.profile);
  const personalData = toRecord(user.personal_data);

  return {
    id: String(pickFirst(user.id, user.user_id, fallbackId)),
    username,
    displayName: safeTrim(pickFirst(user.display_name, user.displayName, user.full_name)),
    avatarUrl: safeTrim(
      pickFirst(user.avatar, user.avatar_url, user.profile_image, user.photo_url, profile?.avatar, personalData?.avatar),
    ),
    followersCount: resolveFollowersCount(user),
    firstName: safeTrim(pickFirst(user.first_name, profile?.first_name, personalData?.first_name)),
    lastName: safeTrim(pickFirst(user.last_name, profile?.last_name, personalData?.last_name)),
    age: toNumberOrNull(pickFirst(user.age, profile?.age, personalData?.age)),
    ageVisible: toBooleanOrNull(
      pickFirst(user.birth_date_visible, user.age_visible, profile?.birth_date_visible, personalData?.birth_date_visible),
    ),
    genderIdentity: safeTrim(
      pickFirst(user.gender_identity, user.gender, profile?.gender_identity, personalData?.gender_identity),
    ),
    genderIdentityVisible: toBooleanOrNull(
      pickFirst(
        user.gender_identity_visible,
        user.gender_visible,
        profile?.gender_identity_visible,
        personalData?.gender_identity_visible,
      ),
    ),
    canViewFullProfile: toBooleanOrNull(pickFirst(user.can_view_full_profile, user.canViewFullProfile, profile?.can_view_full_profile)),
    profileAccess: safeTrim(pickFirst(user.profile_access, user.profileAccess, profile?.profile_access)),
  };
}

export async function getMyProfile(): Promise<SocialUser | null> {
  const payload = await apiFetch(PROFILE_ME_ENDPOINT);
  const record = toRecord(payload);
  if (!record) return null;

  const source = { ...record, ...(toRecord(record.user) || toRecord(record.profile) || toRecord(record.data) || {}) };
  return toSocialUser(source, "me");
}

export async function getUserProfileByUsername(username: string): Promise<SocialUser | null> {
  const attempts = [buildUserProfileEndpoint(username), buildPublicUserProfileEndpoint(username)];
  let mergedProfile: SocialUser | null = null;

  for (const endpoint of attempts) {
    try {
      const payload = await apiFetch(endpoint);
      const record = toRecord(payload);
      if (!record) continue;

      const candidate =
        toRecord(record.user) ||
        toRecord(record.profile) ||
        toRecord(record.data) ||
        record;

      const normalized = toSocialUser({ ...record, ...candidate }, `user-${username}`);
      if (!normalized) continue;

      if (!mergedProfile) {
        mergedProfile = normalized;
        continue;
      }

      mergedProfile = {
        ...mergedProfile,
        id: normalized.id || mergedProfile.id,
        username: normalized.username || mergedProfile.username,
        displayName: normalized.displayName ?? mergedProfile.displayName ?? null,
        avatarUrl: normalized.avatarUrl ?? mergedProfile.avatarUrl ?? null,
        followersCount: normalized.followersCount ?? mergedProfile.followersCount,
        firstName: normalized.firstName ?? mergedProfile.firstName ?? null,
        lastName: normalized.lastName ?? mergedProfile.lastName ?? null,
        age: normalized.age ?? mergedProfile.age ?? null,
        ageVisible: normalized.ageVisible ?? mergedProfile.ageVisible ?? null,
        genderIdentity: normalized.genderIdentity ?? mergedProfile.genderIdentity ?? null,
        genderIdentityVisible: normalized.genderIdentityVisible ?? mergedProfile.genderIdentityVisible ?? null,
        canViewFullProfile: normalized.canViewFullProfile ?? mergedProfile.canViewFullProfile ?? null,
        profileAccess: normalized.profileAccess ?? mergedProfile.profileAccess ?? null,
      };
    } catch (error) {
      if (error instanceof ApiError && [404, 405, 422].includes(error.status)) {
        continue;
      }
      throw error;
    }
  }

  return mergedProfile;
}

export async function getFavoriteMoviesByUsername(username: string): Promise<FavoriteMovie[]> {
  const attempts = [buildUserFavoritesEndpoint(username)];

  for (const endpoint of attempts) {
    try {
      const payload = await apiFetch(endpoint);
      return parseFavorites(payload, { forVisitedProfile: true });
    } catch (error) {
      if (error instanceof ApiError && [404, 405, 422].includes(error.status)) {
        continue;
      }
      throw error;
    }
  }

  return [];
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
      title: normalized.displayTitle,
      displayTitle: normalized.displayTitle,
      displaySecondaryTitle: normalized.displaySecondaryTitle,
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

export async function getTopFriendsByUsername(username: string): Promise<SocialUser[]> {
  const attempts = [buildUserFriendsEndpoint(username), buildSocialUserFriendsEndpoint(username)];

  for (const endpoint of attempts) {
    try {
      const payload = await apiFetch(endpoint);
      const friends = parseAcceptedFriends(payload, username);
      return sortUsersByFollowersDesc(friends);
    } catch (error) {
      if (error instanceof ApiError && [404, 405, 422].includes(error.status)) {
        continue;
      }
      throw error;
    }
  }

  return [];
}

export async function getTopFollowing(): Promise<SocialUser[]> {
  const results = await tryFollowingEndpoints();
  return sortUsersByFollowersDesc(results);
}

export async function getTopFollowingByUsername(username: string): Promise<SocialUser[]> {
  const attempts = [
    buildUserFollowingEndpoint(username),
    `${PROFILE_ME_FOLLOWING_ENDPOINT}?${new URLSearchParams({ username }).toString()}`,
  ];

  for (const endpoint of attempts) {
    try {
      const payload = await apiFetch(endpoint);
      const parsed = parseFollowingUsers(payload);
      if (parsed.length > 0) return sortUsersByFollowersDesc(parsed);
    } catch (error) {
      if (error instanceof ApiError && [404, 405, 422].includes(error.status)) {
        continue;
      }
      throw error;
    }
  }

  return [];
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
  if (Array.isArray(root.friendships)) return root.friendships;
  if (Array.isArray(root.connections)) return root.connections;

  const data = toRecord(root.data);
  if (!data) return [];
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.following)) return data.following;
  if (Array.isArray(data.users)) return data.users;
  if (Array.isArray(data.friends)) return data.friends;
  if (Array.isArray(data.friendships)) return data.friendships;
  if (Array.isArray(data.connections)) return data.connections;

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

function pickFriendCandidateByUsername(
  friendship: Record<string, unknown>,
  requestedUsername?: string,
): Record<string, unknown> | null {
  const requested = requestedUsername?.trim().toLocaleLowerCase();
  const candidates = [
    toRecord(friendship.friend),
    toRecord(friendship.other_user),
    toRecord(friendship.receiver),
    toRecord(friendship.sender),
    toRecord(friendship.requester),
    toRecord(friendship.addressee),
    toRecord(friendship.from_user),
    toRecord(friendship.to_user),
    toRecord(friendship.user),
    toRecord(friendship.profile),
    toRecord(friendship.user_1),
    toRecord(friendship.user_2),
    toRecord(friendship.user1),
    toRecord(friendship.user2),
  ].filter((item): item is Record<string, unknown> => Boolean(item));

  if (candidates.length === 0) return null;
  if (!requested) return candidates[0];

  const exactRequested = candidates.find((candidate) => safeTrim(candidate.username)?.toLocaleLowerCase() === requested);
  if (exactRequested && candidates.length === 1) return exactRequested;

  const notRequested = candidates.find((candidate) => safeTrim(candidate.username)?.toLocaleLowerCase() !== requested);
  if (notRequested) return notRequested;

  return candidates[0];
}

function parseAcceptedFriends(payload: unknown, requestedUsername?: string): SocialUser[] {
  const acceptedFriendships = getAcceptedFriendships(payload);
  return acceptedFriendships
    .map((friendship, index): SocialUser | null => {
      const user = pickFriendCandidateByUsername(friendship, requestedUsername) || extractFriendCandidateUser(friendship);
      const username = safeTrim(pickFirst(user.username, user.name, user.user_name));
      if (!username) return null;

      return {
        id: String(pickFirst(user.id, user.user_id, friendship.id, `friend-${index + 1}`)),
        username,
        displayName: safeTrim(pickFirst(user.display_name, user.displayName, user.full_name)) ?? null,
        avatarUrl: safeTrim(pickFirst(user.avatar, user.avatar_url, user.profile_image, user.photo_url)) ?? null,
        followersCount: resolveFollowersCount({ ...friendship, ...user }),
        firstName: safeTrim(user.first_name),
        lastName: safeTrim(user.last_name),
        age: toNumberOrNull(user.age),
        ageVisible: toBooleanOrNull(pickFirst(user.birth_date_visible, user.age_visible)),
        genderIdentity: safeTrim(pickFirst(user.gender_identity, user.gender)),
        genderIdentityVisible: toBooleanOrNull(pickFirst(user.gender_identity_visible, user.gender_visible)),
      };
    })
    .filter(isNonNullSocialUser);
}

function isAcceptedFriendship(entry: Record<string, unknown>): boolean {
  const hasFriendshipShape =
    Boolean(
      toRecord(entry.friend) ||
      toRecord(entry.other_user) ||
      toRecord(entry.receiver) ||
      toRecord(entry.sender) ||
      toRecord(entry.requester) ||
      toRecord(entry.addressee) ||
      toRecord(entry.from_user) ||
      toRecord(entry.to_user) ||
      toRecord(entry.user_1) ||
      toRecord(entry.user_2) ||
      toRecord(entry.user1) ||
      toRecord(entry.user2),
    ) ||
    Boolean(
      safeTrim(pickFirst(entry.friendship_status, entry.request_status, entry.friendship_id, entry.connection_id)),
    );

  if (!hasFriendshipShape) return true;

  const status = safeTrim(pickFirst(entry.status, entry.friendship_status, entry.request_status, entry.state))?.toLowerCase();
  if (!status) return true;
  return [
    "accepted",
    "accept",
    "friends",
    "friend",
    "active",
    "matched",
    "connected",
    "approved",
    "confirmed",
  ].some((allowed) => status === allowed || status.includes(allowed));
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
          firstName: safeTrim(entry.first_name),
          lastName: safeTrim(entry.last_name),
          age: toNumberOrNull(entry.age),
          ageVisible: toBooleanOrNull(pickFirst(entry.birth_date_visible, entry.age_visible)),
          genderIdentity: safeTrim(pickFirst(entry.gender_identity, entry.gender)),
          genderIdentityVisible: toBooleanOrNull(pickFirst(entry.gender_identity_visible, entry.gender_visible)),
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
        firstName: safeTrim(user.first_name),
        lastName: safeTrim(user.last_name),
        age: toNumberOrNull(user.age),
        ageVisible: toBooleanOrNull(pickFirst(user.birth_date_visible, user.age_visible)),
        genderIdentity: safeTrim(pickFirst(user.gender_identity, user.gender)),
        genderIdentityVisible: toBooleanOrNull(pickFirst(user.gender_identity_visible, user.gender_visible)),
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
  const usernameScope = parseUserScope(tab);
  const isMyActivityScope = tab === "me";

  if (isMyActivityScope && !nextEndpoint) {
    let myUsername: string | null = null;
    try {
      myUsername = await getMyUsername();
    } catch {
      myUsername = null;
    }

    const attempts: string[] = [];
    if (myUsername) {
      attempts.push(buildUserActivityEndpoint(myUsername));
    }
    attempts.push(`${PROFILE_FEED_ACTIVITY_ENDPOINT}?${new URLSearchParams({ scope: "me" }).toString()}`);
    attempts.push(PROFILE_FEED_ACTIVITY_ENDPOINT);

    for (const endpoint of attempts) {
      try {
        const payload = await apiFetch(endpoint, { signal });
        const parsed = parseSocialActivity(payload);
        const scopedItems = myUsername ? filterUsernameScopedActivity(parsed.items, myUsername) : parsed.items;
        if (scopedItems.length === 0) {
          continue;
        }

        return {
          items: scopedItems,
          next: parsed.next ? normalizeActivityNextEndpoint(parsed.next) : null,
        };
      } catch (error) {
        if (error instanceof ApiError && [400, 404, 405, 422].includes(error.status)) {
          continue;
        }
        throw error;
      }
    }

    return { items: [], next: null };
  }

  if (usernameScope && !nextEndpoint) {
    const attempts = [
      buildUserActivityEndpoint(usernameScope),
      `${PROFILE_FEED_ACTIVITY_ENDPOINT}?${new URLSearchParams({ username: usernameScope }).toString()}`,
      `${PROFILE_FEED_ACTIVITY_ENDPOINT}?${new URLSearchParams({ scope: tab }).toString()}`,
    ];

    for (const endpoint of attempts) {
      try {
        const payload = await apiFetch(endpoint, { signal });
        const parsed = parseSocialActivity(payload);
        const scopedItems = filterUsernameScopedActivity(parsed.items, usernameScope);
        if (scopedItems.length === 0) {
          continue;
        }

        return {
          items: scopedItems,
          next: parsed.next ? normalizeActivityNextEndpoint(parsed.next) : null,
        };
      } catch (error) {
        if (error instanceof ApiError && [400, 404, 405, 422].includes(error.status)) {
          continue;
        }
        throw error;
      }
    }

    return { items: [], next: null };
  }

  const endpoint = nextEndpoint || buildActivityScopeEndpoint(tab);
  let payload: unknown;

  try {
    payload = await apiFetch(endpoint, { signal });
  } catch (error) {
    if (isMyActivityScope && error instanceof ApiError && [400, 404, 422].includes(error.status)) {
      return { items: [], next: null };
    }
    throw error;
  }
  const parsed = parseSocialActivity(payload);
  const items = usernameScope ? filterUsernameScopedActivity(parsed.items, usernameScope) : parsed.items;

  return {
    items,
    next: parsed.next ? normalizeActivityNextEndpoint(parsed.next) : null,
  };
}

export async function getMyMessages(nextEndpoint: string | null = null, signal?: AbortSignal): Promise<PaginatedMyMessages> {
  const endpoint = nextEndpoint || PROFILE_ME_MESSAGES_ENDPOINT;
  const payload = await apiFetch(endpoint, { signal });
  const parsed = parseMyMessages(payload);

  return {
    items: parsed.items,
    next: parsed.next ? normalizeActivityNextEndpoint(parsed.next) : null,
  };
}

export async function getMyMessagesSummary(signal?: AbortSignal): Promise<MyMessagesSummary> {
  const payload = await apiFetch(PROFILE_ME_MESSAGES_SUMMARY_ENDPOINT, { signal });
  const record = toRecord(payload);

  return {
    hasUnreadMessages: Boolean(record?.has_unread_messages),
    unreadCount: toNonNegativeInteger(record?.unread_count),
    totalMessages: toNonNegativeInteger(record?.total_messages),
  };
}

export async function markMyMessagesAsRead(signal?: AbortSignal): Promise<number> {
  const payload = await apiFetch(PROFILE_ME_MESSAGES_MARK_AS_READ_ENDPOINT, {
    method: "POST",
    signal,
  });

  return toNonNegativeInteger(toRecord(payload)?.updated);
}

function toTargetTab(value: unknown): NotificationTargetTab | null {
  const normalized = safeTrim(value)?.toLocaleLowerCase();
  if (!normalized) return null;
  if (normalized === "activity") return "activity";
  if (normalized === "private_inbox" || normalized === "messages") return "private_inbox";
  return null;
}

function toNotificationItem(value: unknown, index: number): MyNotificationItem | null {
  const record = toRecord(value);
  if (!record) return null;

  const id = safeTrim(pickFirst(record.notification_id, record.id, record.uuid)) || `notification-${index}`;
  const text =
    safeTrim(pickFirst(record.text, record.message, record.title, record.description, record.label)) || "Tienes una notificación pendiente";
  const targetTab = toTargetTab(pickFirst(record.target_tab, record.targetTab, record.destination_tab, record.tab));

  if (!targetTab) return null;

  return {
    id,
    text,
    targetTab,
    createdAt: safeTrim(pickFirst(record.created_at, record.createdAt, record.timestamp)),
  };
}

function parseNotificationsSummary(payload: unknown): MyNotificationsSummary {
  const root = toRecord(payload);
  const data = toRecord(root?.data);
  const notificationsRaw = pickFirst(
    root?.notifications,
    root?.results,
    root?.items,
    root?.unread_notifications,
    data?.notifications,
    data?.results,
    data?.items,
    data?.unread_notifications,
    [],
  );
  const notifications = Array.isArray(notificationsRaw)
    ? notificationsRaw.map((item, index) => toNotificationItem(item, index)).filter((item): item is MyNotificationItem => Boolean(item))
    : [];

  const totalUnread = toNonNegativeInteger(
    pickFirst(root?.total_unread, root?.unread_count, data?.total_unread, data?.unread_count, notifications.length),
  );

  return { totalUnread, items: notifications };
}

export async function getMyNotificationsSummary(signal?: AbortSignal): Promise<MyNotificationsSummary> {
  const payload = await apiFetch(PROFILE_ME_NOTIFICATIONS_ENDPOINT, { signal });
  return parseNotificationsSummary(payload);
}

function buildNotificationMarkAsReadEndpoint(notificationId: string): string {
  return PROFILE_ME_NOTIFICATIONS_MARK_AS_READ_ENDPOINT_TEMPLATE.replace("{id}", encodeURIComponent(notificationId));
}

export async function markNotificationAsRead(notificationId: string, signal?: AbortSignal): Promise<number> {
  const trimmedNotificationId = notificationId.trim();
  if (!trimmedNotificationId) return 0;

  const endpoints = [buildNotificationMarkAsReadEndpoint(trimmedNotificationId), PROFILE_ME_NOTIFICATIONS_MARK_AS_READ_BULK_ENDPOINT];
  for (const endpoint of endpoints) {
    try {
      const payload = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(endpoint === PROFILE_ME_NOTIFICATIONS_MARK_AS_READ_BULK_ENDPOINT ? { ids: [trimmedNotificationId] } : { id: trimmedNotificationId }),
        signal,
      });
      return toNonNegativeInteger(toRecord(payload)?.updated || 1);
    } catch (error) {
      if (error instanceof ApiError && [400, 404, 405, 422].includes(error.status)) continue;
      throw error;
    }
  }

  return 0;
}
