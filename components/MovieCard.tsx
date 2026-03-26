import { Movie } from "../lib/movies";

interface MovieCardProps {
  movie: Movie;
  variant?: "large" | "compact" | "feed";
}

function renderRating(value: number | null) {
  return value !== null ? value.toFixed(1) : "-";
}

export default function MovieCard({ movie, variant = "compact" }: MovieCardProps) {
  const isLarge = variant === "large";
  const isFeed = variant === "feed";

  return (
    <article
      className={`overflow-hidden rounded-xl border shadow-sm ${
        isFeed
          ? "border-2 border-white/70 bg-zinc-950 text-zinc-100"
          : "border border-gray-200 bg-white"
      } ${
        isLarge ? "md:flex" : ""
      }`}
    >
      <div
        className={`flex-shrink-0 ${
          isFeed ? "h-52 bg-zinc-900" : "bg-gray-200"
        } ${
          isLarge ? "h-72 md:h-auto md:w-48" : isFeed ? "sm:h-56" : "h-56"
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

      <div className={`flex-1 space-y-2 p-4 ${isFeed ? "text-zinc-100" : ""}`}>
        <h3 className={`font-semibold ${isLarge ? "text-lg" : "text-base"}`}>{movie.title}</h3>
        <p className={`text-sm ${isFeed ? "text-zinc-300" : "text-gray-500"}`}>{movie.contentType}</p>
        <p className={`text-sm ${isFeed ? "text-zinc-400" : "text-gray-600"}`}>
          {movie.year} · {movie.genres.length > 0 ? movie.genres.join(", ") : "Sin género"}
        </p>
        <div className={`space-y-1 text-sm ${isFeed ? "text-zinc-300" : "text-gray-700"}`}>
          <p>⭐ Rating general: {renderRating(movie.displayRating)}</p>
          <p>🙋 Mi rating: {renderRating(movie.myRating)}</p>
          <p>👥 Following avg: {renderRating(movie.followingAvgRating)}</p>
        </div>
      </div>
    </article>
  );
}
