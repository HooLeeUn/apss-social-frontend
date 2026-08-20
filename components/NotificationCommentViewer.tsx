"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import type { Movie } from "../lib/movies";
import { buildReactionEndpoint, formatSocialDate, type ReactionType, type SocialComment } from "../lib/social";
import ReactionButtons from "./social/ReactionButtons";

interface NotificationCommentViewerProps {
  comment: SocialComment;
  movie: Movie;
  movieTitle: string;
  locale: "es" | "en";
  allowReactions?: boolean;
  onClose: () => void;
  onMovieOpen: () => void;
}

export default function NotificationCommentViewer({ comment, movie, movieTitle, locale, allowReactions = false, onClose, onMovieOpen }: NotificationCommentViewerProps) {
  const [displayedComment, setDisplayedComment] = useState(comment);
  const [reacting, setReacting] = useState(false);
  const reactingRef = useRef(false);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const handleReact = async (commentId: number | string, reaction: ReactionType) => {
    if (!allowReactions || reactingRef.current) return;
    reactingRef.current = true;
    setReacting(true);
    try {
      const response = await apiFetch(
        buildReactionEndpoint(commentId),
        reaction === null
          ? { method: "DELETE" }
          : { method: "PUT", body: JSON.stringify({ reaction }) },
      ) as Record<string, unknown>;
      if (String(response.comment_id) !== String(commentId)) throw new Error("comment-reaction-id-mismatch");
      const likesCount = Number(response.likes_count);
      const dislikesCount = Number(response.dislikes_count);
      const rawMyReaction = typeof response.my_reaction === "string" ? response.my_reaction.toLowerCase() : null;
      const myReaction: ReactionType = rawMyReaction === "like" || rawMyReaction === "dislike" ? rawMyReaction : null;
      if (!Number.isFinite(likesCount) || !Number.isFinite(dislikesCount)) throw new Error("invalid-comment-reaction-response");
      setDisplayedComment((current) => ({ ...current, likesCount, dislikesCount, myReaction }));
    } catch (error) {
      console.error("Reaction request failed in notification comment modal", error);
    } finally {
      reactingRef.current = false;
      setReacting(false);
    }
  };

  const authorLabel = displayedComment.authorName || displayedComment.authorUsername;
  const badge = displayedComment.type === "public"
    ? (locale === "en" ? "Public comment" : "Comentario público")
    : (locale === "en" ? "Directed comment" : "Comentario dirigido");

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={locale === "en" ? "Comment from notification" : "Comentario de la notificación"}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <article className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-[0_24px_80px_rgba(0,0,0,0.75)]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-white/10 p-3 sm:p-4">
          <button type="button" onClick={onMovieOpen} aria-label={`${locale === "en" ? "Open" : "Abrir"} ${movieTitle}`} className="shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {movie.posterUrl ? <img src={movie.posterUrl} alt="" className="h-16 w-11 object-cover sm:h-20 sm:w-14" /> : <span className="flex h-16 w-11 items-center justify-center bg-zinc-800 text-lg text-zinc-500 sm:h-20 sm:w-14">🎬</span>}
          </button>
          <button type="button" onClick={onMovieOpen} className="min-w-0 flex-1 text-left text-base font-semibold text-zinc-100 hover:text-blue-200 hover:underline sm:text-lg">
            <span className="line-clamp-2">{movieTitle}</span>
          </button>
          <button type="button" onClick={onClose} aria-label={locale === "en" ? "Close comment" : "Cerrar comentario"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">×</button>
        </header>

        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-800 text-sm font-semibold text-zinc-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {displayedComment.authorAvatar ? <img src={displayedComment.authorAvatar} alt={authorLabel} className="h-full w-full object-cover" /> : authorLabel.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{authorLabel}</p>
                {displayedComment.authorUsername && displayedComment.authorUsername !== authorLabel ? <p className="truncate text-xs text-zinc-400">@{displayedComment.authorUsername}</p> : null}
                <p className="text-xs text-zinc-500">{formatSocialDate(displayedComment.createdAt, locale, locale === "en" ? "No date" : "Sin fecha")}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300">{badge}</span>
          </div>
          <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-100 sm:text-base">{displayedComment.text}</p>
          <div className="mt-5 flex items-center gap-4 border-t border-white/10 pt-4 text-sm text-zinc-300 [&_button]:cursor-pointer" aria-label={locale === "en" ? "Reaction counts" : "Contadores de reacciones"}>
            {allowReactions ? <ReactionButtons comment={displayedComment} onReact={handleReact} disabled={reacting} /> : <><span>👍 {displayedComment.likesCount}</span><span>👎 {displayedComment.dislikesCount}</span></>}
          </div>
        </div>
      </article>
    </div>
  );
}
