"use client";

import { useEffect } from "react";
import type { Movie } from "../lib/movies";
import { formatSocialDate, type SocialComment } from "../lib/social";

interface NotificationCommentViewerProps {
  comment: SocialComment;
  movie: Movie;
  movieTitle: string;
  locale: "es" | "en";
  onClose: () => void;
  onMovieOpen: () => void;
}

export default function NotificationCommentViewer({ comment, movie, movieTitle, locale, onClose, onMovieOpen }: NotificationCommentViewerProps) {
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

  const authorLabel = comment.authorName || comment.authorUsername;
  const badge = comment.type === "public"
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
                {comment.authorAvatar ? <img src={comment.authorAvatar} alt={authorLabel} className="h-full w-full object-cover" /> : authorLabel.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{authorLabel}</p>
                {comment.authorUsername && comment.authorUsername !== authorLabel ? <p className="truncate text-xs text-zinc-400">@{comment.authorUsername}</p> : null}
                <p className="text-xs text-zinc-500">{formatSocialDate(comment.createdAt, locale, locale === "en" ? "No date" : "Sin fecha")}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300">{badge}</span>
          </div>
          <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-100 sm:text-base">{comment.text}</p>
          <div className="mt-5 flex items-center gap-4 border-t border-white/10 pt-4 text-sm text-zinc-300" aria-label={locale === "en" ? "Reaction counts" : "Contadores de reacciones"}>
            <span>👍 {comment.likesCount}</span>
            <span>👎 {comment.dislikesCount}</span>
          </div>
        </div>
      </article>
    </div>
  );
}
