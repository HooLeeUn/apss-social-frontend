export function shouldRenderActivityModerationMenu(activity) {
  return typeof activity.actorId === "number"
    ? Number.isFinite(activity.actorId)
    : typeof activity.actorId === "string" && activity.actorId.trim().length > 0;
}

export function getActivityCommentReportId(activity) {
  const hasCommentId = typeof activity.commentId === "number"
    ? Number.isFinite(activity.commentId)
    : typeof activity.commentId === "string" && activity.commentId.trim().length > 0;

  // `commentId` is normalized exclusively from structured payload fields. It can
  // identify either a comment activity's own comment or the original comment
  // referenced by a like/dislike activity.
  return hasCommentId && activity.isDirectedComment !== true ? activity.commentId : undefined;
}

export function shouldShowActivityContentReport(activity) {
  return getActivityCommentReportId(activity) !== undefined;
}
