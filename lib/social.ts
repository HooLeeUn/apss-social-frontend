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
export const MENTION_FRIENDS_ENDPOINT =
  process.env.NEXT_PUBLIC_SOCIAL_MENTION_FRIENDS_ENDPOINT || "/social/mentions/friends/";
export const PUBLIC_COMMENTS_ENDPOINT =
  process.env.NEXT_PUBLIC_SOCIAL_PUBLIC_COMMENTS_ENDPOINT || "/social/comments/public/";
export const DIRECTED_COMMENTS_ENDPOINT =
  process.env.NEXT_PUBLIC_SOCIAL_DIRECTED_COMMENTS_ENDPOINT || "/social/comments/directed/";
export const COMMENT_CREATE_ENDPOINT = process.env.NEXT_PUBLIC_SOCIAL_COMMENT_CREATE_ENDPOINT || "/social/comments/";
export const COMMENT_REACTION_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_SOCIAL_COMMENT_REACTION_ENDPOINT_TEMPLATE || "/social/comments/{id}/reactions/";

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
  if (Array.isArray(root.friends)) return root.friends;
  if (Array.isArray(root.friendships)) return root.friendships;

  const data = toRecord(root.data);
  if (data) {
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.friends)) return data.friends;
    if (Array.isArray(data.friendships)) return data.friendships;
  }

  const payloadRecord = toRecord(root.payload);
  if (!payloadRecord) return [];
  if (Array.isArray(payloadRecord.results)) return payloadRecord.results;
  if (Array.isArray(payloadRecord.items)) return payloadRecord.items;
  if (Array.isArray(payloadRecord.friends)) return payloadRecord.friends;
  if (Array.isArray(payloadRecord.friendships)) return payloadRecord.friendships;

  return [];
}

function isAcceptedFriendship(friendship: Record<string, unknown>): boolean {
  const status = toStringOrNull(pickFirst(friendship.status, friendship.friendship_status, friendship.state));
  if (!status) return true;
  return status.toLowerCase() === "accepted";
}

function normalizeIdentity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function inferCurrentIdentity(payload: unknown): { username: string | null; userId: string | null } {
  const root = toRecord(payload);
  if (!root) {
    return { username: null, userId: null };
  }

  const currentUser = toRecord(pickFirst(root.current_user, root.me, root.user, root.authenticated_user));
  const username = normalizeIdentity(
    pickFirst(currentUser?.username, root.current_username, root.username, currentUser?.name, root.current_user_name),
  );
  const userIdRaw = pickFirst(currentUser?.id, root.current_user_id, root.user_id);

  return {
    username,
    userId: userIdRaw !== null && userIdRaw !== undefined ? String(userIdRaw) : null,
  };
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
  const currentIdentity = inferCurrentIdentity(payload);
  const seen = new Set<string>();

  return source
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((friendship) => isAcceptedFriendship(friendship))
    .map((friendship, index) => {
      const requester = toRecord(friendship.requester) || toRecord(friendship.sender) || toRecord(friendship.from_user);
      const addressee = toRecord(friendship.addressee) || toRecord(friendship.receiver) || toRecord(friendship.to_user);

      const requesterUsername = normalizeIdentity(pickFirst(requester?.username, requester?.name));
      const addresseeUsername = normalizeIdentity(pickFirst(addressee?.username, addressee?.name));
      const requesterId = requester?.id !== undefined ? String(requester.id) : null;
      const addresseeId = addressee?.id !== undefined ? String(addressee.id) : null;

      let friend: Record<string, unknown> = getFriendRecord(friendship);

      if (requester && addressee) {
        const isRequesterCurrent =
          (currentIdentity.username && requesterUsername === currentIdentity.username) ||
          (currentIdentity.userId && requesterId === currentIdentity.userId);
        const isAddresseeCurrent =
          (currentIdentity.username && addresseeUsername === currentIdentity.username) ||
          (currentIdentity.userId && addresseeId === currentIdentity.userId);

        if (isRequesterCurrent && !isAddresseeCurrent) friend = addressee;
        if (isAddresseeCurrent && !isRequesterCurrent) friend = requester;
      }

      const username = String(pickFirst(friend.username, friend.name, friend.user_name, `amigo-${index + 1}`));
      const normalizedUsername = username.trim().toLowerCase();
      if (!normalizedUsername || seen.has(normalizedUsername)) return null;
      seen.add(normalizedUsername);

      return {
        id: pickFirst(friend.id, friend.user_id, friendship.id, username) as number | string,
        username,
        avatarUrl: toStringOrNull(pickFirst(friend.avatar, friend.avatar_url, friend.profile_image, friend.photo_url)),
      };
    })
    .filter((friend): friend is Friend => Boolean(friend));
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
    text: String(pickFirst(raw.text, raw.comment, raw.content, "")),
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
  const source =
    Array.isArray(payload)
      ? payload
      : toRecord(payload) && Array.isArray(payload.results)
        ? payload.results
        : toRecord(payload) && Array.isArray(payload.items)
          ? payload.items
          : toRecord(payload) && Array.isArray(payload.data)
            ? payload.data
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
