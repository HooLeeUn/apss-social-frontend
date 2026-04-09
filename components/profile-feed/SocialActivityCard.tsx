import { SocialActivityItem } from "../../lib/profile-feed/types";

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Reciente";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function SocialActivityCard({ item }: { item: SocialActivityItem }) {
  const detail =
    item.interactionType === "rating"
      ? `Calificó con ${item.ratingValue ?? "-"}/5`
      : item.interactionType === "comment"
        ? `Comentó: ${item.commentText ?? "Sin comentario"}`
        : `Le dio like a: \"${item.likedCommentSnippet ?? "Comentario"}\"`;
  const interactionLabel =
    item.interactionType === "rating" ? "Calificación" : item.interactionType === "comment" ? "Comentario" : "Like";
  const movieGeneralRating = "4.3";
  const followingRating = "4.1";
  const myRating = item.ratingValue ? `${item.ratingValue.toFixed(1)}` : "—";

  return (
    <article className="rounded-2xl border border-white/15 bg-zinc-950/70 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.32)]">
      <div className="flex flex-wrap items-start gap-4 lg:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-zinc-900 text-xs font-semibold text-zinc-200">
            {item.user.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100">{item.user.username}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{interactionLabel}</p>
            <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{detail}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-start gap-3 border-l border-white/10 pl-4">
          <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-zinc-900/75 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Poster
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {item.movieTitle} <span className="text-zinc-500">({item.movieYear})</span>
            </p>
            <p className="mt-1 text-xs text-zinc-400">Género: Drama</p>
            <p className="text-xs text-zinc-500">Tipo: Película</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-zinc-900/80 px-2 py-1 text-zinc-300">General {movieGeneralRating}</span>
              <span className="rounded-full border border-white/10 bg-zinc-900/80 px-2 py-1 text-zinc-300">Seguidos {followingRating}</span>
              <span className="rounded-full border border-blue-300/40 bg-blue-900/20 px-2 py-1 text-blue-100">Mi rating {myRating}</span>
            </div>
          </div>
        </div>

        <div className="ml-auto">
          <span className="rounded-full border border-white/10 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-400">
            {formatRelativeDate(item.createdAt)}
          </span>
        </div>
      </div>
    </article>
  );
}
