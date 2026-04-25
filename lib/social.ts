export type ReactionType = "like" | "dislike" | null;

export interface Friend {
  id: number | string;
  username: string;
  avatarUrl: string | null;
}

export interface SocialComment {
  id: number | string;
  authorId: number | string | null;
  targetUserId: number | string | null;
  movieId: number | string | null;
  text: string;
  createdAt: string | null;
  authorName: string;
  authorUsername: string;
  authorAvatar: string | null;
  recipientName: string | null;
  counterpartName?: string | null;
  counterpartUsername?: string | null;
  counterpartId?: number | string | null;
  type: "public" | "directed";
  likesCount: number;
  dislikesCount: number;
  myReaction: ReactionType;
  direction?: "sent" | "received";
}

export interface PaginatedComments {
  comments: SocialComment[];
  next: string | null;
}

export interface UserIdentity {
  id: number | string | null;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
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
export const COMMENT_DETAIL_ENDPOINT_TEMPLATE =
  process.env.NEXT_PUBLIC_SOCIAL_COMMENT_DETAIL_ENDPOINT_TEMPLATE || "/comments/{id}/";

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

function normalizeUsername(value: unknown): string | null {
  const raw = toStringOrNull(value);
  if (!raw) return null;
  return raw.replace(/^@+/, "");
}

export function getUserIdentity(value: unknown): UserIdentity {
  const record = toRecord(value);
  if (!record) {
    return {
      id: null,
      username: null,
      displayName: null,
      avatar: null,
    };
  }

  const id =
    (pickFirst(
      record.id,
      record.user_id,
      record.userId,
      record.recipient_id,
      record.recipientId,
      record.counterpart_id,
      record.counterpartId,
      record.other_user_id,
      record.otherUserId,
    ) as number | string | null | undefined) ?? null;

  const username = normalizeUsername(
    pickFirst(
      record.username,
      record.user_name,
      record.userName,
      record.recipient_username,
      record.recipientUsername,
      record.counterpart_username,
      record.counterpartUsername,
      record.other_user_username,
      record.otherUserUsername,
      record.other_username,
      record.otherUsername,
    ),
  );

  const displayName = toStringOrNull(
    pickFirst(
      record.display_name,
      record.displayName,
      record.name,
      record.recipient_display_name,
      record.recipientDisplayName,
      record.recipient_name,
      record.recipientName,
      record.counterpart_display_name,
      record.counterpartDisplayName,
      record.counterpart_name,
      record.counterpartName,
      record.other_user_display_name,
      record.otherUserDisplayName,
      record.other_user_name,
      record.otherUserName,
      record.other_name,
      record.otherName,
    ),
  );

  const avatar = toStringOrNull(
    pickFirst(
      record.avatar,
      record.avatar_url,
      record.avatarUrl,
      record.profile_image,
      record.photo_url,
      record.recipient_avatar,
      record.recipientAvatar,
      record.counterpart_avatar,
      record.counterpartAvatar,
      record.other_user_avatar,
      record.otherUserAvatar,
      record.other_avatar,
      record.otherAvatar,
    ),
  );

  return {
    id,
    username,
    displayName,
    avatar,
  };
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

function normalizeDirection(value: unknown): "sent" | "received" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "sent" || normalized === "enviado" || normalized === "outgoing") return "sent";
  if (normalized === "received" || normalized === "recibido" || normalized === "incoming") return "received";
  return undefined;
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
      const username =
        normalizeUsername(
          pickFirst(
            friend.username,
            friend.user_name,
            friend.userName,
            friendship.username,
            friendship.user_name,
            friendship.userName,
          ),
        ) || `amigo-${index + 1}`;
      return {
        id: pickFirst(friend.id, friend.user_id, friendship.id, username) as number | string,
        username,
        avatarUrl: toStringOrNull(pickFirst(friend.avatar, friend.avatar_url, friend.profile_image, friend.photo_url)),
      };
    })
    .filter((friend) => friend.username.trim().length > 0);
}

