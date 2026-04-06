export type ReactionType = "like" | "dislike" | null;

export interface Friend {
  id: number | string;
  username: string;
  avatarUrl: string | null;
}

export interface SocialComment {
  id: number | string;
  movieId: number | string | null;
  text: string;
  createdAt: string | null;
  authorName: string;
  authorAvatar: string | null;
  recipientName: string | null;
  type: "public" | "directed";
  likesCount: number;
  dislikesCount: number;
  myReaction: ReactionType;
}

export const FRIENDS_ENDPOINT = process.env.NEXT_PUBLIC_SOCIAL_FRIENDS_ENDPOINT || "/social/friends/";
export const FRIENDS_FALLBACK_ENDPOINTS = (process.env.NEXT_PUBLIC_SOCIAL_FRIENDS_FALLBACK_ENDPOINTS || "/friends/")
  .split(",")
  .map((endpoint) => endpoint.trim())
  .filter(Boolean)
  .filter((endpoint) => endpoint !== FRIENDS_ENDPOINT);
export const PUBLIC_COMMENTS_ENDPOINT =
  process.env.NEXT_PUBLIC_SOCIAL_PUBLIC_COMMENTS_ENDPOINT || "/social/comments/public/";
export const DIRECTED_COMMENTS_ENDPOINT =
  process.env.NEXT_PUBLIC_SOCIAL_DIRECTED_COMMENTS_ENDPOINT || "/social/comments/directed/";
export const COMMENT_CREATE_ENDPOINT = process.env.NEXT_PUBLIC_SOCIAL_COMMENT_CREATE_ENDPOINT || "/social/comments/";
export const COMMENT_REACTION_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_SOCIAL_COMMENT_REACTION_ENDPOINT_TEMPLATE || "/comments/{id}/reaction/";

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function pickFirst<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }

  return null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function toCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeReaction(value: unknown): ReactionType {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "like") return "like";
  if (normalized === "dislike") return "dislike";
  return null;
}

function getFriendsSource(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const root = toRecord(payload);
  if (!root) return [];

  if (Array.isArray(root.results)) return root.results;
  if (Array.isArray(root.items)) return root.items;

  const data = toRecord(root.data);
  if (!data) return [];

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.friends)) return data.friends;

  return [];
}

function getFriendRecord(friendship: Record<string, unknown>): Record<string, unknown> {
  const candidate =
    toRecord(pickFirst(friendship.friend, friendship.other_user, friendship.user, friendship.profile)) ||
    toRecord(friendship.receiver) ||
    toRecord(friendship.sender) ||
    toRecord(friendship.requester) ||
    toRecord(friendship.addressee) ||
    toRecord(friendship.from_user) ||
    toRecord(friendship.to_user);

  if (candidate) return candidate;

  return friendship;
}

export function parseFriends(payload: unknown): Friend[] {
  const source = getFriendsSource(payload);

  return source
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((friendship, index) => {
      const friend = getFriendRecord(friendship);
      const username = String(pickFirst(friend.username, friend.name, friend.user_name, `amigo-${index + 1}`));
      return {
        id: pickFirst(friend.id, friend.user_id, friendship.id, username) as number | string,
        username,
        avatarUrl: toStringOrNull(pickFirst(friend.avatar, friend.avatar_url, friend.profile_image, friend.photo_url)),
      };
    })
    .filter((friend) => friend.username.trim().length > 0);
}

function normalizeComment(raw: Record<string, unknown>, fallbackType: "public" | "directed"): SocialComment {
  const nestedAuthor = toRecord(pickFirst(raw.author, raw.user, raw.created_by));
  const nestedRecipient = toRecord(pickFirst(raw.recipient, raw.mentioned_user, raw.target_user));

  const authorName =
    toStringOrNull(pickFirst(nestedAuthor?.username, nestedAuthor?.name, raw.author_name, raw.username)) || "Usuario";

  const recipientName = toStringOrNull(
    pickFirst(nestedRecipient?.username, nestedRecipient?.name, raw.recipient_name, raw.mentioned_username),
  );

  const explicitType = toStringOrNull(pickFirst(raw.type, raw.comment_type, raw.visibility))?.toLowerCase();
  const type = explicitType === "directed" || explicitType === "private" ? "directed" : fallbackType;

  return {
    id: (pickFirst(raw.id, raw.comment_id, raw.uuid) || `comment-${Math.random().toString(36).slice(2, 10)}`) as number | string,
    movieId: (pickFirst(raw.movie, raw.movie_id) as number | string | null | undefined) ?? null,
    text: String(pickFirst(raw.body, raw.text, raw.comment, raw.content, "")),
    createdAt: toStringOrNull(pickFirst(raw.created_at, raw.createdAt, raw.date, raw.timestamp)),
    authorName,
    authorAvatar: toStringOrNull(pickFirst(nestedAuthor?.avatar, nestedAuthor?.avatar_url, raw.author_avatar)),
    recipientName,
    type,
    likesCount: toCount(pickFirst(raw.likes_count, raw.like_count, raw.likes, raw.reactions_like_count)),
    dislikesCount: toCount(pickFirst(raw.dislikes_count, raw.dislike_count, raw.dislikes, raw.reactions_dislike_count)),
    myReaction: normalizeReaction(pickFirst(raw.my_reaction, raw.user_reaction, raw.current_reaction)),
  };
}

export function parseComments(payload: unknown, fallbackType: "public" | "directed"): SocialComment[] {
  const root = toRecord(payload);
  const rootData = toRecord(root?.data);

  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.results)
      ? root.results
      : Array.isArray(root?.items)
        ? root.items
        : Array.isArray(root?.data)
          ? root.data
          : Array.isArray(rootData?.results)
            ? rootData.results
            : Array.isArray(rootData?.items)
              ? rootData.items
              : Array.isArray(rootData?.comments)
                ? rootData.comments
                : [];

  return source
    .map((entry) => toRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => normalizeComment(entry, fallbackType));
}

export function buildReactionEndpoint(commentId: number | string): string {
  return COMMENT_REACTION_ENDPOINT_TEMPLATE.replace("{id}", encodeURIComponent(String(commentId)));
}

export function formatSocialDate(date: string | null): string {
  if (!date) return "Sin fecha";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}
