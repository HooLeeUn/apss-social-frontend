"use client";

import Link from "next/link";
import { UIEvent, useCallback } from "react";
import { useInfiniteScopedSocialActivity } from "../../hooks/useInfiniteScopedSocialActivity";
import { SocialActivityItem } from "../../lib/profile-feed/types";
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

  if (item.interactionType === "rating") {
    const score = item.ratingValue !== undefined ? formatAverageRating(item.ratingValue) : "sin nota";
    return `${ratedVerb} con ${score} ${safeMovieTitle}`;
  }

  if (item.interactionType === "comment") {
    return `${commentedVerb} ${safeMovieTitle}`;
  }

  if (item.interactionType === "dislike") {
    return `${actorVerb} dislike al comentario de ${item.likedCommentAuthorUsername || "otro usuario"}`;
  }

  return `${actorVerb} like al comentario de ${item.likedCommentAuthorUsername || "otro usuario"}`;
}

function getActivityDetail(item: SocialActivityItem): string {
  if (item.interactionType === "rating") {
    return "Registraste una calificación en tu historial.";
  }

  if (item.interactionType === "comment") {
    return item.commentText || "Dejaste un comentario público.";
  }

  return item.likedCommentSnippet || item.movieTitle;
}

function formatMetadata(item: SocialActivityItem): string {
  const values = [item.movieType, item.movieGenre, item.movieYear ? String(item.movieYear) : null].filter(Boolean);
  return values.length > 0 ? values.join(" · ") : "Sin metadata";
}

function ActivityRow({ item, isOwnProfile }: { item: SocialActivityItem; isOwnProfile: boolean }) {
  const movieHref = `/movies/${encodeURIComponent(String(item.movieId))}`;

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
        <Link href={movieHref} className="mt-1 block truncate text-sm font-semibold text-zinc-100 transition hover:text-blue-100">
          {item.movieTitle}
        </Link>
        <p className="mt-1 truncate text-[11px] text-zinc-500">{formatMetadata(item)}</p>
        <p className="mt-2 line-clamp-2 text-xs text-zinc-300/90">{getActivityDetail(item)}</p>
        <p className="mt-1 text-[11px] text-zinc-500">{formatRelativeDate(item.createdAt)}</p>
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
  const normalizedViewedUsername = viewedUsername?.trim() || "";
  const resolvedScope = scope || (isOwnProfile ? "me" : (normalizedViewedUsername ? `user:${normalizedViewedUsername}` : null));
  const { items, loading, loadingMore, error, hasMore, loadMore, reload } = useInfiniteScopedSocialActivity(resolvedScope || "user:unknown");

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (!hasMore || loading || loadingMore || error) return;

      const target = event.currentTarget;
      const remainingDistance = target.scrollHeight - target.scrollTop - target.clientHeight;

      if (remainingDistance < 160) {
        void loadMore();
      }
    },
    [error, hasMore, loadMore, loading, loadingMore],
  );

  return (
    <section className="w-full min-w-0 max-w-[360px] xl:max-w-[340px]">
      <h2 className="text-base font-semibold text-zinc-100">{title}</h2>

      <div
        className="activity-scrollbar mt-3 h-[425px] overflow-y-auto pr-1"
        onScroll={handleScroll}
      >
        {!isOwnProfile && !normalizedViewedUsername ? (
          <p className="text-sm text-zinc-500">No se pudo resolver el usuario para cargar actividad.</p>
        ) : null}

        {loading ? <MyActivitySkeleton /> : null}

        {!loading && error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
            <p>{error || errorCopy}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-2 rounded-full border border-red-200/30 bg-red-900/40 px-2.5 py-1 text-[11px] font-medium hover:bg-red-900/60"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? <p className="text-sm text-zinc-500">{emptyCopy}</p> : null}

        {!loading && !error ? items.map((item) => <ActivityRow key={item.id} item={item} isOwnProfile={isOwnProfile} />) : null}

        {loadingMore ? <p className="py-3 text-xs text-zinc-400">Cargando más actividad...</p> : null}
      </div>
    </section>
  );
}
