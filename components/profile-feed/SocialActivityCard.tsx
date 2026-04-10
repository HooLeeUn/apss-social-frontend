import Link from "next/link";
import { SocialActivityItem } from "../../lib/profile-feed/types";

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

function getAvatarFallback(username: string): string {
  return username.trim().slice(0, 2).toUpperCase() || "US";
}

function getActivityText(item: SocialActivityItem): { label: string; detail?: string; subDetail?: string } {
  if (item.interactionType === "rating") {
    return {
      label: "calificó",
      detail: item.ratingValue !== undefined ? `${item.ratingValue}/5` : "Sin score",
    };
  }

  if (item.interactionType === "comment") {
    return {
      label: "comentó",
      detail: item.commentText || "Sin comentario",
    };
  }

  return {
    label: "le dio like a un comentario en",
    detail: item.likedCommentSnippet || "Sin extracto de comentario",
    subDetail: item.likedCommentAuthorUsername ? `comentario de @${item.likedCommentAuthorUsername}` : undefined,
  };
}

export default function SocialActivityCard({ item }: { item: SocialActivityItem }) {
  const movieHref = `/movies/${encodeURIComponent(String(item.movieId))}`;
  const movieYear = item.movieYear ? `(${item.movieYear})` : "";
  const activity = getActivityText(item);

  return (
    <article className="rounded-2xl border border-white/15 bg-zinc-950/70 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.32)]">
      <div className="flex flex-wrap items-start gap-4 lg:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-900 text-xs font-semibold text-zinc-200">
            {item.user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.user.avatarUrl} alt={item.user.username} className="h-full w-full object-cover" loading="lazy" decoding="async" />
            ) : (
              getAvatarFallback(item.user.username)
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100">@{item.user.username}</p>
            <p className="mt-1 text-sm text-zinc-300">
              <span className="font-medium text-zinc-200">{activity.label}</span>{" "}
              <Link href={movieHref} className="font-semibold text-blue-200 transition hover:text-blue-100">
                {item.movieTitle}
              </Link>{" "}
              <span className="text-zinc-500">{movieYear}</span>
            </p>
            <p className="mt-1 line-clamp-3 text-sm text-zinc-400">{activity.detail}</p>
            {activity.subDetail ? <p className="mt-1 text-xs text-zinc-500">{activity.subDetail}</p> : null}
          </div>
        </div>

        <Link href={movieHref} className="flex shrink-0 items-start gap-3 border-l border-white/10 pl-4 transition hover:opacity-90" aria-label={`Ver ${item.movieTitle}`}>
          <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-zinc-900/75 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
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
              "Poster"
            )}
          </div>
        </Link>

        <div className="ml-auto">
          <span className="rounded-full border border-white/10 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-400">
            {formatRelativeDate(item.createdAt)}
          </span>
        </div>
      </div>
    </article>
  );
}
