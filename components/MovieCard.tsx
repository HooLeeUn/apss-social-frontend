import { Movie } from "../lib/movies";

interface MovieCardProps {
  movie: Movie;
  variant?: "large" | "compact";
}

function renderRating(value: number | null) {
  return value !== null ? value.toFixed(1) : "-";
}

export default function MovieCard({ movie, variant = "compact" }: MovieCardProps) {
  const isLarge = variant === "large";

  return (
    <article
      className={`rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm ${
        isLarge ? "md:flex" : ""
      }`}
    >
      <div
        className={`bg-gray-200 flex-shrink-0 ${
          isLarge ? "h-72 md:h-auto md:w-48" : "h-56"
        }`}
      >
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={movie.posterUrl} alt={`Poster de ${movie.title}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm px-3 text-center">
            Poster no disponible
          </div>
        )}
      </div>

      <div className="p-4 space-y-2 flex-1">
        <h3 className={`font-semibold ${isLarge ? "text-lg" : "text-base"}`}>{movie.title}</h3>
        <p className="text-sm text-gray-600">
          {movie.year} · {movie.genres.length > 0 ? movie.genres.join(", ") : "Sin género"}
        </p>
        <div className="text-sm text-gray-700 space-y-1">
          <p>⭐ Rating general: {renderRating(movie.displayRating)}</p>
          <p>🙋 Mi rating: {renderRating(movie.myRating)}</p>
          <p>👥 Following avg: {renderRating(movie.followingAvgRating)}</p>
        </div>
      </div>
    </article>
  );
}
