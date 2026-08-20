"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { t as translate } from "../lib/i18n";
import type { Movie } from "../lib/movies";
import { buildMovieDirectedSubmitEndpoints, buildReactionEndpoint, formatSocialDate, type ReactionType, type SocialComment } from "../lib/social";
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
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const reactingRef = useRef(false);
  const replyingRef = useRef(false);
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
  const recipientUsername = displayedComment.authorUsername.trim().replace(/^@+/, "");
  const canReply = displayedComment.type === "directed" && displayedComment.authorId !== null && recipientUsername.length > 0;
  const badge = displayedComment.type === "public"
    ? (locale === "en" ? "Public comment" : "Comentario público")
    : (locale === "en" ? "Directed comment" : "Comentario dirigido");

  const handleReply = async () => {
    const body = replyText.trim();
    if (replyingRef.current || !body) return;
    if (!canReply) {
      setReplyStatus("error");
      return;
    }

    replyingRef.current = true;
    setReplyStatus("sending");
    const movieId = displayedComment.movieId ?? movie.id;
    const payload = { body, mentioned_username: recipientUsername, movie_id: String(movieId) };

    try {
      const endpoints = buildMovieDirectedSubmitEndpoints(movieId);
      for (let index = 0; index < endpoints.length; index += 1) {
        try {
          await apiFetch(endpoints[index], { method: "POST", body: JSON.stringify(payload) });
          setReplyText("");
          setReplyStatus("sent");
          return;
        } catch (error) {
          if (error instanceof ApiError && [404, 405].includes(error.status) && index < endpoints.length - 1) continue;
          throw error;
        }
      }
    } catch (error) {
      console.error("Directed reply request failed in notification comment modal", error);
      setReplyStatus("error");
    } finally {
      replyingRef.current = false;
    }
  };

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
          {displayedComment.type === "directed" ? (
            <form className="mt-4 border-t border-white/10 pt-4" onSubmit={(event) => { event.preventDefault(); void handleReply(); }}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea
                  value={replyText}
                  onChange={(event) => { setReplyText(event.target.value); setReplyStatus("idle"); }}
                  disabled={replyStatus === "sending"}
                  rows={2}
                  placeholder={translate(locale, "notificationReplyPlaceholder").replace("{username}", recipientUsername)}
                  aria-label={translate(locale, "notificationReplyPlaceholder").replace("{username}", recipientUsername)}
                  className="min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-blue-300 disabled:opacity-60"
                />
                <button type="submit" disabled={!canReply || !replyText.trim() || replyStatus === "sending"} className="min-h-11 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                  {replyStatus === "sending" ? translate(locale, "notificationReplySending") : translate(locale, "notificationReplyButton")}
                </button>
              </div>
              {replyStatus === "sent" ? <p role="status" className="mt-2 text-xs text-emerald-300">{translate(locale, "notificationReplySent")}</p> : null}
              {replyStatus === "error" ? <p role="alert" className="mt-2 text-xs text-rose-300">{translate(locale, "notificationReplyError")}</p> : null}
            </form>
          ) : null}
        </div>
      </article>
    </div>
  );
}
