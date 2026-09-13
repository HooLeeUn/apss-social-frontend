export function shouldRenderActivityModerationMenu(activity) {
  return typeof activity.actorId === "number"
    ? Number.isFinite(activity.actorId)
    : typeof activity.actorId === "string" && activity.actorId.trim().length > 0;
}

export function getActivityPublicCommentReportId(activity) {
  const hasCommentId = typeof activity.commentId === "number"
    ? Number.isFinite(activity.commentId)
    : typeof activity.commentId === "string" && activity.commentId.trim().length > 0;

  const isReportablePublicComment = activity.activityType === "public_comment"
    && activity.interactionType === "comment"
    && activity.isDirectedComment !== true
    && hasCommentId;

  return isReportablePublicComment ? activity.commentId : undefined;
}

export function shouldShowActivityContentReport(activity) {
  return getActivityPublicCommentReportId(activity) !== undefined;
}
