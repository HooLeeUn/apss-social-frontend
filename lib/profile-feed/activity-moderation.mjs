export function shouldRenderActivityModerationMenu(activity) {
  return typeof activity.actorId === "number"
    ? Number.isFinite(activity.actorId)
    : typeof activity.actorId === "string" && activity.actorId.trim().length > 0;
}

export function normalizeActivityCommentId(activity) {
  return activity.comment_id ?? activity.payload?.comment_id ?? null;
}

export function getActivityCommentReportId(activity) {
  const activityType = typeof activity.activityType === "string"
    ? activity.activityType.trim().toLowerCase()
    : typeof activity.activity_type === "string"
      ? activity.activity_type.trim().toLowerCase()
      : "";
  const reactionType = activity.reactionType ?? activity.reaction_type ?? activity.payload?.reaction_type;
  const isPublicComment = activityType === "public_comment";
  const isCurrentPublicReaction = activityType === "public_comment_reaction"
    && (reactionType === "like" || reactionType === "dislike");
  const isLegacyPublicReaction = activityType === "public_comment_like"
    || activityType === "public_comment_dislike";
  const commentId = activity.commentId ?? normalizeActivityCommentId(activity);
  const hasCommentId = typeof commentId === "number"
    ? Number.isFinite(commentId)
    : typeof commentId === "string" && commentId.trim().length > 0;

  return hasCommentId
    && activity.isDirectedComment !== true
    && (isPublicComment || isCurrentPublicReaction || isLegacyPublicReaction)
    ? commentId
    : undefined;
}

export function shouldShowActivityContentReport(activity) {
  return getActivityCommentReportId(activity) !== undefined;
}
