"use client";

import { useEffect, useRef, useState } from "react";
import { SocialActivityItem } from "../../lib/profile-feed/types";
import { ReactionType, SocialComment } from "../../lib/social";
import { applyReactionToCollection, applyReactionResultToCollection, requestCommentReaction } from "../../lib/comment-reactions";
import { useI18n } from "../../hooks/useI18n";
import { useAuthState } from "../../hooks/useAuthState";
import ReactionButtons from "../social/ReactionButtons";

function toComment(item: SocialActivityItem): SocialComment {
  return {
    id: item.commentId!, movieId: item.movieId ?? null, authorId: null, targetUserId: null,
    text: item.commentText ?? "", createdAt: item.createdAt, authorName: "", authorUsername: "",
    authorAvatar: null, recipientName: null, type: "public",
    likesCount: item.commentLikesCount ?? 0, dislikesCount: item.commentDislikesCount ?? 0,
    myReaction: item.commentMyReaction ?? null,
    authorRestrictedCurrentUser: false, recipientRestrictedCurrentUser: false,
  };
}

export default function VisitedProfileCommentReactions({ item }: { item: SocialActivityItem }) {
  const { t } = useI18n();
  const { isAuthenticated } = useAuthState();
  const [comment, setComment] = useState(() => toComment(item));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    pendingRef.current = false;
    setPending(false);
    setError("");
    setComment(toComment(item));
  }, [item]);

  const react = async (commentId: number | string, reaction: ReactionType) => {
    if (!isAuthenticated || pendingRef.current) return;
    pendingRef.current = true;
    const currentGeneration = generation.current;
    const previous = comment;
    setPending(true);
    setError("");
    setComment(applyReactionToCollection([comment], commentId, reaction)[0]);
    try {
      const response = await requestCommentReaction(commentId, reaction);
      if (generation.current === currentGeneration) {
        setComment((current) => applyReactionResultToCollection([current], commentId, response)[0]);
      }
    } catch {
      if (generation.current === currentGeneration) {
        setComment(previous);
        setError(t("movieDetailReactionError"));
      }
    } finally {
      if (generation.current === currentGeneration) {
        pendingRef.current = false;
        setPending(false);
      }
    }
  };

  return <div data-visited-comment-reactions className="min-w-0">
    <ReactionButtons comment={comment} onReact={react} disabled={!isAuthenticated || pending} />
    {error ? <p role="alert" className="mt-1 text-xs text-rose-300">{error}</p> : null}
  </div>;
}
