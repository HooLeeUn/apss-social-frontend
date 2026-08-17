import { MyNotificationItem } from "./profile-feed/types";

export function buildNotificationTargetRoute(item: MyNotificationItem): string {
  if (item.targetTab === "friend_requests_pending") return "/profile-feed?friendsTab=pending";
  if (item.movieId !== null && item.movieId !== "") {
    const movieRoute = `/movies/${encodeURIComponent(String(item.movieId))}`;
    if (item.type === "public_comment_reaction" && item.commentId !== null && item.commentId !== "") {
      const reaction = item.reactionType ? `&reaction=${encodeURIComponent(item.reactionType)}` : "";
      return `${movieRoute}?section=public-comments&commentId=${encodeURIComponent(String(item.commentId))}${reaction}`;
    }
    if (item.type === "video_comment_reaction" && item.videoCommentId !== null && item.videoCommentId !== "") {
      const reaction = item.reactionType ? `&reaction=${encodeURIComponent(item.reactionType)}` : "";
      return `${movieRoute}?target=video-reaction&targetId=${encodeURIComponent(String(item.videoCommentId))}${reaction}`;
    }
    if (
      item.targetTab === "private_inbox" &&
      item.directedCommentId !== null &&
      item.directedCommentId !== "" &&
      ((item.actorId !== null && item.actorId !== "") || item.actorUsername)
    ) {
      return `${movieRoute}?section=directed-comments${
        item.actorId !== null && item.actorId !== "" ? `&actorId=${encodeURIComponent(String(item.actorId))}` : ""
      }${item.actorUsername ? `&actorUsername=${encodeURIComponent(item.actorUsername)}` : ""}&commentId=${encodeURIComponent(String(item.directedCommentId))}`;
    }
    return movieRoute;
  }
  return item.targetTab === "private_inbox" ? "/profile-feed?tab=private_inbox" : "/profile-feed?tab=activity";
}
