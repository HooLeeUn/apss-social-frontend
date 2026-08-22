"use client";

import Link from "next/link";
import { TouchEvent, UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useInfiniteMyMessages } from "../../hooks/useInfiniteMyMessages";
import { useInfiniteScopedSocialActivity } from "../../hooks/useInfiniteScopedSocialActivity";
import { getMyProfile, getUserMovieRecommendationsByUsername, getUserProfileByUsername, markMyMessagesAsRead } from "../../lib/profile-feed/adapters";
import { MyMessageItem, SocialActivityItem, UserMovieRecommendation } from "../../lib/profile-feed/types";
import { formatAverageRating } from "../../lib/rating-format";
import { useI18n } from "../../hooks/useI18n";
import { formatProfileFeedRelativeDate, Locale, resolveMovieTitles, translateVisibleGenre, translateVisitedProfileMovieType } from "../../lib/i18n";
import { stripLeadingMention } from "../../lib/strip-leading-mention";
import EmptyStatePanel from "./EmptyStatePanel";
import { apiFetch } from "../../lib/api";
import VisitedProfileVideoReactions from "./VisitedProfileVideoReactions";

const MIN_VISIBLE_OWN_ACTIVITY_ITEMS = 8;
const MIN_VISIBLE_VISITED_ACTIVITY_ITEMS = 8;
const MAX_AUTO_LOAD_MORE_ATTEMPTS = 12;
const VISITED_PROFILE_METADATA_LABEL_CLASSNAME = "font-medium text-blue-200/85";
const VISITED_PROFILE_ACTIVITY_METADATA_LABEL_CLASSNAME = `${VISITED_PROFILE_METADATA_LABEL_CLASSNAME} text-[15px] md:text-base`;
const VISITED_PROFILE_RECOMMENDATION_METADATA_LABEL_CLASSNAME = `${VISITED_PROFILE_METADATA_LABEL_CLASSNAME} text-[13px]`;
const SWIPE_INTENT_MAX_GAP_MS = 520;
const SWIPE_INTENT_MIN_DISTANCE_PX = 42;
const SWIPE_INTENT_EDGE_DISTANCE_PX = 96;
const SWIPE_INTENT_REQUIRED_GESTURES = 3;

type VerticalDirection = -1 | 1;

type ActivityTouchGesture = {
  startY: number;
  previousY: number;
  startedAt: number;
  direction: VerticalDirection | null;
};

type SwipeIntent = {
  count: number;
  direction: VerticalDirection | null;
  endedAt: number;
  armedDirection: VerticalDirection | null;
};

function isIOSWebKitEnvironment(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function getActivityRelativeDate(item: SocialActivityItem): string {
  if (isReactionSummary(item)) return item.latestReactionAt ?? item.activityAt ?? item.updatedAt ?? item.createdAt;
  return item.activityAt ?? item.updatedAt ?? item.createdAt;
}

function isReactionSummary(item: SocialActivityItem): boolean {
  const type = normalizeActivityType(item);
  return type === "video_reactions_received_summary" || type === "comment_reactions_received_summary";
}

function getReactionSummaryText(item: SocialActivityItem, locale: Locale): string {
  const subject = normalizeActivityType(item) === "video_reactions_received_summary"
    ? (locale === "en" ? "Your video" : "Tu video")
    : (locale === "en" ? "Your comment" : "Tu comentario");
  const likes = item.likesCount ?? 0;
  const dislikes = item.dislikesCount ?? 0;
  if (likes > 0 && dislikes > 0) {
    return locale === "en"
      ? `${subject} received ${likes} ${likes === 1 ? "like" : "likes"} and ${dislikes} ${dislikes === 1 ? "dislike" : "dislikes"}.`
      : `${subject} tuvo ${likes} me gusta y ${dislikes} no me gusta.`;
  }
  if (likes > 0) return locale === "en" ? `${subject} received ${likes} ${likes === 1 ? "like" : "likes"}.` : `${subject} tuvo ${likes} me gusta.`;
  return locale === "en" ? `${subject} received ${dislikes} ${dislikes === 1 ? "dislike" : "dislikes"}.` : `${subject} tuvo ${dislikes} no me gusta.`;
}

function getActivityTitle(item: SocialActivityItem, isOwnProfile: boolean, locale: Locale): string {
  const activityType = normalizeActivityType(item);
  if (isReactionSummary(item)) return getReactionSummaryText(item, locale);
  if (activityType === "video_reaction_created") {
    return locale === "en" ? "You uploaded a video for:" : "Subiste un video para:";
  }
  if (activityType === "video_reaction_received") {
    const actor = item.reactionActorUsername || item.user.username;
    return item.reactionValue === "dislike"
      ? locale === "en" ? `${actor} disliked your video` : `A ${actor} no le gustó tu video`
      : locale === "en" ? `${actor} liked your video` : `A ${actor} le gustó tu video`;
  }
  if (activityType === "video_reaction_given") {
    const owner = item.videoOwnerUsername || item.likedCommentAuthorUsername || (locale === "en" ? "another user" : "otro usuario");
    return item.reactionValue === "dislike"
      ? locale === "en" ? `You disliked ${owner}'s video` : `No te gustó el video de ${owner}`
      : locale === "en" ? `You liked ${owner}'s video` : `Te gustó el video de ${owner}`;
  }
  const safeMovieTitle = item.movieTitle || (locale === "en" ? "title" : "título");
  const ratedVerb = isOwnProfile ? (locale === "en" ? "You rated" : "Calificaste") : (locale === "en" ? "Rated" : "Calificó");
  const commentedVerb = isOwnProfile ? (locale === "en" ? "Commented on" : "Comentaste") : (locale === "en" ? "Commented" : "Comentó");
  const directedTarget = item.directedCommentTargetUsername ? ` a @${item.directedCommentTargetUsername}` : "";

  if (item.interactionType === "rating") {
    const score = item.ratingValue !== undefined ? formatAverageRating(item.ratingValue) : (locale === "en" ? "no score" : "sin nota");
    return locale === "en" ? `${ratedVerb} this movie ${score}` : `${ratedVerb} con ${score} esta película`;
  }

  if (item.interactionType === "comment") {
    if (item.isDirectedComment) {
      return isOwnProfile
        ? locale === "en" ? `You sent a private message about ${safeMovieTitle}${directedTarget}` : `Enviaste un mensaje privado sobre ${safeMovieTitle}${directedTarget}`
        : locale === "en" ? `Sent a private message about ${safeMovieTitle}${directedTarget}` : `Envió un mensaje privado sobre ${safeMovieTitle}${directedTarget}`;
    }
    return isOwnProfile ? (locale === "en" ? "You commented:" : "Comentaste:") : `${commentedVerb} ${safeMovieTitle}`;
  }

  const reactionActor = item.reactionActorUsername || item.user.username || (locale === "en" ? "another user" : "otro usuario");
  const commentAuthor = item.likedCommentAuthorUsername || (locale === "en" ? "another user" : "otro usuario");

  const reactionValue = item.reactionValue || (item.interactionType === "like" || item.interactionType === "dislike" ? item.interactionType : null);
  if (reactionValue === "dislike") {
    if (item.isGivenReaction) {
      return locale === "en" ? `You disliked the comment from ${commentAuthor}` : `No te gustó el comentario de ${commentAuthor}`;
    }
    if (item.isReceivedReaction) {
      return locale === "en" ? `${reactionActor} disliked your comment` : `A ${reactionActor} no le gustó tu comentario`;
    }
    return locale === "en" ? `${isOwnProfile ? "You disliked" : "Disliked"} the comment from ${commentAuthor}` : `${isOwnProfile ? "No te gustó" : "No le gustó"} el comentario de ${commentAuthor}`;
  }

  if (reactionValue === "like" && item.isGivenReaction) {
    return locale === "en" ? `You liked the comment from ${commentAuthor}` : `Te gustó el comentario de ${commentAuthor}`;
  }
  if (reactionValue === "like" && item.isReceivedReaction) {
    return locale === "en" ? `${reactionActor} liked your comment` : `A ${reactionActor} le gustó tu comentario`;
  }
  if (reactionValue === "like") {
    return locale === "en" ? `${isOwnProfile ? "You liked" : "Liked"} the comment from ${commentAuthor}` : `${isOwnProfile ? "Te gustó" : "Le gustó"} el comentario de ${commentAuthor}`;
  }
  return locale === "en" ? "You reacted to a comment" : "Reaccionaste a un comentario";
}

function getActivityDetail(item: SocialActivityItem, locale: Locale): string | null {
  if (normalizeActivityType(item) === "comment_reactions_received_summary") return item.commentText ?? null;
  if (isReactionSummary(item)) return null;
  if (normalizeActivityType(item).startsWith("video_reaction_")) return null;
  if (item.interactionType === "rating") {
    return null;
  }

  if (item.interactionType === "comment") {
    if (item.isDirectedComment) {
      return stripLeadingMention(item.commentText || (locale === "en" ? "You sent a private comment." : "Enviaste un comentario privado."));
    }
    return item.commentText || (locale === "en" ? "You left a public comment." : "Dejaste un comentario público.");
  }

  return item.likedCommentSnippet || item.movieTitle;
}

function joinMetadataParts(parts: ReactNode[]): ReactNode {
  return parts.map((part, index) => (
    <span key={`metadata-part-${index}`}>
      {index > 0 ? " · " : ""}
      {part}
    </span>
  ));
}

function formatMetadata(movieType?: string, movieGenre?: string, movieYear?: number | null, locale: Locale = "es", translateForVisitedProfile = false): ReactNode {
  const typeValue = translateVisitedProfileMovieType(locale, movieType)?.toLocaleLowerCase();
  const genreValue = translateVisibleGenre(locale, movieGenre);
  const typeLabel = locale === "en" ? "Type:" : "Tipo:";
  const genreLabel = locale === "en" ? "Genre:" : "Género:";

  if (!translateForVisitedProfile) {
    const values = [
      typeValue && typeValue !== "-" ? typeValue : null,
      genreValue && genreValue !== "-" ? genreValue : null,
      movieYear ? String(movieYear) : null,
    ].filter(Boolean);
    return values.length > 0 ? values.join(" · ") : (locale === "en" ? "No metadata" : "Sin metadata");
  }

  const values = [
    typeValue && typeValue !== "-" ? (
      <>
        <span className={VISITED_PROFILE_ACTIVITY_METADATA_LABEL_CLASSNAME}>{typeLabel}</span> {typeValue}
      </>
    ) : null,
    genreValue && genreValue !== "-" ? (
      <>
        <span className={VISITED_PROFILE_ACTIVITY_METADATA_LABEL_CLASSNAME}>{genreLabel}</span> {genreValue}
      </>
    ) : null,
    movieYear ? String(movieYear) : null,
  ].filter(Boolean) as ReactNode[];

  return values.length > 0 ? joinMetadataParts(values) : (locale === "en" ? "No metadata" : "Sin metadata");
}

function getRecommendationTitles(movie: UserMovieRecommendation, locale: Locale) {
  return resolveMovieTitles(locale, movie.titleSpanish, movie.titleEnglish, movie.titleSpanish);
}

function formatRecommendationMetadata(movie: UserMovieRecommendation, locale: Locale): ReactNode {
  const typeLabel = locale === "en" ? "Type:" : "Tipo:";
  const genreLabel = locale === "en" ? "Genre:" : "Género:";
  return (
    <>
      <span className={VISITED_PROFILE_RECOMMENDATION_METADATA_LABEL_CLASSNAME}>{genreLabel}</span> {translateVisibleGenre(locale, movie.genre)} ·{" "}
      <span className={VISITED_PROFILE_RECOMMENDATION_METADATA_LABEL_CLASSNAME}>{typeLabel}</span> {translateVisitedProfileMovieType(locale, movie.type)} · {movie.releaseYear}
    </>
  );
}

function getVisitedActionMessage(item: SocialActivityItem, locale: Locale): string | null {
  if (item.interactionType === "rating") {
    const score = item.ratingValue !== undefined ? formatAverageRating(item.ratingValue) : (locale === "en" ? "no score" : "sin nota");
    return locale === "en" ? `Rated this movie ${score}` : `Calificó con ${score} esta película`;
  }

  if (item.interactionType === "like") {
    return locale === "en" ? `Liked this comment from ${item.likedCommentAuthorUsername || "another user"}` : `Le gustó este comentario de ${item.likedCommentAuthorUsername || "otro usuario"}`;
  }

  if (item.interactionType === "dislike") {
    return locale === "en" ? `Disliked this comment from ${item.likedCommentAuthorUsername || "another user"}` : `No le gustó este comentario de ${item.likedCommentAuthorUsername || "otro usuario"}`;
  }

  return null;
}

function getExpandableTextKey(item: SocialActivityItem, text: string, type: string): string {
  const movieId = item.movieId !== undefined && item.movieId !== null ? String(item.movieId) : "movie";
  const timestamp = item.activityAt ?? item.updatedAt ?? item.createdAt;
  return `${movieId}-${type}-${timestamp}-${text.slice(0, 24)}`;
}

function ExpandableMobileText({
  text,
  item,
  type,
  className = "",
}: {
  text: string;
  item: SocialActivityItem;
  type: string;
  className?: string;
}) {
  const { locale } = useI18n();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const textKey = getExpandableTextKey(item, text, type);
  const isExpanded = expandedKeys.has(textKey);
  const canToggle = text.trim().length > 90;

  const toggleExpanded = () => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(textKey)) {
        next.delete(textKey);
      } else {
        next.add(textKey);
      }
      return next;
    });
  };

  return (
    <div className="min-w-0 flex-1">
      <p className={`${isExpanded ? "" : "line-clamp-2 md:line-clamp-none"} ${className}`}>{text}</p>
      {canToggle ? (
        <button
          type="button"
          onClick={toggleExpanded}
          className="mt-0.5 text-xs font-medium text-blue-200 transition hover:text-blue-100 md:hidden"
          aria-expanded={isExpanded}
        >
          {isExpanded ? (locale === "en" ? "less" : "menos") : (locale === "en" ? "more" : "más")}
        </button>
      ) : null}
    </div>
  );
}

function CommentBubbleIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.9">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17.4 3.6 20v-4.2A7.8 7.8 0 0 1 2.7 12a8.8 8.8 0 0 1 17.6 0A8.8 8.8 0 0 1 11.5 20c-1.6 0-3.1-.4-4.5-1.2Z" />
    </svg>
  );
}

function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.9">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 3.2 2.7 5.4 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.5l6-.9L12 3.2Z"
      />
    </svg>
  );
}

function ThumbsUpIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.9">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 10.2V5.4c0-1.6 1-2.9 2.4-3.5l.3-.1v5.8h4.4a2 2 0 0 1 1.9 2.5l-1.7 6.6A2.2 2.2 0 0 1 15.5 19H8.1V10.2h2.2Zm-2.2 0H4.6A1.6 1.6 0 0 0 3 11.8v5.6A1.6 1.6 0 0 0 4.6 19h3.5"
      />
    </svg>
  );
}

function ThumbsDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.9">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 13.8v4.8c0 1.6 1 2.9 2.4 3.5l.3.1v-5.8h4.4a2 2 0 0 0 1.9-2.5l-1.7-6.6A2.2 2.2 0 0 0 15.5 5H8.1v8.8h2.2Zm-2.2 0H4.6A1.6 1.6 0 0 1 3 12.2V6.6A1.6 1.6 0 0 1 4.6 5h3.5"
      />
    </svg>
  );
}

