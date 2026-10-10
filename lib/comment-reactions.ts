import { apiFetch } from "./api";
import { buildReactionEndpoint } from "./social";
import { ReactionType, SocialComment } from "./social";

function toRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

export function applyReactionToCollection(
  collection: SocialComment[],
  commentId: number | string,
  nextReaction: ReactionType,
): SocialComment[] {
  return collection.map((comment) => {
    if (String(comment.id) !== String(commentId)) return comment;

    let likesCount = comment.likesCount;
    let dislikesCount = comment.dislikesCount;

    if (comment.myReaction === "like") likesCount = Math.max(0, likesCount - 1);
    if (comment.myReaction === "dislike") dislikesCount = Math.max(0, dislikesCount - 1);

    if (nextReaction === "like") likesCount += 1;
    if (nextReaction === "dislike") dislikesCount += 1;

    return {
      ...comment,
      myReaction: nextReaction,
      likesCount,
      dislikesCount,
    };
  });
}

export function applyReactionResultToCollection(
  collection: SocialComment[],
  commentId: number | string,
  payload: unknown,
): SocialComment[] {
  const record = toRecord(payload);
  if (!record) return collection;

  const payloadCommentId = record.comment_id;
  if (payloadCommentId === undefined || String(payloadCommentId) !== String(commentId)) {
    return collection;
  }

  const myReactionRaw = typeof record.my_reaction === "string" ? record.my_reaction.toLowerCase() : null;
  const myReaction: ReactionType = myReactionRaw === "like" || myReactionRaw === "dislike" ? myReactionRaw : null;
  const likesCount = typeof record.likes_count === "number" && Number.isFinite(record.likes_count) ? record.likes_count : null;
  const dislikesCount =
    typeof record.dislikes_count === "number" && Number.isFinite(record.dislikes_count) ? record.dislikes_count : null;

  if (likesCount === null || dislikesCount === null) return collection;

  return collection.map((comment) =>
    String(comment.id) === String(commentId)
      ? {
          ...comment,
          myReaction,
          likesCount,
          dislikesCount,
        }
      : comment,
  );
}

export function requestCommentReaction(commentId: number | string, reaction: ReactionType) {
  return apiFetch(buildReactionEndpoint(commentId), reaction === null
    ? { method: "DELETE" }
    : { method: "PUT", body: JSON.stringify({ reaction }) });
}