function normalizeComment(raw: Record<string, unknown>, fallbackType: "public" | "directed"): SocialComment {
  const nestedAuthor = toRecord(pickFirst(raw.author, raw.user, raw.created_by, raw.sender, raw.from_user));
  const nestedRecipient = toRecord(
    pickFirst(raw.recipient, raw.mentioned_user, raw.mentionedUser, raw.target_user, raw.targetUser, raw.receiver, raw.to_user, raw.toUser),
  );
  const nestedCounterpart = toRecord(
    pickFirst(raw.counterpart, raw.conversation_user, raw.conversationUser, raw.other_user, raw.otherUser),
  );
  const nestedOtherUser = toRecord(pickFirst(raw.other_user, raw.otherUser));
  const recipientIdentity = getUserIdentity(nestedRecipient);
  const counterpartIdentity = getUserIdentity(nestedCounterpart);
  const otherUserIdentity = getUserIdentity(nestedOtherUser);
  const rootIdentity = getUserIdentity(raw);

  const authorUsername =
    normalizeUsername(pickFirst(nestedAuthor?.username, raw.author_username, raw.username, raw.sender_username, nestedAuthor?.name)) ||
    "usuario";
  const authorName =
    toStringOrNull(
      pickFirst(
        nestedAuthor?.display_name,
        nestedAuthor?.name,
        raw.author_display_name,
        raw.author_name,
        nestedAuthor?.username,
        raw.username,
      ),
    ) ||
    "Usuario";

  const recipientName = normalizeUsername(
    pickFirst(
      recipientIdentity.username,
      raw.recipient_username,
      raw.recipientUsername,
      raw.recipient_name,
      raw.recipientName,
      raw.target_user_username,
      raw.targetUserUsername,
      raw.target_username,
      raw.mentioned_username,
      raw.mentioned_user_username,
      counterpartIdentity.username,
      otherUserIdentity.username,
      rootIdentity.username,
      raw.counterpart_username,
      raw.counterpartUsername,
    ),
  );

  const counterpartUsername = normalizeUsername(
    pickFirst(
      counterpartIdentity.username,
      otherUserIdentity.username,
      recipientIdentity.username,
      rootIdentity.username,
      raw.counterpart_username,
      raw.counterpartUsername,
      raw.other_username,
      raw.counterpartUserName,
    ),
  );
  const counterpartName = toStringOrNull(
    pickFirst(
      counterpartIdentity.displayName,
      otherUserIdentity.displayName,
      recipientIdentity.displayName,
      rootIdentity.displayName,
      raw.counterpart_name,
      raw.counterpartName,
      raw.other_name,
      raw.otherName,
    ),
  );
  const counterpartId =
    (pickFirst(counterpartIdentity.id, otherUserIdentity.id, recipientIdentity.id, rootIdentity.id, raw.counterpart_id, raw.counterpartId, raw.other_user_id, raw.otherUserId) as
      | number
      | string
      | null
      | undefined) ?? null;

  const explicitType = toStringOrNull(pickFirst(raw.type, raw.comment_type, raw.visibility))?.toLowerCase();
  const type = explicitType === "directed" || explicitType === "private" ? "directed" : fallbackType;
  const direction = normalizeDirection(pickFirst(raw.direction, raw.message_direction, raw.comment_direction));

  return {
    id: (pickFirst(raw.id, raw.comment_id, raw.uuid) || `comment-${Math.random().toString(36).slice(2, 10)}`) as number | string,
    authorId: (pickFirst(nestedAuthor?.id, raw.author_id) as number | string | null | undefined) ?? null,
    targetUserId: (pickFirst(
      nestedRecipient?.id,
      raw.target_user_id,
      raw.targetUserId,
      raw.recipient_id,
      raw.recipientId,
      raw.mentioned_user_id,
      raw.mentionedUserId,
    ) as
      | number
      | string
      | null
      | undefined) ?? null,
    movieId: (pickFirst(raw.movie, raw.movie_id) as number | string | null | undefined) ?? null,
    text: String(pickFirst(raw.body, raw.text, raw.comment, raw.content, "")),
    createdAt: toStringOrNull(pickFirst(raw.created_at, raw.createdAt, raw.date, raw.timestamp)),
    authorName,
    authorUsername,
    authorAvatar: toStringOrNull(pickFirst(nestedAuthor?.avatar, nestedAuthor?.avatar_url, raw.author_avatar)),
    recipientName,
    counterpartName,
    counterpartUsername,
    counterpartId,
    type,
    likesCount: toCount(pickFirst(raw.likes_count, raw.like_count, raw.likes, raw.reactions_like_count)),
    dislikesCount: toCount(pickFirst(raw.dislikes_count, raw.dislike_count, raw.dislikes, raw.reactions_dislike_count)),
    myReaction: normalizeReaction(pickFirst(raw.my_reaction, raw.user_reaction, raw.current_reaction)),
    direction,
  };
}

export function parseComments(payload: unknown, fallbackType: "public" | "directed"): SocialComment[] {
  return parseCommentsPage(payload, fallbackType).comments;
}

export function parseCommentsPage(payload: unknown, fallbackType: "public" | "directed"): PaginatedComments {
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

  const comments = source
    .map((entry) => toRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => normalizeComment(entry, fallbackType));

  const next = toStringOrNull(pickFirst(root?.next, rootData?.next, root?.next_page, rootData?.next_page, root?.nextPage));

  return {
    comments,
    next,
  };
}

export function buildReactionEndpoint(commentId: number | string): string {
  return COMMENT_REACTION_ENDPOINT_TEMPLATE.replace("{id}", encodeURIComponent(String(commentId)));
}

export function buildCommentDetailEndpoint(commentId: number | string): string {
  return COMMENT_DETAIL_ENDPOINT_TEMPLATE.replace("{id}", encodeURIComponent(String(commentId)));
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