function PlayIcon({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="12" cy="12" r="9" /><path fill="currentColor" stroke="none" d="m10 8 6 4-6 4Z" /></svg>;
}

type ActivityVideoReaction = "like" | "dislike";
type ReactionSummaryState = Pick<SocialActivityItem, "likesCount" | "dislikesCount" | "usersWhoLiked" | "usersWhoDisliked">;
type ActivityVideoState = {
  activityId?: string;
  activityType?: string;
  url: string;
  commentId?: string;
  likesCount?: number;
  dislikesCount?: number;
  myReaction?: ActivityVideoReaction | null;
  canDelete?: boolean;
};
type ActivityVideoOpenRequest = { movieId: string; activityType?: string; video: ActivityVideoState };
type CanonicalVideoReaction = { likesCount: number; dislikesCount: number; myReaction: ActivityVideoReaction | null; canDelete: boolean };
type CanonicalVideoReactionPage = {
  next?: string | null;
  results?: Array<{ id: string | number; likes_count: number; dislikes_count: number; my_reaction: ActivityVideoReaction | null; can_delete: boolean }>;
};

type VideoCommentReactionData = {
  video_comment_id?: string | number;
  likes_count?: number;
  dislikes_count?: number;
  my_reaction?: ActivityVideoReaction | null;
};

function normalizeVideoCommentReactionData(data: VideoCommentReactionData): { likesCount: number; dislikesCount: number; myReaction: ActivityVideoReaction | null } {
  const likesCount = Number(data.likes_count ?? 0);
  const dislikesCount = Number(data.dislikes_count ?? 0);
  return {
    likesCount: Number.isFinite(likesCount) ? likesCount : 0,
    dislikesCount: Number.isFinite(dislikesCount) ? dislikesCount : 0,
    myReaction: data.my_reaction === "like" || data.my_reaction === "dislike" ? data.my_reaction : null,
  };
}

function normalizeCanonicalVideoReactionNext(next: string | null | undefined): string | null {
  if (!next) return null;
  try {
    const url = new URL(next, window.location.origin);
    const apiIndex = url.pathname.indexOf("/api/");
    return `${apiIndex >= 0 ? url.pathname.slice(apiIndex + 4) : url.pathname}${url.search}`;
  } catch {
    return next.startsWith("/api/") ? next.slice(4) : next;
  }
}

async function resolveCanonicalVideoReaction(movieId: string, videoCommentId: string): Promise<CanonicalVideoReaction | null> {
  let endpoint: string | null = `/movies/${encodeURIComponent(movieId)}/video-comments/`;
  while (endpoint) {
    console.log("CANONICAL REQUEST", { endpoint, movieId, videoCommentId });
    const page = await apiFetch(endpoint) as CanonicalVideoReactionPage;
    console.log("CANONICAL PAGE", { endpoint, next: page.next, ids: page.results?.map((video) => video.id) });
    const match = page.results?.find((video) => String(video.id) === videoCommentId);
    if (match) {
      console.log("CANONICAL MATCH", {
        requestedVideoCommentId: videoCommentId,
        canonicalId: match.id,
        likes_count: match.likes_count,
        dislikes_count: match.dislikes_count,
        my_reaction: match.my_reaction,
      });
      const likesCount = Number(match.likes_count);
      const dislikesCount = Number(match.dislikes_count);
      if (!Number.isFinite(likesCount) || !Number.isFinite(dislikesCount)) {
        console.warn("Canonical activity video reaction has invalid counts.", { movieId, videoCommentId });
        return null;
      }
      return {
        likesCount,
        dislikesCount,
        myReaction: match.my_reaction === "like" || match.my_reaction === "dislike" ? match.my_reaction : null,
        canDelete: match.can_delete === true,
      };
    }
    endpoint = normalizeCanonicalVideoReactionNext(page.next);
  }
  console.error("CANONICAL VIDEO NOT FOUND", { movieId, videoCommentId });
  return null;
}

function ActivityVideoReactionButtons({ data, disabled, onReact }: { data: Required<Pick<ActivityVideoState, "likesCount" | "dislikesCount">> & Pick<ActivityVideoState, "myReaction">; disabled: boolean; onReact: (reaction: ActivityVideoReaction) => void }) {
  return <div className="flex items-center gap-1">
    {(["like", "dislike"] as const).map((reaction) => {
      const selected = data.myReaction === reaction;
      return <button key={reaction} type="button" disabled={disabled} aria-label={reaction === "like" ? "Like" : "Dislike"} aria-pressed={selected} className={`min-h-9 rounded-full px-2 py-1.5 text-sm font-semibold leading-none transition [text-shadow:0_1px_3px_rgb(0_0_0/0.9)] disabled:opacity-50 ${selected ? reaction === "like" ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200" : "bg-transparent text-white hover:bg-white/10"}`} onClick={(event) => { event.stopPropagation(); onReact(reaction); }}>
        <span aria-hidden="true">{reaction === "like" ? "👍" : "👎"}</span> {reaction === "like" ? data.likesCount : data.dislikesCount}
      </button>;
    })}
  </div>;
}

function ActivityVideoModal({ video, onClose, onReactionUpdated, onDeleted }: { video: ActivityVideoState; onClose: () => void; onReactionUpdated?: (video: ActivityVideoState, reaction: ReturnType<typeof normalizeVideoCommentReactionData>) => void; onDeleted: (commentId: string) => void }) {
  const { locale, t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reactionData, setReactionData] = useState({
    likesCount: video.likesCount ?? 0,
    dislikesCount: video.dislikesCount ?? 0,
    myReaction: video.myReaction ?? null,
  });
  const reactingRef = useRef(false);
  const [deleteMenuOpen, setDeleteMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reactToVideo = useCallback((reaction: ActivityVideoReaction) => {
    if (!video.commentId || reactingRef.current) return;
    reactingRef.current = true;
    void apiFetch(`/video-comments/${encodeURIComponent(video.commentId)}/reaction/`, { method: "PUT", body: JSON.stringify({ reaction }) })
      .then((result) => {
        if (!result || typeof result !== "object") return;
        const data = result as VideoCommentReactionData;
        const normalizedReaction = normalizeVideoCommentReactionData(data);
        setReactionData(normalizedReaction);
        onReactionUpdated?.(video, normalizedReaction);
      })
      .catch(() => undefined)
      .finally(() => { reactingRef.current = false; });
  }, [onReactionUpdated, video]);

  const deleteVideo = useCallback(() => {
    if (!video.commentId || !video.canDelete || deleting) return;
    setDeleting(true);
    void apiFetch(`/video-comments/${encodeURIComponent(video.commentId)}/`, { method: "DELETE" })
      .then(() => onDeleted(video.commentId!))
      .catch(() => undefined)
      .finally(() => setDeleting(false));
  }, [deleting, onDeleted, video.canDelete, video.commentId]);

  useEffect(() => {
    const element = videoRef.current;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      if (element) {
        element.pause();
        element.muted = true;
        element.removeAttribute("src");
        element.load();
      }
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={locale === "en" ? "Video reaction" : "Video reacción"} onClick={onClose}>
      <div className="relative w-full max-w-2xl" onClick={(event) => event.stopPropagation()} data-video-comment-id={video.commentId}>
        <button type="button" onClick={onClose} aria-label={locale === "en" ? "Close video" : "Cerrar video"} className="absolute -right-1 -top-11 rounded-full border border-white/20 bg-zinc-900/90 px-3 py-1.5 text-lg text-white hover:bg-zinc-800">×</button>
        <div className="relative mx-auto w-fit max-w-full">
          <video ref={videoRef} src={video.url} controls controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback autoPlay playsInline className="block max-h-[82vh] max-w-full rounded-xl bg-black object-contain shadow-2xl" />
          <div className="absolute left-3 top-3 z-20 bg-transparent">
            <ActivityVideoReactionButtons data={reactionData} disabled={!video.commentId} onReact={reactToVideo} />
          </div>
          {video.canDelete ? <div className="absolute right-3 top-3 z-20"><button type="button" disabled={deleting} aria-label={t("movieDetailVideoDelete")} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-xl text-zinc-200 hover:bg-black/90 disabled:opacity-50" onClick={(event) => { event.stopPropagation(); setDeleteMenuOpen((current) => !current); }}>⋮</button>{deleteMenuOpen ? <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-white/10 bg-zinc-950 p-1 shadow-xl"><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-200 hover:bg-white/10" onClick={() => { setDeleteMenuOpen(false); setDeleteConfirmOpen(true); }}>{t("movieDetailVideoDelete")}</button></div> : null}</div> : null}
        </div>
      </div>
      {deleteConfirmOpen ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4" onClick={(event) => event.stopPropagation()}><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-5 text-center shadow-2xl"><p className="text-sm font-semibold text-zinc-100">{t("movieDetailVideoDeleteConfirm")}</p><div className="mt-5 flex gap-3"><button type="button" className="flex-1 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-100" onClick={() => setDeleteConfirmOpen(false)}>{t("movieDetailVideoCancel")}</button><button type="button" disabled={deleting} className="flex-1 rounded-xl bg-red-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50" onClick={() => { setDeleteConfirmOpen(false); deleteVideo(); }}>{t("movieDetailVideoDeleteAction")}</button></div></div></div> : null}
    </div>
  );
}

function ReactionSummaryModal({ summary, myUsername, onClose }: { summary: ReactionSummaryState; myUsername?: string | null; onClose: () => void }) {
  const { locale } = useI18n();
  const likes = summary.likesCount ?? 0;
  const dislikes = summary.dislikesCount ?? 0;
  const [tab, setTab] = useState<ActivityVideoReaction>(likes > 0 ? "like" : "dislike");
  const users = tab === "like" ? (summary.usersWhoLiked ?? []) : (summary.usersWhoDisliked ?? []);
  const count = tab === "like" ? likes : dislikes;
  const heading = locale === "en"
    ? tab === "like" ? `${count} ${count === 1 ? "person likes" : "people like"} this` : `${count} ${count === 1 ? "person dislikes" : "people dislike"} this`
    : tab === "like" ? `${count} ${count === 1 ? "persona le gusta" : "personas les gusta"}` : `${count} ${count === 1 ? "persona no le gusta" : "personas no les gusta"}`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={locale === "en" ? "Reaction details" : "Detalle de reacciones"} onClick={onClose}>
    <div className="relative flex max-h-[min(520px,calc(100dvh-2rem))] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={onClose} aria-label={locale === "en" ? "Close" : "Cerrar"} className="absolute right-3 top-2 z-10 rounded-full p-1.5 text-xl leading-none text-zinc-300 transition hover:bg-white/10 hover:text-white">×</button>
      <div className="grid grid-cols-2 border-b border-white/10 pr-10">
        {(["like", "dislike"] as const).map((value) => <button key={value} type="button" onClick={() => setTab(value)} className={`px-3 py-3 text-sm font-medium transition ${tab === value ? "border-b-2 border-blue-300 text-blue-100" : "text-zinc-400 hover:text-zinc-200"}`}><span aria-hidden="true">{value === "like" ? "👍" : "👎"}</span> {value === "like" ? (locale === "en" ? "Likes" : "Me gusta") : (locale === "en" ? "Dislikes" : "No me gusta")}</button>)}
      </div>
      <div className="min-h-0 overflow-y-auto px-4 py-3">
        <p className="mb-2 text-sm font-medium text-zinc-200">{heading}</p>
        <ul className="divide-y divide-white/10">
          {users.map((user) => {
            const isMe = user.username.trim().toLocaleLowerCase() === myUsername?.trim().toLocaleLowerCase();
            const href = isMe ? "/profile-feed" : `/users/${encodeURIComponent(user.username)}`;
            return <li key={`${tab}-${user.id}`}><Link href={href} onClick={onClose} className="flex items-center gap-3 py-2.5 text-sm text-zinc-100 transition hover:text-blue-200">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-white/10 object-cover" />
              ) : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold">{user.username.slice(0, 2).toUpperCase()}</span>}
              <span className="min-w-0 truncate font-medium">@{user.username}</span>
            </Link></li>;
          })}
        </ul>
      </div>
    </div>
  </div>;
}

function isUserProfileVisitable(profileAccess?: string | null, canViewFullProfile?: boolean | null): boolean {
  const normalizedProfileAccess = profileAccess?.trim().toLocaleLowerCase();
  const hasLimitedAccess =
    canViewFullProfile === false ||
    normalizedProfileAccess === "restricted" ||
    normalizedProfileAccess === "limited" ||
    normalizedProfileAccess === "private";

  return !hasLimitedAccess;
}

function isPublicOwnActivityItem(item: SocialActivityItem, myUsername?: string | null): boolean {
  if (item.scope === "private_inbox") return false;
  if (item.isDirectedComment) return false;

  const activityType = normalizeActivityType(item);
  if (activityType === "video_reaction_created" || activityType === "video_reaction_received" || activityType === "video_reaction_given" || activityType === "video_reactions_received_summary" || activityType === "comment_reactions_received_summary") return true;
  if (
    activityType === "public_comment_reaction" ||
    activityType === "public_comment_like" ||
    activityType === "public_comment_dislike"
  ) {
    const normalizedMyUsername = normalizeUsername(myUsername);
    if (!normalizedMyUsername) return false;

    return (
      normalizeUsername(item.user.username) === normalizedMyUsername ||
      normalizeUsername(item.reactionActorUsername) === normalizedMyUsername ||
      normalizeUsername(item.likedCommentAuthorUsername) === normalizedMyUsername ||
      normalizeUsername(item.directedCommentTargetUsername) === normalizedMyUsername ||
      item.isGivenReaction === true ||
      item.isReceivedReaction === true
    );
  }

  if (item.interactionType === "comment") return item.scope === "activity";
  if (item.interactionType === "like" || item.interactionType === "dislike") {
    return item.scope === "activity" && item.reactionScope === "public";
  }

  return false;
}

function isOwnRatingActivityItem(item: SocialActivityItem, myUsername?: string | null): boolean {
  if (item.interactionType !== "rating") return false;

  const normalizedMyUsername = myUsername?.trim().toLocaleLowerCase();
  if (!normalizedMyUsername) return true;

  return item.user.username.trim().toLocaleLowerCase() === normalizedMyUsername;
}

function normalizeUsername(value?: string | null): string {
  return value?.trim().toLocaleLowerCase() || "";
}

function normalizeActivityType(item: SocialActivityItem): string {
  return item.activityType?.trim().toLocaleLowerCase() || "";
}

function isVisitedActorItem(item: SocialActivityItem, viewedUsername: string): boolean {
  const expected = normalizeUsername(viewedUsername);
  if (!expected) return false;
  return normalizeUsername(item.user.username) === expected;
}

function isVisitedPublicCommentItem(item: SocialActivityItem): boolean {
  return normalizeActivityType(item) === "public_comment";
}

function isVisitedRatingItem(item: SocialActivityItem): boolean {
  return normalizeActivityType(item) === "rating";
}

function isVisitedPublicReactionItem(item: SocialActivityItem): boolean {
  const type = normalizeActivityType(item);
  return type === "public_comment_reaction" || type === "public_comment_like" || type === "public_comment_dislike";
}

function ActivityRow({
  item,
  isOwnProfile,
  visitedActivityTab,
  viewedUsername,
  myUsername,
  authorCanVisitByUsername,
  onOpenVideo,
  onOpenReactionSummary,
}: {
  item: SocialActivityItem;
  isOwnProfile: boolean;
  visitedActivityTab?: "public_comments" | "ratings" | "reactions" | "recommendations";
  viewedUsername?: string;
  myUsername?: string | null;
  authorCanVisitByUsername?: Record<string, boolean>;
  onOpenVideo?: (request: ActivityVideoOpenRequest) => void;
  onOpenReactionSummary?: (summary: ReactionSummaryState) => void;
}) {
  const { locale, t } = useI18n();
  const hasMovieId = item.movieId !== undefined && item.movieId !== null && String(item.movieId).trim() !== "";
  const movieHref = hasMovieId ? `/movies/${encodeURIComponent(String(item.movieId))}` : null;
  const activityDetail = getActivityDetail(item, locale);
  const visitedActionMessage = getVisitedActionMessage(item, locale);
  const isVisitedProfile = !isOwnProfile;
  const normalizedMyUsername = myUsername?.trim().toLocaleLowerCase() || "";
  const normalizedAuthorUsername = item.likedCommentAuthorUsername?.trim().toLocaleLowerCase() || "";
  const authorIsCurrentUser =
    Boolean(normalizedMyUsername) && Boolean(normalizedAuthorUsername) && normalizedAuthorUsername === normalizedMyUsername;
  const shouldRenderAuthorLink = Boolean(normalizedAuthorUsername && authorCanVisitByUsername?.[normalizedAuthorUsername]);
  const reactionValue = item.reactionValue || (item.interactionType === "like" || item.interactionType === "dislike" ? item.interactionType : null);
  const reactionMessage =
    reactionValue === "like"
      ? authorIsCurrentUser
        ? locale === "en" ? `${viewedUsername || "this user"} liked your comment` : `A ${viewedUsername || "este usuario"} le gustó tu comentario`
        : locale === "en" ? `${viewedUsername || "this user"} liked the comment from` : `A ${viewedUsername || "este usuario"} le gustó el comentario de`
      : reactionValue === "dislike"
        ? authorIsCurrentUser
          ? locale === "en" ? `${viewedUsername || "this user"} disliked your comment` : `A ${viewedUsername || "este usuario"} no le gustó tu comentario`
          : locale === "en" ? `${viewedUsername || "this user"} disliked the comment from` : `A ${viewedUsername || "este usuario"} no le gustó el comentario de`
        : locale === "en" ? `${viewedUsername || "this user"} reacted to the comment from` : `A ${viewedUsername || "este usuario"} reaccionó al comentario de`;
  const ownActivityIconClassName = "h-5 w-5 shrink-0";
  const activityType = normalizeActivityType(item);
  const isVideoCreated = activityType === "video_reaction_created";
  const isVideoSummary = activityType === "video_reactions_received_summary";
  const isVideoGiven = activityType === "video_reaction_given";
  const isSummary = isReactionSummary(item);
  const localizedTitle = resolveMovieTitles(locale, item.movieTitleSpanish, item.movieTitleEnglish, item.movieTitle).primary;
  const selectedVideo = item.videoUrl ? {
    activityId: item.id,
    activityType,
    url: item.videoUrl,
    commentId: item.videoCommentId,
    likesCount: isVideoSummary ? item.likesCount : item.videoLikesCount,
    dislikesCount: isVideoSummary ? item.dislikesCount : item.videoDislikesCount,
    myReaction: item.videoMyReaction ?? (isVideoGiven ? item.reactionValue : null),
  } satisfies ActivityVideoState : null;
  const openSelectedVideo = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (selectedVideo && hasMovieId) onOpenVideo?.({ movieId: String(item.movieId), activityType: item.activityType, video: selectedVideo });
  };
  const ownActivityIcon =
    isSummary ? (
      <div className="flex items-center gap-1" aria-label={locale === "en" ? "Likes and dislikes received" : "Me gusta y no me gusta recibidos"}>
        {isVideoSummary && selectedVideo ? <>
          <button type="button" onClick={openSelectedVideo} aria-label={locale === "en" ? `Play liked video for ${localizedTitle}` : `Reproducir video con me gusta de ${localizedTitle}`} className={`cursor-pointer transition ${(item.likesCount ?? 0) > 0 ? "text-emerald-300/90 hover:text-emerald-200" : "text-zinc-600 hover:text-zinc-400"}`}><ThumbsUpIcon className={ownActivityIconClassName} /></button>
          <button type="button" onClick={openSelectedVideo} aria-label={locale === "en" ? `Play disliked video for ${localizedTitle}` : `Reproducir video con no me gusta de ${localizedTitle}`} className={`cursor-pointer transition ${(item.dislikesCount ?? 0) > 0 ? "text-rose-300/90 hover:text-rose-200" : "text-zinc-600 hover:text-zinc-400"}`}><ThumbsDownIcon className={ownActivityIconClassName} /></button>
        </> : <>
          <ThumbsUpIcon className={`${ownActivityIconClassName} ${(item.likesCount ?? 0) > 0 ? "text-emerald-300/90" : "text-zinc-600"}`} />
          <ThumbsDownIcon className={`${ownActivityIconClassName} ${(item.dislikesCount ?? 0) > 0 ? "text-rose-300/90" : "text-zinc-600"}`} />
        </>}
      </div>
    ) : isVideoCreated && selectedVideo ? (
      <button type="button" aria-label={locale === "en" ? `Play video for ${localizedTitle}` : `Reproducir video de ${localizedTitle}`} onClick={openSelectedVideo} className="rounded-full text-blue-300/90 transition hover:text-blue-100"><PlayIcon className={ownActivityIconClassName} /></button>
    ) : isVideoGiven && selectedVideo ? (
      <button type="button" aria-label={locale === "en" ? `Play reacted video for ${localizedTitle}` : `Reproducir video reaccionado de ${localizedTitle}`} onClick={openSelectedVideo} className={`cursor-pointer transition ${item.reactionValue === "dislike" ? "text-rose-300/90 hover:text-rose-200" : "text-emerald-300/90 hover:text-emerald-200"}`}>
        {item.reactionValue === "dislike" ? <ThumbsDownIcon className={ownActivityIconClassName} /> : <ThumbsUpIcon className={ownActivityIconClassName} />}
      </button>
    ) : item.interactionType === "comment" ? (
      <CommentBubbleIcon className={`${ownActivityIconClassName} text-blue-300/90`} />
    ) : item.interactionType === "rating" ? (
      <StarIcon className={`${ownActivityIconClassName} text-amber-300/90`} />
    ) : item.interactionType === "like" ? (
      <ThumbsUpIcon className={`${ownActivityIconClassName} text-emerald-300/90`} />
    ) : item.interactionType === "dislike" ? (
      <ThumbsDownIcon className={`${ownActivityIconClassName} text-rose-300/90`} />
    ) : null;

  return (
    <article
      className={`grid gap-3 py-3 last:border-b-0 ${isOwnProfile ? "relative" : ""} ${
        isVisitedProfile
          ? "grid-cols-[52px_minmax(0,1fr)] border-b-2 border-white/15 md:grid-cols-[52px_minmax(0,1fr)_minmax(260px,1fr)] md:gap-x-9"
          : "grid-cols-[52px_minmax(0,1fr)] border-b border-white/5"
      }`}
    >
      {movieHref ? (
      <Link href={movieHref} className="h-[78px] w-[52px] overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80">
        {item.moviePosterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.moviePosterUrl}
            alt={`Poster de ${localizedTitle}`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-[0.18em] text-zinc-600">Poster</div>
        )}
      </Link>
      ) : (
        <div className="h-[78px] w-[52px] overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80" />
      )}

      <div className={`min-w-0 ${isOwnProfile ? "pr-10" : ""}`}>
        {isOwnProfile ? <div className="absolute right-0 top-3">{ownActivityIcon}</div> : null}
        {isOwnProfile ? (
          <p className="text-xs font-medium text-blue-200/85">
            {getActivityTitle(item, isOwnProfile, locale)}{isSummary ? <> <button type="button" onClick={(event) => { event.stopPropagation(); onOpenReactionSummary?.(item); }} className="font-semibold underline decoration-blue-300/60 underline-offset-2 transition hover:text-blue-100">{locale === "en" ? "See more" : "Ver más"}</button></> : null}
          </p>
        ) : null}
        {movieHref ? (
          <Link
          href={movieHref}
          aria-label={`Ver detalle de ${item.movieTitle}`}
          className={`mt-1 block cursor-pointer font-semibold text-zinc-100 transition hover:text-blue-100 ${
            isVisitedProfile ? "text-base leading-snug md:text-lg" : "truncate text-sm"
          }`}
        >
          {localizedTitle}
        </Link>
        ) : (
          <p className={`mt-1 block font-semibold text-zinc-100 ${isVisitedProfile ? "text-base leading-snug md:text-lg" : "truncate text-sm"}`}>
            {localizedTitle || t("profileFeedUnknownTitle")}
          </p>
        )}
        {!isOwnProfile && item.movieSecondaryTitle ? (
          <p className={`mt-0.5 text-blue-200/75 ${isVisitedProfile ? "text-sm md:text-[15px]" : "truncate text-[11px]"}`}>
            {movieHref ? (
              <Link
              href={movieHref}
              aria-label={`Ver detalle de ${item.movieTitle} (${item.movieSecondaryTitle})`}
              className={`inline-block max-w-full cursor-pointer transition hover:text-blue-100 focus-visible:text-blue-100 focus-visible:outline-none ${
                isVisitedProfile ? "break-words" : "truncate"
              }`}
            >
              {item.movieSecondaryTitle}
            </Link>
            ) : (
              <span>{item.movieSecondaryTitle}</span>
            )}
          </p>
        ) : null}
        <p className={`mt-1 text-zinc-500 ${isVisitedProfile ? "text-sm md:text-[15px]" : "truncate text-[11px]"}`}>
          {formatMetadata(item.movieType, item.movieGenre, item.movieYear, locale, isVisitedProfile)}
        </p>
        {isOwnProfile && activityDetail ? <p className="mt-2 line-clamp-2 text-xs text-zinc-300/90">{activityDetail}</p> : null}
        {isOwnProfile ? <p className="mt-1 text-[11px] text-zinc-500">{formatProfileFeedRelativeDate(locale, getActivityRelativeDate(item))}</p> : null}
      </div>

      {isVisitedProfile ? (
        <div className="col-span-2 min-w-0 md:col-span-1 md:pt-1">
          {visitedActivityTab === "public_comments" && activityDetail ? (
            <div className="flex w-full items-start gap-2.5">
              <CommentBubbleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-100/90" />
              <ExpandableMobileText
                text={activityDetail}
                item={item}
                type="public-comment"
                className="text-sm leading-relaxed text-zinc-200 md:text-base"
              />
            </div>
          ) : null}

          {visitedActivityTab === "ratings" && visitedActionMessage ? (
            <div className="flex w-full items-start gap-2.5">
              <StarIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-blue-100 md:text-base">{visitedActionMessage}</p>
            </div>
          ) : null}

          {visitedActivityTab === "reactions" && visitedActionMessage && item.interactionType !== "rating" && item.interactionType !== "comment" ? (
            <div className="space-y-1">
              <div className="flex w-full items-start gap-2.5">
                {reactionValue === "dislike" ? (
                  <ThumbsDownIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
                ) : (
                  <ThumbsUpIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm leading-relaxed text-blue-100 md:text-base">
                    {reactionMessage}
                    {!authorIsCurrentUser && item.likedCommentAuthorUsername ? (
                      <>
                        {" "}
                        {shouldRenderAuthorLink ? (
                          <Link
                            href={`/users/${encodeURIComponent(item.likedCommentAuthorUsername)}`}
                            className="font-semibold text-blue-200 transition hover:text-blue-100"
                          >
                            @{item.likedCommentAuthorUsername}
                          </Link>
                        ) : (
                          <span className="font-semibold text-blue-200">@{item.likedCommentAuthorUsername}</span>
                        )}
                      </>
                    ) : null}
                    {!authorIsCurrentUser && !item.likedCommentAuthorUsername ? (locale === "en" ? " another user" : " otro usuario") : null}
                  </p>
                  {item.likedCommentSnippet ? (
                    <ExpandableMobileText
                      text={item.likedCommentSnippet}
                      item={item}
                      type="reaction-comment"
                      className="text-sm leading-relaxed text-zinc-200 md:text-base"
                    />
                  ) : null}
                  <p className="text-xs text-zinc-500 md:text-sm">{formatProfileFeedRelativeDate(locale, getActivityRelativeDate(item))}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function MessageRow({ item }: { item: MyMessageItem }) {
  const { locale, t } = useI18n();
  const hasMovieId = item.movieId !== undefined && item.movieId !== null && String(item.movieId).trim() !== "";
  const movieHref = hasMovieId ? `/movies/${encodeURIComponent(String(item.movieId))}` : null;
  const counterpart = item.direction === "sent" ? item.recipient || item.sender : item.sender;
  const counterpartUsername = counterpart?.username || t("profileFeedUser").toLocaleLowerCase();
  const counterpartInitials = counterpartUsername.slice(0, 2).toUpperCase();
  const isCounterpartRestricted = counterpart.restrictedCurrentUser === true;
  const identityAvatar = counterpart.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={counterpart.avatarUrl}
      alt={`Avatar de ${counterpartUsername}`}
      className="h-7 w-7 rounded-full border border-white/20 object-cover"
      loading="lazy"
      decoding="async"
    />
  ) : (
    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-zinc-900 text-[10px] font-semibold text-zinc-200">
      {counterpartInitials}
    </span>
  );
  const messageDirectionIcon = item.direction === "sent" ? (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-7 w-7 text-white opacity-80 transition-opacity duration-200 hover:opacity-100"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <rect x="3.5" y="6" width="14" height="11" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 7 6 5.1L16.5 7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 9.5a4.8 4.8 0 0 1-4.8 4.8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m12.6 13.2 2.6 1.1-1.1 2.6" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-7 w-7 text-blue-400 transition-all duration-200 hover:text-blue-300 hover:drop-shadow-[0_0_6px_rgba(59,130,246,0.8)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <rect x="4.5" y="4.5" width="15" height="11" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m5.5 5.5 6.5 5.2 6.5-5.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.8v5.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9.4 19.5 2.6 2.5 2.6-2.5" />
    </svg>
  );

  return (
    <article className="border-b border-white/5 py-3 last:border-b-0">
      <div className="relative mb-2 flex items-center gap-2.5 pr-8">
        {isCounterpartRestricted ? identityAvatar : <Link href={`/users/${encodeURIComponent(counterpartUsername)}`}>{identityAvatar}</Link>}
        <p className="text-xs text-zinc-100">
          {item.direction === "received" ? (
            <>
              <span className="text-base font-semibold text-blue-400 !text-blue-400">{t("profileFeedReceived")}</span>
              <span className="text-white"> {locale === "en" ? "from" : "de"} </span>
            </>
          ) : (
            <>
              <span className="text-base font-semibold text-white">{t("profileFeedSent")}</span>
              <span className="text-white"> {locale === "en" ? "to" : "a"} </span>
            </>
          )}
          {isCounterpartRestricted ? (
            <span className="font-semibold text-zinc-100">@{counterpartUsername}</span>
          ) : (
            <Link href={`/users/${encodeURIComponent(counterpartUsername)}`} className="font-semibold text-zinc-100 hover:underline">
              @{counterpartUsername}
            </Link>
          )}
        </p>
        <div className="pointer-events-auto absolute right-0 top-0 flex h-7 items-center justify-center">{messageDirectionIcon}</div>
      </div>

      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
        {movieHref ? (
          <Link href={movieHref} className="h-[78px] w-[52px] overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80">
          {item.moviePosterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.moviePosterUrl}
              alt={`Poster de ${item.movieTitle}`}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-[0.18em] text-zinc-600">Poster</div>
          )}
        </Link>
        ) : (
          <div className="h-[78px] w-[52px] overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80" />
        )}

        <div className="min-w-0">
          {movieHref ? (
            <Link
            href={movieHref}
            aria-label={`Ver detalle de ${item.movieTitle}`}
            className="block truncate text-sm font-semibold text-zinc-100 transition hover:text-blue-100"
          >
            {item.movieTitle}
          </Link>
          ) : (
            <p className="block truncate text-sm font-semibold text-zinc-100">{item.movieTitle}</p>
          )}
          {item.movieSecondaryTitle ? <p className="mt-0.5 truncate text-[11px] text-blue-200/75">{item.movieSecondaryTitle}</p> : null}
          <p className="mt-2 line-clamp-3 text-xs text-zinc-300/90">{stripLeadingMention(item.text)}</p>
          <p className="mt-1 text-[11px] text-zinc-500">{formatProfileFeedRelativeDate(locale, item.createdAt)}</p>
        </div>
      </div>
    </article>
  );
}

function MyActivitySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`my-activity-skeleton-${index}`} className="animate-pulse border-b border-white/5 py-3">
          <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
            <div className="h-[78px] w-[52px] rounded-lg bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-2.5 w-32 rounded bg-zinc-700" />
              <div className="h-3 w-4/5 rounded bg-zinc-800" />
              <div className="h-2.5 w-2/3 rounded bg-zinc-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface MyActivityColumnProps {
  scope?: "me" | `user:${string}`;
  isOwnProfile?: boolean;
  initialActiveTab?: "activity" | "messages" | "rated";
  activeTabRequest?: { tab: "activity" | "messages" | "rated"; id: number } | null;
  hidePrivateInbox?: boolean | null;
  viewedUsername?: string;
  title?: string;
  emptyCopy?: string;
  errorCopy?: string;
}

export default function MyActivityColumn({
  scope,
  isOwnProfile = true,
  initialActiveTab = "activity",
  activeTabRequest,
  hidePrivateInbox = null,
  viewedUsername,
  title,
  emptyCopy,
  errorCopy,
}: MyActivityColumnProps = {}) {
  const { locale, t } = useI18n();
  const initialResolvedActiveTab =
    isOwnProfile && hidePrivateInbox !== false && initialActiveTab === "messages" ? "activity" : initialActiveTab;
  const [activeTab, setActiveTab] = useState<"activity" | "messages" | "rated">(initialResolvedActiveTab);
  const [activeVideo, setActiveVideo] = useState<ActivityVideoState | null>(null);
  const closeActiveVideo = useCallback(() => setActiveVideo(null), []);
  const [deletedVideoCommentIds, setDeletedVideoCommentIds] = useState<Set<string>>(() => new Set());
  const resolvingVideoReactionRef = useRef(false);
  const [activityVideoReactionOverrides, setActivityVideoReactionOverrides] = useState<Map<string, ActivityVideoReaction | null>>(() => new Map());
  const [activeReactionSummary, setActiveReactionSummary] = useState<ReactionSummaryState | null>(null);
  const closeReactionSummary = useCallback(() => setActiveReactionSummary(null), []);

  const [visitedActivityTab, setVisitedActivityTab] = useState<"public_comments" | "ratings" | "reactions" | "recommendations" | "video_reactions">(
    "recommendations",
  );
  const [hasOpenedVisitedVideoReactions, setHasOpenedVisitedVideoReactions] = useState(false);
  const [senderQuery, setSenderQuery] = useState("");
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [authorCanVisitByUsername, setAuthorCanVisitByUsername] = useState<Record<string, boolean>>({});
  const [userRecommendations, setUserRecommendations] = useState<UserMovieRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState(false);
  const [recommendationsLoadedFor, setRecommendationsLoadedFor] = useState<string | null>(null);
  const autoLoadAttemptsRef = useRef(0);
  const markAsReadAbortControllerRef = useRef<AbortController | null>(null);
  const activityTouchGestureRef = useRef<ActivityTouchGesture | null>(null);
  const swipeIntentRef = useRef<SwipeIntent>({ count: 0, direction: null, endedAt: 0, armedDirection: null });
  const visitedTabsRef = useRef<HTMLDivElement | null>(null);
  const normalizedViewedUsername = viewedUsername?.trim() || "";
  const resolvedScope = scope || (isOwnProfile ? "me" : (normalizedViewedUsername ? `user:${normalizedViewedUsername}` : null));
  const canShowPrivateInbox = isOwnProfile && hidePrivateInbox === false;
  const shouldBlockPrivateInbox = isOwnProfile && !canShowPrivateInbox;
  const scrollVisitedTabIntoView = useCallback((button: HTMLButtonElement) => {
    const tabBar = visitedTabsRef.current;
    if (!tabBar || window.matchMedia("(min-width: 768px)").matches) return;
    const left = button.offsetLeft - (tabBar.clientWidth - button.offsetWidth) / 2;
    tabBar.scrollTo({ left, behavior: "smooth" });
  }, []);
  useEffect(() => {
    if (!activeTabRequest) return;
    setActiveTab(shouldBlockPrivateInbox && activeTabRequest.tab === "messages" ? "activity" : activeTabRequest.tab);
  }, [activeTabRequest, shouldBlockPrivateInbox]);
  const effectiveActiveTab = shouldBlockPrivateInbox && activeTab === "messages" ? "activity" : activeTab;
  const activityEnabled = !isOwnProfile || effectiveActiveTab === "activity" || effectiveActiveTab === "rated";
  const messagesEnabled = canShowPrivateInbox && effectiveActiveTab === "messages";
  const ownProfileTabs: Array<{ value: "activity" | "messages" | "rated"; label: string }> = [
    { value: "activity", label: t("profileFeedMyActivity") },
    ...(canShowPrivateInbox ? [{ value: "messages" as const, label: t("profileFeedPrivateInbox") }] : []),
    { value: "rated", label: t("profileFeedMyRatings") },
  ];


  const resolvedTitle = title ?? t("profileFeedMyActivity");
  const resolvedEmptyCopy = emptyCopy ?? t("emptyMyActivityTitle");
  const visitedEmptyCopy = visitedActivityTab === "public_comments"
    ? t("visitedProfileNoPublicComments")
    : visitedActivityTab === "ratings"
      ? t("visitedProfileNoRatings")
      : t("visitedProfileNoSocialActivity");
  const resolvedErrorCopy = errorCopy ?? (locale === "en" ? "Activity could not be loaded." : "No se pudo cargar la actividad.");

  const activity = useInfiniteScopedSocialActivity(resolvedScope || "user:unknown", activityEnabled);
  const messages = useInfiniteMyMessages(messagesEnabled);
  const reloadMessages = messages.reload;

  const openActivityVideo = useCallback(async ({ movieId, activityType, video }: ActivityVideoOpenRequest) => {
    if (resolvingVideoReactionRef.current) return;
    resolvingVideoReactionRef.current = true;
    console.group("[QNext ActivityVideo DEBUG]");
    console.log("OPEN REQUEST", {
      activityType,
      movieId,
      videoCommentId: video.commentId,
      activityVideoUrl: video.url,
      activityLikesCount: video.likesCount,
      activityDislikesCount: video.dislikesCount,
      activityMyReaction: video.myReaction,
    });
    try {
      const canonicalReaction = video.commentId
        ? await resolveCanonicalVideoReaction(movieId, video.commentId)
        : null;
      if (!video.commentId) console.warn("Activity video has no video_comment_id; using activity reaction fallback.", { movieId });
      if (canonicalReaction) {
        console.log("FINAL MODAL VIDEO — CANONICAL", {
          videoCommentId: video.commentId,
          likesCount: canonicalReaction.likesCount,
          dislikesCount: canonicalReaction.dislikesCount,
          myReaction: canonicalReaction.myReaction,
        });
      } else {
        console.warn("FINAL MODAL VIDEO — FALLBACK", {
          videoCommentId: video.commentId,
          likesCount: video.likesCount,
          dislikesCount: video.dislikesCount,
          myReaction: video.myReaction,
        });
      }
      setActiveVideo(canonicalReaction ? { ...video, ...canonicalReaction } : video);
    } catch (error) {
      console.error("CANONICAL FETCH FAILED", { movieId, videoCommentId: video.commentId, error });
      console.warn("FINAL MODAL VIDEO — FALLBACK", {
        videoCommentId: video.commentId,
        likesCount: video.likesCount,
        dislikesCount: video.dislikesCount,
        myReaction: video.myReaction,
      });
      setActiveVideo(video);
    } finally {
      console.groupEnd();
      resolvingVideoReactionRef.current = false;
    }
  }, []);

  const syncGivenVideoReaction = useCallback((video: ActivityVideoState, reaction: ReturnType<typeof normalizeVideoCommentReactionData>) => {
    if (video.activityType !== "video_reaction_given" || !video.activityId) return;
    setActivityVideoReactionOverrides((current) => {
      const next = new Map(current);
      next.set(video.activityId!, reaction.myReaction);
      return next;
    });
  }, []);

  const removeDeletedActivityVideo = useCallback((commentId: string) => {
    setDeletedVideoCommentIds((current) => new Set(current).add(commentId));
    setActiveVideo(null);
  }, []);

  const filteredMessages = useMemo(() => {
    const normalizedQuery = senderQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return messages.items;

    return messages.items.filter((message) => {
      const senderMatch = message.sender.username.toLocaleLowerCase().includes(normalizedQuery);
      const recipientMatch = message.recipient?.username.toLocaleLowerCase().includes(normalizedQuery) ?? false;
      return senderMatch || recipientMatch;
    });
  }, [messages.items, senderQuery]);

  const filteredActivityItems = useMemo(() => {
    if (isOwnProfile) return activity.items;
    if (!normalizedViewedUsername) return [];

    const sortedItems = [...activity.items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    const actorScopedItems = sortedItems.filter((item) => isVisitedActorItem(item, normalizedViewedUsername));

    if (visitedActivityTab === "public_comments") {
      return actorScopedItems.filter((item) => isVisitedPublicCommentItem(item));
    }

    if (visitedActivityTab === "ratings") {
      return actorScopedItems.filter((item) => isVisitedRatingItem(item));
    }

    if (visitedActivityTab === "reactions") {
      return actorScopedItems.filter((item) => isVisitedPublicReactionItem(item));
    }

    return [];
  }, [activity.items, isOwnProfile, normalizedViewedUsername, visitedActivityTab]);

  const ownActivityItems = useMemo(() => {
    return activity.items
      .filter((item) => !item.videoCommentId || !deletedVideoCommentIds.has(String(item.videoCommentId)))
      .filter((item) => activityVideoReactionOverrides.get(item.id) !== null)
      .filter((item) => isPublicOwnActivityItem(item, myUsername))
      .map((item) => {
        const reaction = activityVideoReactionOverrides.get(item.id);
        if (reaction !== "like" && reaction !== "dislike") return item;
        return { ...item, interactionType: reaction, reactionValue: reaction, videoMyReaction: reaction };
      });
  }, [activity.items, activityVideoReactionOverrides, deletedVideoCommentIds, myUsername]);

  const ownRatedItems = useMemo(() => {
    return activity.items
      .filter((item) => isOwnRatingActivityItem(item, myUsername))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [activity.items, myUsername]);

  useEffect(() => {
    if (!isOwnProfile || (effectiveActiveTab !== "activity" && effectiveActiveTab !== "rated")) {
      autoLoadAttemptsRef.current = 0;
      return;
    }

    if (activity.loading || activity.loadingMore) return;

    const visibleItems = effectiveActiveTab === "rated" ? ownRatedItems.length : ownActivityItems.length;
    if (!activity.hasMore || visibleItems >= MIN_VISIBLE_OWN_ACTIVITY_ITEMS) {
      autoLoadAttemptsRef.current = 0;
      return;
    }

    if (autoLoadAttemptsRef.current >= MAX_AUTO_LOAD_MORE_ATTEMPTS) return;

    autoLoadAttemptsRef.current += 1;
    void activity.loadMore();
  }, [
    effectiveActiveTab,
    activity,
    isOwnProfile,
    ownActivityItems.length,
    ownRatedItems.length,
  ]);

  useEffect(() => {
    if (isOwnProfile || effectiveActiveTab !== "activity" || visitedActivityTab === "recommendations" || visitedActivityTab === "video_reactions") {
      autoLoadAttemptsRef.current = 0;
      return;
    }

    if (activity.loading || activity.loadingMore) return;

    if (!activity.hasMore || filteredActivityItems.length >= MIN_VISIBLE_VISITED_ACTIVITY_ITEMS) {
      autoLoadAttemptsRef.current = 0;
      return;
    }

    if (autoLoadAttemptsRef.current >= MAX_AUTO_LOAD_MORE_ATTEMPTS) return;

    autoLoadAttemptsRef.current += 1;
    void activity.loadMore();
  }, [effectiveActiveTab, activity, filteredActivityItems.length, isOwnProfile, visitedActivityTab]);

  useEffect(() => {
    let cancelled = false;

    const loadMyUsername = async () => {
      try {
        const profile = await getMyProfile();
        if (cancelled) return;
        setMyUsername(profile?.username || null);
      } catch {
        if (cancelled) return;
        setMyUsername(null);
      }
    };

    void loadMyUsername();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isOwnProfile || visitedActivityTab !== "reactions") return;

    const authorUsernames = Array.from(
      new Set(
        filteredActivityItems
          .map((item) => item.likedCommentAuthorUsername?.trim().toLocaleLowerCase())
          .filter((value): value is string => Boolean(value)),
      ),
    );
    if (authorUsernames.length === 0) return;

    let cancelled = false;

    const loadAuthorVisitability = async () => {
      const results = await Promise.all(
        authorUsernames.map(async (username) => {
          try {
            const profile = await getUserProfileByUsername(username);
            return [username, isUserProfileVisitable(profile?.profileAccess, profile?.canViewFullProfile)] as const;
          } catch {
            return [username, false] as const;
          }
        }),
      );

      if (cancelled) return;

      setAuthorCanVisitByUsername((current) => {
        const next = { ...current };
        for (const [username, isVisitable] of results) {
          next[username] = isVisitable;
        }
        return next;
      });
    };

    void loadAuthorVisitability();

    return () => {
      cancelled = true;
    };
  }, [filteredActivityItems, isOwnProfile, visitedActivityTab]);

  useEffect(() => {
    if (isOwnProfile) return;
    if (!normalizedViewedUsername) return;
    if (visitedActivityTab !== "recommendations") return;
    if (recommendationsLoadedFor === normalizedViewedUsername) return;

    let cancelled = false;
    setRecommendationsLoading(true);
    setRecommendationsError(false);

    const loadRecommendations = async () => {
      try {
        const recommendations = await getUserMovieRecommendationsByUsername(normalizedViewedUsername);
        if (cancelled) return;
        setUserRecommendations(recommendations);
        setRecommendationsLoadedFor(normalizedViewedUsername);
      } catch {
        if (cancelled) return;
        setRecommendationsError(true);
      } finally {
        if (cancelled) return;
        setRecommendationsLoading(false);
      }
    };

    void loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, normalizedViewedUsername, recommendationsLoadedFor, visitedActivityTab]);

  useEffect(() => {
    if (isOwnProfile) return;
    setUserRecommendations([]);
    setRecommendationsLoading(false);
    setRecommendationsError(false);
    setRecommendationsLoadedFor(null);
  }, [isOwnProfile, normalizedViewedUsername]);

  useEffect(() => {
    setHasOpenedVisitedVideoReactions(false);
  }, [normalizedViewedUsername]);

  useEffect(() => {
    setActiveTab(shouldBlockPrivateInbox && initialActiveTab === "messages" ? "activity" : initialActiveTab);
  }, [initialActiveTab, shouldBlockPrivateInbox]);

  useEffect(() => {
    if (!shouldBlockPrivateInbox || activeTab !== "messages") return;
    setActiveTab("activity");
  }, [activeTab, shouldBlockPrivateInbox]);

  useEffect(() => {
    if (!isOwnProfile || !canShowPrivateInbox || effectiveActiveTab !== "messages") return;

    markAsReadAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    markAsReadAbortControllerRef.current = abortController;

    const markMessagesAsRead = async () => {
      try {
        await markMyMessagesAsRead(abortController.signal);
        reloadMessages();
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.warn("No se pudieron marcar mensajes como leídos.", error);
      }
    };

    void markMessagesAsRead();

    return () => {
      abortController.abort();
    };
  }, [canShowPrivateInbox, effectiveActiveTab, isOwnProfile, reloadMessages]);

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const remainingDistance = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (remainingDistance >= 160) return;

      if (effectiveActiveTab === "activity") {
        if (!isOwnProfile && (visitedActivityTab === "recommendations" || visitedActivityTab === "video_reactions")) return;
        if (!activity.hasMore || activity.loading || activity.loadingMore || activity.error) return;
        void activity.loadMore();
        return;
      }

      if (effectiveActiveTab === "rated") {
        if (!activity.hasMore || activity.loading || activity.loadingMore || activity.error) return;
        void activity.loadMore();
        return;
      }

      if (!canShowPrivateInbox || !messages.hasMore || messages.loading || messages.loadingMore || messages.error) return;
      void messages.loadMore();
    },
    [effectiveActiveTab, activity, canShowPrivateInbox, isOwnProfile, messages, visitedActivityTab],
  );

  const handleActivityTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (effectiveActiveTab === "messages" || !window.matchMedia("(max-width: 767px)").matches) return;
      const startY = event.touches[0]?.clientY;
      if (startY === undefined) return;
      if (event.timeStamp - swipeIntentRef.current.endedAt > SWIPE_INTENT_MAX_GAP_MS) {
        swipeIntentRef.current = { count: 0, direction: null, endedAt: 0, armedDirection: null };
      }
      activityTouchGestureRef.current = {
        startY,
        previousY: startY,
        startedAt: event.timeStamp,
        direction: null,
      };
    },
    [effectiveActiveTab],
  );

  const handleActivityTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const gesture = activityTouchGestureRef.current;
      const currentY = event.touches[0]?.clientY;
      if (!gesture || currentY === undefined || effectiveActiveTab === "messages") return;

      const scrollDelta = gesture.previousY - currentY;
      gesture.previousY = currentY;
      if (Math.abs(scrollDelta) < 0.5) return;
      const direction: VerticalDirection = scrollDelta > 0 ? 1 : -1;
      gesture.direction = direction;

      const scroller = event.currentTarget;
      const remainingBelow = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
      const distanceToEdge = direction === 1 ? remainingBelow : scroller.scrollTop;
      const isAtEdge = distanceToEdge <= 1;
      const rapidExitIsArmed = swipeIntentRef.current.armedDirection === direction && distanceToEdge <= SWIPE_INTENT_EDGE_DISTANCE_PX;
      const shouldTransfer = rapidExitIsArmed || (isIOSWebKitEnvironment() && isAtEdge);
      if (!shouldTransfer) return;

      // iOS WebKit can retain the accelerated nested scroller at either edge. Android
      // uses this path only after repeated same-direction swipes have armed an exit.
      if (event.cancelable) event.preventDefault();
      const outerScroller = scroller.ownerDocument.scrollingElement;
      if (outerScroller) outerScroller.scrollTop += scrollDelta;
    },
    [effectiveActiveTab],
  );

  const finishActivityTouch = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const gesture = activityTouchGestureRef.current;
    activityTouchGestureRef.current = null;
    if (!gesture?.direction) return;

    const distance = Math.abs(gesture.startY - gesture.previousY);
    const previous = swipeIntentRef.current;
    const withinWindow = event.timeStamp - previous.endedAt <= SWIPE_INTENT_MAX_GAP_MS;
    const qualifies = distance >= SWIPE_INTENT_MIN_DISTANCE_PX && event.timeStamp - gesture.startedAt <= SWIPE_INTENT_MAX_GAP_MS;
    const count = qualifies ? (withinWindow && previous.direction === gesture.direction ? previous.count + 1 : 1) : 0;
    swipeIntentRef.current = {
      count,
      direction: qualifies ? gesture.direction : null,
      endedAt: event.timeStamp,
      armedDirection: count >= SWIPE_INTENT_REQUIRED_GESTURES ? gesture.direction : null,
    };
  }, []);

  const cancelActivityTouch = useCallback(() => {
    activityTouchGestureRef.current = null;
  }, []);

  return (
    <section className={`my-activity-column w-full min-w-0 max-w-full ${isOwnProfile ? "md:max-w-[360px] xl:max-w-[360px]" : "max-w-none"}`}>
      {isOwnProfile ? (
        <header className="flex flex-wrap gap-2">
          {ownProfileTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                effectiveActiveTab === tab.value
                  ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                  : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </header>
      ) : (
        <div>
          <h2 className="text-base font-semibold text-zinc-100">{resolvedTitle}</h2>
          <div className="sticky top-0 z-30 -mx-4 mt-3 bg-black/90 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md md:static md:z-auto md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div ref={visitedTabsRef} className="flex flex-nowrap gap-2 overflow-x-auto scroll-smooth pb-1 md:flex-wrap md:overflow-x-visible md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={(event) => {
                setVisitedActivityTab("recommendations");
                scrollVisitedTabIntoView(event.currentTarget);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-base font-medium transition ${
                visitedActivityTab === "recommendations"
                  ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                  : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
              }`}
            >
              {t("visitedProfileRecommendations")}
            </button>
            <button
              type="button"
              onClick={(event) => {
                setVisitedActivityTab("video_reactions");
                setHasOpenedVisitedVideoReactions(true);
                scrollVisitedTabIntoView(event.currentTarget);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-base font-medium transition ${
                visitedActivityTab === "video_reactions"
                  ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                  : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
              }`}
            >
              {t("visitedProfileVideoReactions")}
            </button>
            <button
              type="button"
              onClick={(event) => {
                setVisitedActivityTab("public_comments");
                scrollVisitedTabIntoView(event.currentTarget);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-base font-medium transition ${
                visitedActivityTab === "public_comments"
                  ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                  : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
              }`}
            >
              {t("visitedProfilePublicComments")}
            </button>
            <button
              type="button"
              onClick={(event) => {
                setVisitedActivityTab("ratings");
                scrollVisitedTabIntoView(event.currentTarget);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-base font-medium transition ${
                visitedActivityTab === "ratings"
                  ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                  : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
              }`}
            >
              {t("visitedProfileRatings")}
            </button>
            <button
              type="button"
              onClick={(event) => {
                setVisitedActivityTab("reactions");
                scrollVisitedTabIntoView(event.currentTarget);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-base font-medium transition ${
                visitedActivityTab === "reactions"
                  ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                  : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
              }`}
            >
              {t("visitedProfileLikesDislikes")}
            </button>
          </div>
          </div>
        </div>
      )}

      {canShowPrivateInbox && effectiveActiveTab === "messages" ? (
        <div className="mt-3 flex items-center justify-start">
          <input
            type="search"
            value={senderQuery}
            onChange={(event) => setSenderQuery(event.target.value)}
            placeholder={t("profileFeedSearchUser")}
            aria-label={t("profileFeedSearchUser")}
            className="h-9 w-40 rounded-full border border-white/15 bg-zinc-900/75 px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-blue-300/60 focus:bg-zinc-900"
          />
        </div>
      ) : null}

      <div
        className={`my-activity-scroll-area activity-scrollbar mt-3 pr-1 ${
          !isOwnProfile && visitedActivityTab === "video_reactions"
            ? "h-auto overflow-y-visible"
            : !isOwnProfile
              ? "h-[calc(100dvh-max(5.5rem,calc(env(safe-area-inset-top)+4.5rem)))] overflow-y-auto md:h-[425px]"
              : "h-[425px] overflow-y-auto"
        }`}
        onScroll={handleScroll}
        onTouchStart={handleActivityTouchStart}
        onTouchMove={handleActivityTouchMove}
        onTouchEnd={finishActivityTouch}
        onTouchCancel={cancelActivityTouch}
      >
        {effectiveActiveTab === "activity" ? (
          <>
            {!isOwnProfile && !normalizedViewedUsername ? (
              <p className="text-sm text-zinc-500">No se pudo resolver el usuario para cargar actividad.</p>
            ) : null}

            {activity.loading && (isOwnProfile || visitedActivityTab !== "video_reactions") ? <MyActivitySkeleton /> : null}

            {!activity.loading && activity.error && (isOwnProfile || visitedActivityTab !== "video_reactions") ? (
              <div className="rounded-2xl border border-red-300/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
                <p>{activity.error || resolvedErrorCopy}</p>
                <button
                  type="button"
                  onClick={activity.reload}
                  className="mt-2 rounded-full border border-red-200/30 bg-red-900/40 px-2.5 py-1 text-[11px] font-medium hover:bg-red-900/60"
                >
                  {t("profileFeedRetry")}
                </button>
              </div>
            ) : null}

            {!isOwnProfile && visitedActivityTab === "recommendations" ? (
              <>
                {recommendationsLoading ? <p className="text-sm text-zinc-400">{t("profileFeedLoading")}</p> : null}
                {!recommendationsLoading && recommendationsError ? (
                  <p className="text-sm text-zinc-400">No pudimos cargar las recomendaciones de este usuario.</p>
                ) : null}
                {!recommendationsLoading && !recommendationsError && userRecommendations.length === 0 ? (
                  <p className="text-sm text-zinc-500">{t("visitedProfileNoRecommendations")}</p>
                ) : null}
                {!recommendationsLoading && !recommendationsError && userRecommendations.length > 0
                  ? userRecommendations.map((movie) => {
                      const recommendationTitles = getRecommendationTitles(movie, locale);
                      return (
                      <article key={movie.id} className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 border-b border-white/10 py-3">
                        <Link href={`/movies/${encodeURIComponent(movie.id)}`} className="h-[108px] w-[72px] overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80">
                          {movie.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={movie.image} alt={`Poster de ${recommendationTitles.primary}`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-zinc-500">{t("profileFeedNoPoster")}</span>
                          )}
                        </Link>
                        <div className="min-w-0 space-y-1">
                          <Link href={`/movies/${encodeURIComponent(movie.id)}`} className="block truncate text-lg font-semibold text-zinc-100 hover:text-blue-200">{recommendationTitles.primary}</Link>
                          {recommendationTitles.secondary ? (
                            <Link href={`/movies/${encodeURIComponent(movie.id)}`} className="block truncate text-sm text-zinc-400 hover:text-blue-200">{recommendationTitles.secondary}</Link>
                          ) : null}
                          <p className="text-xs text-zinc-300">{formatRecommendationMetadata(movie, locale)}</p>
                          <p className="text-xs text-zinc-400"><span className={VISITED_PROFILE_RECOMMENDATION_METADATA_LABEL_CLASSNAME}>{t("profileFeedDirector")}</span> {movie.director}</p>
                          <p className="line-clamp-2 text-xs text-zinc-500"><span className={VISITED_PROFILE_RECOMMENDATION_METADATA_LABEL_CLASSNAME}>{t("profileFeedCast")}</span> {movie.castMembers}</p>
                        </div>
                      </article>
                      );
                    })
                  : null}
              </>
            ) : null}

            {!isOwnProfile && hasOpenedVisitedVideoReactions ? (
              <div className={visitedActivityTab === "video_reactions" ? "block" : "hidden"}>
                <VisitedProfileVideoReactions username={normalizedViewedUsername} />
              </div>
            ) : null}

            {!activity.loading &&
            !activity.error &&
            (isOwnProfile ? ownActivityItems.length === 0 : visitedActivityTab !== "recommendations" && visitedActivityTab !== "video_reactions" && filteredActivityItems.length === 0) ? (
              isOwnProfile ? (
                <EmptyStatePanel
                  title={resolvedEmptyCopy}
                  description={t("emptyMyActivityDescription")}
                  icon={<span aria-hidden="true">💆🏽‍♂️</span>}
                />
              ) : (
                <p className="text-sm text-zinc-500">{visitedEmptyCopy}</p>
              )
            ) : null}

            {!activity.loading && !activity.error
              ? (isOwnProfile ? ownActivityItems : filteredActivityItems).map((item) => (
                  <ActivityRow
                    key={item.id}
                    item={item}
                    isOwnProfile={isOwnProfile}
                    visitedActivityTab={isOwnProfile || visitedActivityTab === "video_reactions" ? undefined : visitedActivityTab}
                    viewedUsername={normalizedViewedUsername}
                    myUsername={myUsername}
                    authorCanVisitByUsername={authorCanVisitByUsername}
                    onOpenVideo={(request) => { void openActivityVideo(request); }}
                    onOpenReactionSummary={setActiveReactionSummary}
                  />
                ))
              : null}

            {activity.loadingMore ? <p className="py-3 text-xs text-zinc-400">{t("profileFeedLoadingMoreActivity")}</p> : null}
          </>
        ) : canShowPrivateInbox && effectiveActiveTab === "messages" ? (
          <>
            {messages.loading ? <MyActivitySkeleton /> : null}

            {!messages.loading && messages.error ? (
              <div className="rounded-2xl border border-red-300/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
                <p>{messages.error}</p>
                <button
                  type="button"
                  onClick={messages.reload}
                  className="mt-2 rounded-full border border-red-200/30 bg-red-900/40 px-2.5 py-1 text-[11px] font-medium hover:bg-red-900/60"
                >
                  {t("profileFeedRetry")}
                </button>
              </div>
            ) : null}

            {!messages.loading && !messages.error && messages.items.length === 0 ? (
              <EmptyStatePanel
                title={t("emptyInboxTitle")}
                description={t("emptyInboxDescription")}
                icon={<span aria-hidden="true">📧</span>}
              />
            ) : null}

            {!messages.loading && !messages.error && messages.items.length > 0 && filteredMessages.length === 0 ? (
              <p className="text-sm text-zinc-500">No se encontraron mensajes para ese usuario</p>
            ) : null}

            {!messages.loading && !messages.error
              ? filteredMessages.map((item) => <MessageRow key={item.id} item={item} />)
              : null}

            {messages.loadingMore ? <p className="py-3 text-xs text-zinc-400">{t("profileFeedLoadingMoreMessages")}</p> : null}
          </>
        ) : (
          <>
            {activity.loading ? <MyActivitySkeleton /> : null}

            {!activity.loading && activity.error ? (
              <div className="rounded-2xl border border-red-300/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
                <p>{activity.error || resolvedErrorCopy}</p>
                <button
                  type="button"
                  onClick={activity.reload}
                  className="mt-2 rounded-full border border-red-200/30 bg-red-900/40 px-2.5 py-1 text-[11px] font-medium hover:bg-red-900/60"
                >
                  {t("profileFeedRetry")}
                </button>
              </div>
            ) : null}

            {!activity.loading && !activity.error && ownRatedItems.length === 0 ? (
              <EmptyStatePanel
                title={t("emptyRatingsTitle")}
                description={t("emptyRatingsDescription")}
                icon={<span aria-hidden="true">⭐</span>}
              />
            ) : null}

            {!activity.loading && !activity.error
              ? ownRatedItems.map((item) => (
                  <ActivityRow
                    key={item.id}
                    item={item}
                    isOwnProfile={isOwnProfile}
                    visitedActivityTab={undefined}
                    viewedUsername={normalizedViewedUsername}
                    myUsername={myUsername}
                    authorCanVisitByUsername={authorCanVisitByUsername}
                    onOpenVideo={(request) => { void openActivityVideo(request); }}
                  />
                ))
              : null}

            {activity.loadingMore ? <p className="py-3 text-xs text-zinc-400">{t("profileFeedLoadingMoreActivity")}</p> : null}
          </>
        )}
      </div>
      {activeVideo ? <ActivityVideoModal video={activeVideo} onClose={closeActiveVideo} onReactionUpdated={syncGivenVideoReaction} onDeleted={removeDeletedActivityVideo} /> : null}
      {activeReactionSummary ? <ReactionSummaryModal summary={activeReactionSummary} myUsername={myUsername} onClose={closeReactionSummary} /> : null}
    </section>
  );
}
