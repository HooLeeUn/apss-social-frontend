"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyboardEvent, memo } from "react";
import { Movie } from "../lib/movies";
import { formatAverageRating, formatFollowingRating, formatMyRating } from "../lib/rating-format";
import RatingPopover from "./RatingPopover";

interface MovieCardProps {
  movie: Movie;
  variant?: "large" | "compact" | "feed";
  linkToDetail?: boolean;
  onRated?: (movieId: Movie["id"], score: number, payload?: unknown) => void | Promise<void>;
}

function formatContentType(contentType: string) {
  const normalized = contentType.trim().toLowerCase();
  if (normalized === "movie") return "Película";
  if (normalized === "series" || normalized === "tv series" || normalized === "tvseries") return "Serie";
  if (!contentType.trim()) return "Desconocido";
  return contentType;
}

function MovieCard({ movie, variant = "compact", linkToDetail = true, onRated }: MovieCardProps) {
  const router = useRouter();
  const isLarge = variant === "large";
  const isFeed = variant === "feed";
  const detailHref = `/movies/${encodeURIComponent(String(movie.id))}`;
  const typeYearLine = [formatContentType(movie.contentType), movie.year && movie.year !== "-" ? movie.year : null]
    .filter(Boolean)
    .join(" · ");
  const genresLine = movie.genres.length > 0 ? movie.genres.join(" · ") : "Sin género";

  const canNavigateFromCard = isFeed && linkToDetail;

  const navigateToDetail = () => {
    if (!canNavigateFromCard) return;
    router.push(detailHref);
  };

  const handleCardClick = () => {
    if (!canNavigateFromCard) return;
    navigateToDetail();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!canNavigateFromCard) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToDetail();
    }
  };

  const cardContent = (
    <article
      className={`overflow-hidden rounded-xl border shadow-sm transition-colors ${
        isFeed ? "border border-white/35 bg-zinc-950/90 text-zinc-100" : "border border-gray-200 bg-white"
      } ${isLarge || isFeed ? "flex" : ""} ${canNavigateFromCard ? "cursor-pointer" : ""}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      role={canNavigateFromCard ? "link" : undefined}
      tabIndex={canNavigateFromCard ? 0 : undefined}
      aria-label={canNavigateFromCard ? `Ver detalle y comentarios de ${movie.title}` : undefined}
    >
      <div
        className={`group relative flex-shrink-0 ${isFeed ? "h-[164px] w-[108px] bg-zinc-900 sm:h-[172px] sm:w-[114px]" : "bg-gray-200"} ${
          isLarge ? "h-72 md:h-auto md:w-48" : isFeed ? "" : "h-56"
        }`}
      >
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.posterUrl}
            alt={`Poster de ${movie.title}`}
            className="h-full w-full object-cover"
            loading={isFeed ? "lazy" : "eager"}
            decoding="async"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center px-3 text-center text-sm ${
              isFeed ? "text-zinc-400" : "text-gray-500"
            }`}
          >
            Poster no disponible
          </div>
        )}

        {canNavigateFromCard ? (
          <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/65 via-black/20 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="rounded-full border border-white/35 bg-black/40 px-2 py-1 text-[11px] font-medium text-zinc-100">
              Ver comentarios
            </span>
          </div>
        ) : null}
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
                <span aria-label="Calificación general">{formatAverageRating(movie.displayRating)}</span>
              </>
            ) : (
              <>
                <p className={`text-[10px] uppercase tracking-[0.12em] ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>General</p>
                <p className="text-sm font-semibold">{formatAverageRating(movie.displayRating)}</p>
              </>
            )}
          </div>
          <div className={isFeed ? "flex items-center gap-1 text-sm font-semibold" : ""}>
            {isFeed ? (
              <>
                <span aria-hidden="true">👥</span>
                <span aria-label="Calificación de seguidos">
                  {formatFollowingRating(movie.followingAvgRating, movie.followingRatingsCount)}
                </span>
              </>
            ) : (
              <>
                <p className={`text-[10px] uppercase tracking-[0.12em] ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>Seguidos</p>
                <p className="text-sm font-semibold">{formatFollowingRating(movie.followingAvgRating, movie.followingRatingsCount)}</p>
              </>
            )}
          </div>
          <div className={isFeed ? "flex items-center gap-1 text-sm font-semibold" : ""}>
            {isFeed ? (
              onRated ? (
                <RatingPopover
                  movieId={movie.id}
                  currentRating={movie.myRating}
                  onRated={(score, payload) => onRated(movie.id, score, payload)}
                  nullLabel="—"
                  ariaLabel="Mi calificación"
                />
              ) : (
                <>
                  <span aria-hidden="true">🙋</span>
                  <span aria-label="Mi calificación">{formatMyRating(movie.myRating)}</span>
                </>
              )
            ) : (
              <>
                <p className={`text-[10px] uppercase tracking-[0.12em] ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>Mi calificación</p>
                <p className="text-sm font-semibold">{formatMyRating(movie.myRating)}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );

  if (!linkToDetail || isFeed) {
    return cardContent;
  }

  return (
    <Link href={detailHref} className="block">
      {cardContent}
    </Link>
  );
}

export default memo(MovieCard);
