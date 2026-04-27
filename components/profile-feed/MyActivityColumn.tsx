"use client";

import Link from "next/link";
import { UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteMyMessages } from "../../hooks/useInfiniteMyMessages";
import { useInfiniteScopedSocialActivity } from "../../hooks/useInfiniteScopedSocialActivity";
import { getMyProfile, getUserProfileByUsername, markMyMessagesAsRead } from "../../lib/profile-feed/adapters";
import { MyMessageItem, SocialActivityItem } from "../../lib/profile-feed/types";
import { formatAverageRating } from "../../lib/rating-format";
import { stripLeadingMention } from "../../lib/strip-leading-mention";

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Reciente";

  const elapsedMs = Date.now() - date.getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  if (elapsedMinutes < 1) return "Ahora";
  if (elapsedMinutes < 60) return `Hace ${elapsedMinutes} min`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Hace ${elapsedHours} h`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `Hace ${elapsedDays} d`;

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getActivityTitle(item: SocialActivityItem, isOwnProfile: boolean): string {
  const safeMovieTitle = item.movieTitle || "título";
  const ratedVerb = isOwnProfile ? "Calificaste" : "Calificó";
  const commentedVerb = isOwnProfile ? "Comentaste" : "Comentó";
  const directedTarget = item.directedCommentTargetUsername ? ` a @${item.directedCommentTargetUsername}` : "";

  if (item.interactionType === "rating") {
    const score = item.ratingValue !== undefined ? formatAverageRating(item.ratingValue) : "sin nota";
    return `${ratedVerb} con ${score} ${safeMovieTitle}`;
  }

  if (item.interactionType === "comment") {
    if (item.isDirectedComment) {
      return isOwnProfile
        ? `Enviaste un mensaje privado sobre ${safeMovieTitle}${directedTarget}`
        : `Envió un mensaje privado sobre ${safeMovieTitle}${directedTarget}`;
    }
    return `${commentedVerb} ${safeMovieTitle}`;
  }

  const reactionActor = item.reactionActorUsername || item.user.username || "otro usuario";
  const commentAuthor = item.likedCommentAuthorUsername || "otro usuario";

  const reactionValue = item.reactionValue || (item.interactionType === "like" || item.interactionType === "dislike" ? item.interactionType : null);
  if (reactionValue === "dislike") {
    if (item.isGivenReaction) {
      return `No te gustó el comentario de ${commentAuthor}`;
    }
    if (item.isReceivedReaction) {
      return `A ${reactionActor} no le gustó tu comentario`;
    }
    return `${isOwnProfile ? "No te gustó" : "No le gustó"} el comentario de ${commentAuthor}`;
  }

  if (reactionValue === "like" && item.isGivenReaction) {
    return `Te gustó el comentario de ${commentAuthor}`;
  }
  if (reactionValue === "like" && item.isReceivedReaction) {
    return `A ${reactionActor} le gustó tu comentario`;
  }
  if (reactionValue === "like") {
    return `${isOwnProfile ? "Te gustó" : "Le gustó"} el comentario de ${commentAuthor}`;
  }
  return "Reaccionaste a un comentario";
}

function getActivityDetail(item: SocialActivityItem): string | null {
  if (item.interactionType === "rating") {
    return null;
  }

  if (item.interactionType === "comment") {
    if (item.isDirectedComment) {
      return stripLeadingMention(item.commentText || "Enviaste un comentario privado.");
    }
    return item.commentText || "Dejaste un comentario público.";
  }

  return item.likedCommentSnippet || item.movieTitle;
}

function formatMetadata(movieType?: string, movieGenre?: string, movieYear?: number | null): string {
  const values = [movieType, movieGenre, movieYear ? String(movieYear) : null].filter(Boolean);
  return values.length > 0 ? values.join(" · ") : "Sin metadata";
}

function getVisitedActionMessage(item: SocialActivityItem): string | null {
  if (item.interactionType === "rating") {
    const score = item.ratingValue !== undefined ? formatAverageRating(item.ratingValue) : "sin nota";
    return `Calificó con ${score} esta película`;
  }

  if (item.interactionType === "like") {
    return `Le gustó este comentario de ${item.likedCommentAuthorUsername || "otro usuario"}`;
  }

  if (item.interactionType === "dislike") {
    return `No le gustó este comentario de ${item.likedCommentAuthorUsername || "otro usuario"}`;
  }

  return null;
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

function isUserProfileVisitable(profileAccess?: string | null, canViewFullProfile?: boolean | null): boolean {
  const normalizedProfileAccess = profileAccess?.trim().toLocaleLowerCase();
  const hasLimitedAccess =
    canViewFullProfile === false ||
    normalizedProfileAccess === "restricted" ||
    normalizedProfileAccess === "limited" ||
    normalizedProfileAccess === "private";

  return !hasLimitedAccess;
}

function isPublicOwnActivityItem(item: SocialActivityItem): boolean {
  if (item.scope === "private_inbox") return false;
  if (item.isDirectedComment) return false;
  if (item.interactionType === "comment") return item.scope === "activity";
  if (item.interactionType === "like" || item.interactionType === "dislike") {
    return item.scope === "activity" && item.reactionScope === "public";
  }

  return false;
}

function ActivityRow({
  item,
  isOwnProfile,
  visitedActivityTab,
  viewedUsername,
  myUsername,
  authorCanVisitByUsername,
}: {
  item: SocialActivityItem;
  isOwnProfile: boolean;
  visitedActivityTab?: "public_comments" | "ratings" | "reactions" | "recommendations";
  viewedUsername?: string;
  myUsername?: string | null;
  authorCanVisitByUsername?: Record<string, boolean>;
}) {
  const hasMovieId = item.movieId !== undefined && item.movieId !== null && String(item.movieId).trim() !== "";
  const movieHref = hasMovieId ? `/movies/${encodeURIComponent(String(item.movieId))}` : null;
  const activityDetail = getActivityDetail(item);
  const visitedActionMessage = getVisitedActionMessage(item);
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
        ? `A ${viewedUsername || "este usuario"} le gustó tu comentario`
        : `A ${viewedUsername || "este usuario"} le gustó el comentario de`
      : reactionValue === "dislike"
        ? authorIsCurrentUser
          ? `A ${viewedUsername || "este usuario"} no le gustó tu comentario`
          : `A ${viewedUsername || "este usuario"} no le gustó el comentario de`
        : `A ${viewedUsername || "este usuario"} reaccionó al comentario de`;

  return (
    <article
      className={`grid gap-3 py-3 last:border-b-0 ${
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
        {isOwnProfile ? <p className="text-xs font-medium text-blue-200/85">{getActivityTitle(item, isOwnProfile)}</p> : null}
        {movieHref ? (
          <Link
          href={movieHref}
          aria-label={`Ver detalle de ${item.movieTitle}`}
          className={`mt-1 block cursor-pointer font-semibold text-zinc-100 transition hover:text-blue-100 ${
            isVisitedProfile ? "text-base leading-snug md:text-lg" : "truncate text-sm"
          }`}
        >
          {item.movieTitle}
        </Link>
        ) : (
          <p className={`mt-1 block font-semibold text-zinc-100 ${isVisitedProfile ? "text-base leading-snug md:text-lg" : "truncate text-sm"}`}>
            {item.movieTitle || "Título desconocido"}
          </p>
        )}
        {item.movieSecondaryTitle ? (
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
          {formatMetadata(item.movieType, item.movieGenre, item.movieYear)}
        </p>
        {isOwnProfile && activityDetail ? <p className="mt-2 line-clamp-2 text-xs text-zinc-300/90">{activityDetail}</p> : null}
        {isOwnProfile ? <p className="mt-1 text-[11px] text-zinc-500">{formatRelativeDate(item.createdAt)}</p> : null}
      </div>

      {isVisitedProfile ? (
        <div className="min-w-0 md:pt-1">
          {visitedActivityTab === "public_comments" && activityDetail ? (
            <div className="flex items-start gap-2.5">
              <CommentBubbleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-100/90" />
              <p className="text-sm leading-relaxed text-zinc-200 md:text-base">{activityDetail}</p>
            </div>
          ) : null}

          {visitedActivityTab === "ratings" && visitedActionMessage ? (
            <div className="flex items-start gap-2.5">
              <StarIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
              <p className="text-sm leading-relaxed text-blue-100 md:text-base">{visitedActionMessage}</p>
            </div>
          ) : null}

          {visitedActivityTab === "reactions" && visitedActionMessage && item.interactionType !== "rating" && item.interactionType !== "comment" ? (
            <div className="space-y-1">
              <div className="flex items-start gap-2.5">
                {reactionValue === "dislike" ? (
                  <ThumbsDownIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
                ) : (
                  <ThumbsUpIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                )}
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
                  {!authorIsCurrentUser && !item.likedCommentAuthorUsername ? " otro usuario" : null}
                </p>
              </div>
              {item.likedCommentSnippet ? (
                <p className="pl-7 text-sm leading-relaxed text-zinc-200 md:text-base">{item.likedCommentSnippet}</p>
              ) : null}
              <p className="pl-7 text-xs text-zinc-500 md:text-sm">{formatRelativeDate(item.createdAt)}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function MessageRow({ item }: { item: MyMessageItem }) {
  const hasMovieId = item.movieId !== undefined && item.movieId !== null && String(item.movieId).trim() !== "";
  const movieHref = hasMovieId ? `/movies/${encodeURIComponent(String(item.movieId))}` : null;
  const counterpart = item.direction === "sent" ? item.recipient || item.sender : item.sender;
  const counterpartUsername = counterpart?.username || "usuario";
  const counterpartInitials = counterpartUsername.slice(0, 2).toUpperCase();
  return (
    <article className="border-b border-white/5 py-3 last:border-b-0">
      <div className="mb-2 flex items-center gap-2.5">
        {counterpart.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={counterpart.avatarUrl}
            alt={`Avatar de ${counterpartUsername}`}
            className="h-7 w-7 rounded-full border border-white/20 object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-zinc-900 text-[10px] font-semibold text-zinc-200">
            {counterpartInitials}
          </div>
        )}
        <p className="text-xs text-zinc-100">
          {item.direction === "received" ? (
            <>
              <span className="text-base font-semibold text-blue-400 !text-blue-400">Recibido</span>
              <span className="text-white"> de </span>
            </>
          ) : (
            <>
              <span className="text-base font-semibold text-white">Enviado</span>
              <span className="text-white"> a </span>
            </>
          )}
          <span className="font-semibold text-zinc-100">@{counterpartUsername}</span>
        </p>
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
          <p className="mt-1 text-[11px] text-zinc-500">{formatRelativeDate(item.createdAt)}</p>
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
  initialActiveTab?: "activity" | "messages";
  viewedUsername?: string;
  title?: string;
  emptyCopy?: string;
  errorCopy?: string;
}

export default function MyActivityColumn({
  scope,
  isOwnProfile = true,
  initialActiveTab = "activity",
  viewedUsername,
  title = "Mi actividad",
  emptyCopy = "Aún no tienes actividad registrada.",
  errorCopy = "No se pudo cargar la actividad.",
}: MyActivityColumnProps = {}) {
  const [activeTab, setActiveTab] = useState<"activity" | "messages">(initialActiveTab);
  const [visitedActivityTab, setVisitedActivityTab] = useState<"public_comments" | "ratings" | "reactions" | "recommendations">(
    "public_comments",
  );
  const [senderQuery, setSenderQuery] = useState("");
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [authorCanVisitByUsername, setAuthorCanVisitByUsername] = useState<Record<string, boolean>>({});
  const markAsReadAbortControllerRef = useRef<AbortController | null>(null);
  const normalizedViewedUsername = viewedUsername?.trim() || "";
  const resolvedScope = scope || (isOwnProfile ? "me" : (normalizedViewedUsername ? `user:${normalizedViewedUsername}` : null));
  const activityEnabled = !isOwnProfile || activeTab === "activity";

  const activity = useInfiniteScopedSocialActivity(resolvedScope || "user:unknown", activityEnabled);
  const messages = useInfiniteMyMessages(isOwnProfile);
  const reloadMessages = messages.reload;

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

    if (visitedActivityTab === "public_comments") {
      return activity.items.filter((item) => item.interactionType === "comment" && !item.isDirectedComment);
    }

    if (visitedActivityTab === "ratings") {
      return activity.items.filter((item) => item.interactionType === "rating");
    }

    if (visitedActivityTab === "reactions") {
      return activity.items.filter((item) => item.interactionType === "like" || item.interactionType === "dislike");
    }

    return [];
  }, [activity.items, isOwnProfile, visitedActivityTab]);

  const ownActivityItems = useMemo(() => {
    return activity.items
      .filter((item) => isPublicOwnActivityItem(item))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [activity.items]);

  useEffect(() => {
    if (isOwnProfile) return;
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
  }, [isOwnProfile]);

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
    setActiveTab(initialActiveTab);
  }, [initialActiveTab]);

  useEffect(() => {
    if (!isOwnProfile || activeTab !== "messages") return;

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
  }, [activeTab, isOwnProfile, reloadMessages]);

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const remainingDistance = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (remainingDistance >= 160) return;

      if (activeTab === "activity") {
        if (!isOwnProfile && visitedActivityTab === "recommendations") return;
        if (!activity.hasMore || activity.loading || activity.loadingMore || activity.error) return;
        void activity.loadMore();
        return;
      }

      if (!messages.hasMore || messages.loading || messages.loadingMore || messages.error) return;
      void messages.loadMore();
    },
    [activeTab, activity, isOwnProfile, messages, visitedActivityTab],
  );

  return (
    <section className={`w-full min-w-0 ${isOwnProfile ? "max-w-[360px] xl:max-w-[360px]" : "max-w-none"}`}>
      {isOwnProfile ? (
        <header className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              activeTab === "activity"
                ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
            }`}
          >
            Mi actividad
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("messages")}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              activeTab === "messages"
                ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
            }`}
          >
            Buzón Privado
          </button>
        </header>
      ) : (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setVisitedActivityTab("public_comments")}
              className={`rounded-full border px-3 py-1.5 text-base font-medium transition ${
                visitedActivityTab === "public_comments"
                  ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                  : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
              }`}
            >
              Comentarios públicos
            </button>
            <button
              type="button"
              onClick={() => setVisitedActivityTab("ratings")}
              className={`rounded-full border px-3 py-1.5 text-base font-medium transition ${
                visitedActivityTab === "ratings"
                  ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                  : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
              }`}
            >
              Calificaciones
            </button>
            <button
              type="button"
              onClick={() => setVisitedActivityTab("reactions")}
              className={`rounded-full border px-3 py-1.5 text-base font-medium transition ${
                visitedActivityTab === "reactions"
                  ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                  : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
              }`}
            >
              Me gusta/No me gusta
            </button>
            <button
              type="button"
              onClick={() => setVisitedActivityTab("recommendations")}
              className={`rounded-full border px-3 py-1.5 text-base font-medium transition ${
                visitedActivityTab === "recommendations"
                  ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                  : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
              }`}
            >
              Recomendaciones
            </button>
          </div>
        </div>
      )}

      {isOwnProfile && activeTab === "messages" ? (
        <div className="mt-3 flex items-center justify-start">
          <input
            type="search"
            value={senderQuery}
            onChange={(event) => setSenderQuery(event.target.value)}
            placeholder="Buscar usuario"
            aria-label="Buscar mensajes por usuario remitente"
            className="h-9 w-40 rounded-full border border-white/15 bg-zinc-900/75 px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-blue-300/60 focus:bg-zinc-900"
          />
        </div>
      ) : null}

      <div
        className="activity-scrollbar mt-3 h-[425px] overflow-y-auto pr-1"
        onScroll={handleScroll}
      >
        {activeTab === "activity" ? (
          <>
            {!isOwnProfile && !normalizedViewedUsername ? (
              <p className="text-sm text-zinc-500">No se pudo resolver el usuario para cargar actividad.</p>
            ) : null}

            {activity.loading ? <MyActivitySkeleton /> : null}

            {!activity.loading && activity.error ? (
              <div className="rounded-2xl border border-red-300/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
                <p>{activity.error || errorCopy}</p>
                <button
                  type="button"
                  onClick={activity.reload}
                  className="mt-2 rounded-full border border-red-200/30 bg-red-900/40 px-2.5 py-1 text-[11px] font-medium hover:bg-red-900/60"
                >
                  Reintentar
                </button>
              </div>
            ) : null}

            {!activity.loading && !activity.error && !isOwnProfile && visitedActivityTab === "recommendations" ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/35 p-4 text-sm text-zinc-300">
                Próximamente verás aquí las recomendaciones de este usuario.
              </div>
            ) : null}

            {!activity.loading &&
            !activity.error &&
            (isOwnProfile ? ownActivityItems.length === 0 : visitedActivityTab !== "recommendations" && filteredActivityItems.length === 0) ? (
              <p className="text-sm text-zinc-500">{emptyCopy}</p>
            ) : null}

            {!activity.loading && !activity.error
              ? (isOwnProfile ? ownActivityItems : filteredActivityItems).map((item) => (
                  <ActivityRow
                    key={item.id}
                    item={item}
                    isOwnProfile={isOwnProfile}
                    visitedActivityTab={isOwnProfile ? undefined : visitedActivityTab}
                    viewedUsername={normalizedViewedUsername}
                    myUsername={myUsername}
                    authorCanVisitByUsername={authorCanVisitByUsername}
                  />
                ))
              : null}

            {activity.loadingMore ? <p className="py-3 text-xs text-zinc-400">Cargando más actividad...</p> : null}
          </>
        ) : (
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
                  Reintentar
                </button>
              </div>
            ) : null}

            {!messages.loading && !messages.error && messages.items.length === 0 ? (
              <p className="text-sm text-zinc-500">No tienes mensajes privados por ahora</p>
            ) : null}

            {!messages.loading && !messages.error && messages.items.length > 0 && filteredMessages.length === 0 ? (
              <p className="text-sm text-zinc-500">No se encontraron mensajes para ese usuario</p>
            ) : null}

            {!messages.loading && !messages.error
              ? filteredMessages.map((item) => <MessageRow key={item.id} item={item} />)
              : null}

            {messages.loadingMore ? <p className="py-3 text-xs text-zinc-400">Cargando más mensajes...</p> : null}
          </>
        )}
      </div>
    </section>
  );
}
