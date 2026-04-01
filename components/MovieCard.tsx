import Link from "next/link";
import { Movie } from "../lib/movies";
import RatingPopover from "./RatingPopover";

interface MovieCardProps {
  movie: Movie;
  variant?: "large" | "compact" | "feed";
  linkToDetail?: boolean;
  onRated?: (movieId: Movie["id"], score: number) => void;
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

export default function MovieCard({ movie, variant = "compact", linkToDetail = true, onRated }: MovieCardProps) {
  const isLarge = variant === "large";
  const isFeed = variant === "feed";
  const typeYearLine = [formatContentType(movie.contentType), movie.year && movie.year !== "-" ? movie.year : null]
    .filter(Boolean)
    .join(" · ");
  const genresLine = movie.genres.length > 0 ? movie.genres.join(" · ") : "Sin género";

  const cardContent = (
    <article
      className={`overflow-hidden rounded-xl border shadow-sm transition-colors ${
        isFeed ? "border border-white/35 bg-zinc-950/90 text-zinc-100" : "border border-gray-200 bg-white"
      } ${isLarge || isFeed ? "flex" : ""}`}
    >
      <div
        className={`flex-shrink-0 ${isFeed ? "h-[164px] w-[108px] bg-zinc-900 sm:h-[172px] sm:w-[114px]" : "bg-gray-200"} ${
          isLarge ? "h-72 md:h-auto md:w-48" : isFeed ? "" : "h-56"
        }`}
      >
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={movie.posterUrl} alt={`Poster de ${movie.title}`} className="h-full w-full object-cover" />
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

      <div className={`flex min-w-0 flex-1 flex-col p-3 sm:p-3.5 ${isFeed ? "justify-between text-zinc-100" : "space-y-2"}`}>
        <div className={isFeed ? "min-w-0 space-y-1.5" : "space-y-2"}>
          <h3 className={`truncate font-semibold ${isLarge ? "text-lg" : "text-base"}`}>{movie.title}</h3>
          <p className={`truncate text-sm ${isFeed ? "text-zinc-300" : "text-gray-500"}`}>{typeYearLine || "Desconocido"}</p>
          <p className={`truncate text-sm ${isFeed ? "text-zinc-400" : "text-gray-600"}`}>{genresLine}</p>
        </div>
        <div
          className={`mt-2 rounded-lg border ${
            isFeed
              ? "flex items-center gap-3 border-white/10 bg-black/35 px-2.5 py-2 text-zinc-200"
              : "grid grid-cols-3 gap-1.5 border-gray-200 bg-gray-50 px-2 py-2 text-center text-gray-700"
          }`}
        >
          <div className={isFeed ? "flex items-center gap-1 text-sm font-semibold" : ""}>
            {isFeed ? (
              <>
                <span aria-hidden="true">⭐</span>
                <span aria-label="Puntaje general">{renderRating(movie.displayRating)}</span>
              </>
            ) : (
              <>
                <p className={`text-[10px] uppercase tracking-[0.12em] ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>General</p>
                <p className="text-sm font-semibold">{renderRating(movie.displayRating)}</p>
              </>
            )}
          </div>
          <div className={isFeed ? "flex items-center gap-1 text-sm font-semibold" : ""}>
            {isFeed ? (
              <>
                <span aria-hidden="true">👥</span>
                <span aria-label="Puntaje de seguidos">{renderRating(movie.followingAvgRating)}</span>
              </>
            ) : (
              <>
                <p className={`text-[10px] uppercase tracking-[0.12em] ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>Seguidos</p>
                <p className="text-sm font-semibold">{renderRating(movie.followingAvgRating)}</p>
              </>
            )}
          </div>
          <div className={isFeed ? "flex items-center gap-1 text-sm font-semibold" : ""}>
            {isFeed ? (
              onRated ? (
                <RatingPopover
                  movieId={movie.id}
                  currentRating={movie.myRating}
                  onRated={(score) => onRated(movie.id, score)}
                />
              ) : (
                <>
                  <span aria-hidden="true">🙋</span>
                  <span aria-label="Mi puntaje">{renderRating(movie.myRating)}</span>
                </>
              )
            ) : (
              <>
                <p className={`text-[10px] uppercase tracking-[0.12em] ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>Mi puntaje</p>
                <p className="text-sm font-semibold">{renderRating(movie.myRating)}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );

  if (!linkToDetail) {
    return cardContent;
  }

  return (
    <Link href={`/movies/${encodeURIComponent(String(movie.id))}`} className="block">
      {cardContent}
    </Link>
  );
}
