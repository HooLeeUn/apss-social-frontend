import { Movie } from "../lib/movies";

interface MovieCardProps {
  movie: Movie;
  variant?: "large" | "compact" | "feed";
}

function renderRating(value: number | null) {
  return value !== null ? value.toFixed(1) : "-";
}

function formatContentType(contentType: string) {
  const normalized = contentType.trim().toLowerCase();
  if (normalized === "movie") return "Película";
  if (normalized === "series" || normalized === "tv series" || normalized === "tvseries") return "Serie";
  if (!contentType.trim()) return "Desconocido";
  return contentType;
}

export default function MovieCard({ movie, variant = "compact" }: MovieCardProps) {
  const isLarge = variant === "large";
  const isFeed = variant === "feed";
  const typeYearLine = [formatContentType(movie.contentType), movie.year && movie.year !== "-" ? movie.year : null]
    .filter(Boolean)
    .join(" · ");
  const genresLine = movie.genres.length > 0 ? movie.genres.join(" · ") : "Sin género";

  return (
    <article
      className={`overflow-hidden rounded-xl border shadow-sm transition-colors ${
        isFeed
          ? "border border-white/30 bg-zinc-950/90 text-zinc-100"
          : "border border-gray-200 bg-white"
      } ${
        isLarge ? "md:flex" : ""
      }`}
    >
      <div
        className={`flex-shrink-0 ${
          isFeed ? "h-44 bg-zinc-900" : "bg-gray-200"
        } ${
          isLarge ? "h-72 md:h-auto md:w-48" : isFeed ? "sm:h-48" : "h-56"
        }`}
      >
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={movie.posterUrl} alt={`Poster de ${movie.title}`} className="w-full h-full object-cover" />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center px-3 text-center text-sm ${
              isFeed ? "text-zinc-400" : "text-gray-500"
            }`}
          >
            Poster no disponible
          </div>
        )}
      </div>

      <div className={`flex-1 space-y-2 p-3 sm:p-3.5 ${isFeed ? "text-zinc-100" : ""}`}>
        <h3 className={`font-semibold ${isLarge ? "text-lg" : "text-base"}`}>{movie.title}</h3>
        <p className={`min-h-[1.25rem] text-sm ${isFeed ? "text-zinc-300" : "text-gray-500"}`}>
          {typeYearLine || "Desconocido"}
        </p>
        <p className={`min-h-[1.25rem] text-sm ${isFeed ? "text-zinc-400" : "text-gray-600"}`}>{genresLine}</p>
        <div
          className={`mt-2 grid grid-cols-3 gap-1.5 rounded-lg border px-2 py-2 text-center ${
            isFeed ? "border-white/10 bg-black/35 text-zinc-200" : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
        >
          <div>
            <p className={`text-[10px] uppercase tracking-[0.12em] ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>
              General
            </p>
            <p className="text-sm font-semibold">{renderRating(movie.displayRating)}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase tracking-[0.12em] ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>
              Seguidos
            </p>
            <p className="text-sm font-semibold">{renderRating(movie.followingAvgRating)}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase tracking-[0.12em] ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>
              Mi puntaje
            </p>
            <p className="text-sm font-semibold">{renderRating(movie.myRating)}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
