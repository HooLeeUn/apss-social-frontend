export function shouldRenderActivityModerationMenu(activity) {
  return activity.activityType === "public_comment"
    && activity.interactionType === "comment"
    && activity.isDirectedComment !== true
    && Boolean(activity.commentId)
    && Boolean(activity.actorId);
}
