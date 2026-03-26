import { Movie } from "../lib/movies";

interface WeeklyMiniCardProps {
  movie?: Movie;
  fallbackLabel: string;
}

export default function WeeklyMiniCard({ movie, fallbackLabel }: WeeklyMiniCardProps) {
  const title = movie?.title ?? fallbackLabel;

  return (
    <article className="overflow-hidden rounded-xl border-2 border-white/60 bg-zinc-950 text-zinc-100">
      <div className="h-28 w-full bg-zinc-900">
        {movie?.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={movie.posterUrl} alt={`Poster de ${title}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">Sin poster</div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <h4 className="line-clamp-1 text-sm font-medium">{title}</h4>
        <p className="line-clamp-1 text-xs text-zinc-400">{movie?.contentType ?? "Película / Serie"}</p>
      </div>
    </article>
  );
}
