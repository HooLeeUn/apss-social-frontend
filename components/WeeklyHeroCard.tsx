import { Movie } from "../lib/movies";

interface WeeklyHeroCardProps {
  movie?: Movie;
  fallbackLabel: string;
}

function renderRating(value: number | null | undefined) {
  return value !== null && value !== undefined ? value.toFixed(1) : "-";
}

export default function WeeklyHeroCard({ movie, fallbackLabel }: WeeklyHeroCardProps) {
  const title = movie?.title ?? fallbackLabel;
  const subtitle = movie?.contentType ?? "Recomendación";
  const yearAndGenres = movie
    ? `${movie.year} · ${movie.genres.length > 0 ? movie.genres.join(", ") : "Sin género"}`
    : "Descubre lo más destacado de esta semana";

  return (
    <article className="overflow-hidden rounded-2xl border-2 border-white/70 bg-zinc-950 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
      <div className="relative h-64 w-full bg-zinc-900 xl:h-72">
        {movie?.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={movie.posterUrl} alt={`Poster de ${title}`} className="h-full w-full object-cover opacity-85" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 px-6 text-center text-sm text-zinc-300">
            Poster próximamente
          </div>
        )}
      </div>

      <div className="space-y-2 p-4 text-zinc-100">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Recomendación semanal</p>
        <h3 className="text-lg font-semibold leading-tight xl:text-xl">{title}</h3>
        <p className="text-sm text-zinc-300">{subtitle}</p>
        <p className="text-sm text-zinc-400">{yearAndGenres}</p>
        <p className="pt-1 text-sm text-zinc-300">⭐ {renderRating(movie?.displayRating)} · 👥 {renderRating(movie?.followingAvgRating)}</p>
      </div>
    </article>
  );
}
