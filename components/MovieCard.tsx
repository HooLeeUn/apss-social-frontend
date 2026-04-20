"use client";

import Link from "next/link";
import { memo } from "react";
import { Movie } from "../lib/movies";
import { formatAverageRating, formatFollowingRating, formatFollowingRatingsCount, formatMyRating } from "../lib/rating-format";
import CommentDetailButton from "./CommentDetailButton";
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
  const isLarge = variant === "large";
  const isFeed = variant === "feed";
  const detailHref = `/movies/${encodeURIComponent(String(movie.id))}`;
  const typeYearLine = [formatContentType(movie.contentType), movie.year && movie.year !== "-" ? movie.year : null]
    .filter(Boolean)
    .join(" · ");
  const genresLine = movie.genres.length > 0 ? movie.genres.join(" · ") : "Sin género";
  const displayTitle = movie.displayTitle || movie.title;

  const cardContent = (
    <article
      className={`overflow-hidden rounded-xl border shadow-sm transition-colors ${
        isFeed ? "border border-white/35 bg-zinc-950/90 text-zinc-100" : "border border-gray-200 bg-white"
      } ${isLarge || isFeed ? "flex" : ""}`}
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
            alt={`Poster de ${displayTitle}`}
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

      </div>

      <div className={`flex min-w-0 flex-1 flex-col p-3 sm:p-3.5 ${isFeed ? "justify-between text-zinc-100" : "space-y-2"}`}>
        <div className={isFeed ? "min-w-0 space-y-1.5" : "space-y-2"}>
          <h3 className={`truncate font-semibold ${isLarge ? "text-lg" : "text-base"}`}>{displayTitle}</h3>
          <p className={`truncate text-sm ${isFeed ? "text-zinc-300" : "text-gray-500"}`}>{typeYearLine || "Desconocido"}</p>
          <p className={`truncate text-sm ${isFeed ? "text-zinc-400" : "text-gray-600"}`}>{genresLine}</p>
        </div>
        <div
          className={`mt-2 rounded-lg border ${
            isFeed
              ? "flex items-center gap-2 border-white/10 bg-black/35 px-2.5 py-2 text-zinc-200"
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
              <div className="flex flex-col leading-tight">
                <span className="font-semibold" aria-label="Calificación de seguidos">👥 {formatFollowingRating(movie.followingAvgRating)}</span>
                {formatFollowingRatingsCount(movie.followingRatingsCount) ? (
                  <span className="text-[10px] font-normal text-zinc-500">{formatFollowingRatingsCount(movie.followingRatingsCount)}</span>
                ) : null}
              </div>
            ) : (
              <>
                <p className={`text-[10px] uppercase tracking-[0.12em] ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>Seguidos</p>
                <p className="text-sm font-semibold">{formatFollowingRating(movie.followingAvgRating)}</p>
                {formatFollowingRatingsCount(movie.followingRatingsCount) ? (
                  <p className="text-[10px] font-normal text-zinc-500">{formatFollowingRatingsCount(movie.followingRatingsCount)}</p>
                ) : null}
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
                <p className={`text-[11px] uppercase tracking-wide whitespace-nowrap ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>MI CALIF.</p>
                <p className="text-sm font-semibold">{formatMyRating(movie.myRating)}</p>
              </>
            )}
          </div>
          {isFeed ? <CommentDetailButton href={detailHref} title={displayTitle} className="ml-auto h-8 w-8 shrink-0" /> : null}
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
