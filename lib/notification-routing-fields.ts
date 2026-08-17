export type NotificationReactionType = "like" | "dislike" | null;

export interface NotificationRoutingFields {
  type: string | null;
  commentId: string | number | null;
  videoCommentId: string | number | null;
  reactionType: NotificationReactionType;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstPresent(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== ""));
}

function canonicalId(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

export function resolveNotificationType(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) return null;
  const candidates = [record.notification_type, record.notificationType, record.activity_type, record.activityType, record.type];
  const canonicalVideoReactionType = candidates.find(
    (candidate) => typeof candidate === "string" && candidate.trim().toLowerCase() === "video_comment_reaction",
  );
  const candidate = canonicalVideoReactionType ?? firstPresent(...candidates);
  return typeof candidate === "string" && candidate.trim() ? candidate.trim().toLowerCase() : null;
}

export function toNotificationPublicCommentId(value: unknown): string | number | null {
  const record = asRecord(value);
  const object = asRecord(record?.object);
  const objectComment = asRecord(object?.comment);
  const rootComment = asRecord(record?.comment);
  return canonicalId(firstPresent(objectComment?.id, object?.comment_id, object?.commentId, rootComment?.id, record?.comment_id, record?.commentId));
}

export function normalizeNotificationRoutingFields(value: unknown): NotificationRoutingFields {
  const record = asRecord(value);
  const object = asRecord(record?.object);
  const type = resolveNotificationType(record);
  const rawReaction = firstPresent(record?.reaction_type, record?.reaction_value);
  const normalizedReaction = typeof rawReaction === "string" ? rawReaction.trim().toLowerCase() : "";
  return {
    type,
    commentId: type === "public_comment_reaction" ? toNotificationPublicCommentId(record) : null,
    videoCommentId: type === "video_comment_reaction" ? canonicalId(firstPresent(object?.video_comment_id, object?.videoCommentId, record?.video_comment_id, record?.videoCommentId)) : null,
    reactionType: normalizedReaction === "like" || normalizedReaction === "dislike" ? normalizedReaction : null,
  };
}
