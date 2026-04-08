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

  return (
    <article className="rounded-2xl border border-white/15 bg-zinc-950/70 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.32)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-300">
            <span className="font-semibold text-zinc-100">{item.user.username}</span> · {item.movieTitle} ({item.movieYear})
          </p>
          <p className="mt-1 text-sm text-zinc-400">{detail}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-400">
          {formatRelativeDate(item.createdAt)}
        </span>
      </div>
    </article>
  );
}
