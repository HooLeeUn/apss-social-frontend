"use client";

import Link from "next/link";
import { UIEvent, useCallback, useMemo, useState } from "react";
import { useInfiniteMyMessages } from "../../hooks/useInfiniteMyMessages";
import { useInfiniteScopedSocialActivity } from "../../hooks/useInfiniteScopedSocialActivity";
import { MyMessageItem, SocialActivityItem } from "../../lib/profile-feed/types";
import { formatAverageRating } from "../../lib/rating-format";

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
  const actorVerb = isOwnProfile ? "Diste" : "Dio";
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

  if (item.interactionType === "dislike") {
    return `${actorVerb} dislike al comentario de ${item.likedCommentAuthorUsername || "otro usuario"}`;
  }

  return `${actorVerb} like al comentario de ${item.likedCommentAuthorUsername || "otro usuario"}`;
}

function getActivityDetail(item: SocialActivityItem): string | null {
  if (item.interactionType === "rating") {
    return null;
  }

  if (item.interactionType === "comment") {
    if (item.isDirectedComment) {
      return item.commentText || "Enviaste un comentario privado.";
    }
    return item.commentText || "Dejaste un comentario público.";
  }

  return item.likedCommentSnippet || item.movieTitle;
}

function formatMetadata(movieType?: string, movieGenre?: string, movieYear?: number | null): string {
  const values = [movieType, movieGenre, movieYear ? String(movieYear) : null].filter(Boolean);
  return values.length > 0 ? values.join(" · ") : "Sin metadata";
}

function ActivityRow({ item, isOwnProfile }: { item: SocialActivityItem; isOwnProfile: boolean }) {
  const movieHref = `/movies/${encodeURIComponent(String(item.movieId))}`;
  const activityDetail = getActivityDetail(item);

  return (
    <article className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-white/5 py-3 last:border-b-0">
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

      <div className="min-w-0">
        <p className="text-xs font-medium text-blue-200/85">{getActivityTitle(item, isOwnProfile)}</p>
        <Link
          href={movieHref}
          aria-label={`Ver detalle de ${item.movieTitle}`}
          className="mt-1 block cursor-pointer truncate text-sm font-semibold text-zinc-100 transition hover:text-blue-100"
        >
          {item.movieTitle}
        </Link>
        {item.movieSecondaryTitle ? (
          <p className="mt-0.5 truncate text-[11px] text-blue-200/75">
            <Link
              href={movieHref}
              aria-label={`Ver detalle de ${item.movieTitle} (${item.movieSecondaryTitle})`}
              className="inline-block max-w-full cursor-pointer truncate transition hover:text-blue-100 focus-visible:text-blue-100 focus-visible:outline-none"
            >
              {item.movieSecondaryTitle}
            </Link>
          </p>
        ) : null}
        <p className="mt-1 truncate text-[11px] text-zinc-500">{formatMetadata(item.movieType, item.movieGenre, item.movieYear)}</p>
        {activityDetail ? (
          <p className="mt-2 line-clamp-2 text-xs text-zinc-300/90">{activityDetail}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-zinc-500">{formatRelativeDate(item.createdAt)}</p>
      </div>
    </article>
  );
}

function MessageRow({ item }: { item: MyMessageItem }) {
  const movieHref = `/movies/${encodeURIComponent(String(item.movieId))}`;
  const senderInitials = item.sender.username.slice(0, 2).toUpperCase();

  return (
    <article className="border-b border-white/5 py-3 last:border-b-0">
      <div className="mb-2 flex items-center gap-2.5">
        {item.sender.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.sender.avatarUrl}
            alt={`Avatar de ${item.sender.username}`}
            className="h-7 w-7 rounded-full border border-white/20 object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-zinc-900 text-[10px] font-semibold text-zinc-200">
            {senderInitials}
          </div>
        )}
        <p className="text-xs text-zinc-300">
          De <span className="font-semibold text-zinc-100">@{item.sender.username}</span>
        </p>
      </div>

      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
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

        <div className="min-w-0">
          <Link
            href={movieHref}
            aria-label={`Ver detalle de ${item.movieTitle}`}
            className="block truncate text-sm font-semibold text-zinc-100 transition hover:text-blue-100"
          >
            {item.movieTitle}
          </Link>
          {item.movieSecondaryTitle ? <p className="mt-0.5 truncate text-[11px] text-blue-200/75">{item.movieSecondaryTitle}</p> : null}
          {item.movieType ? <p className="mt-1 truncate text-[11px] text-zinc-500">{item.movieType}</p> : null}
          <p className="mt-2 line-clamp-3 text-xs text-zinc-300/90">{item.text}</p>
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
  viewedUsername?: string;
  title?: string;
  emptyCopy?: string;
  errorCopy?: string;
}

export default function MyActivityColumn({
  scope,
  isOwnProfile = true,
  viewedUsername,
  title = "Mi actividad",
  emptyCopy = "Aún no tienes actividad registrada.",
  errorCopy = "No se pudo cargar la actividad.",
}: MyActivityColumnProps = {}) {
  const [activeTab, setActiveTab] = useState<"activity" | "messages">("activity");
  const [senderQuery, setSenderQuery] = useState("");
  const normalizedViewedUsername = viewedUsername?.trim() || "";
  const resolvedScope = scope || (isOwnProfile ? "me" : (normalizedViewedUsername ? `user:${normalizedViewedUsername}` : null));

  const activity = useInfiniteScopedSocialActivity(resolvedScope || "user:unknown");
  const messages = useInfiniteMyMessages(isOwnProfile);

  const filteredMessages = useMemo(() => {
    const normalizedQuery = senderQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return messages.items;

    return messages.items.filter((message) => message.sender.username.toLocaleLowerCase().includes(normalizedQuery));
  }, [messages.items, senderQuery]);

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const remainingDistance = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (remainingDistance >= 160) return;

      if (activeTab === "activity") {
        if (!activity.hasMore || activity.loading || activity.loadingMore || activity.error) return;
        void activity.loadMore();
        return;
      }

      if (!messages.hasMore || messages.loading || messages.loadingMore || messages.error) return;
      void messages.loadMore();
    },
    [activeTab, activity, messages],
  );

  return (
    <section className="w-full min-w-0 max-w-[360px] xl:max-w-[340px]">
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
            Mis mensajes
          </button>
        </header>
      ) : (
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
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

            {!activity.loading && !activity.error && activity.items.length === 0 ? <p className="text-sm text-zinc-500">{emptyCopy}</p> : null}

            {!activity.loading && !activity.error
              ? activity.items.map((item) => <ActivityRow key={item.id} item={item} isOwnProfile={isOwnProfile} />)
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
