"use client";

import { KeyboardEvent, memo } from "react";
import { useRouter } from "next/navigation";
import { Movie } from "../lib/movies";
import { formatAverageRating, formatFollowingRating, formatMyRating } from "../lib/rating-format";
import RatingPopover from "./RatingPopover";

interface WeeklyHeroCardProps {
  movie?: Movie;
  fallbackLabel: string;
  onRated?: (movieId: Movie["id"], score: number, payload?: unknown) => void | Promise<void>;
}

function getAvatarFallback(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return "★";

  const [first, second] = trimmed.split(/\s+/);
  const initials = `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase();
  return initials || "★";
}

function WeeklyHeroCard({ movie, fallbackLabel, onRated }: WeeklyHeroCardProps) {
  const router = useRouter();
  const title = movie?.title ?? fallbackLabel;
  const genre = movie?.genres?.[0] ?? "Sin género";
  const type = movie?.contentType ?? "Movie / Series";
  const year = movie?.year?.trim();
  const hasYear = Boolean(year && year !== "-");
  const topUserName = movie?.topUser?.name?.trim() || "Top user";
  const detailHref = movie ? `/movies/${encodeURIComponent(String(movie.id))}` : null;

  const navigateToDetail = () => {
    if (!detailHref) return;
    router.push(detailHref);
  };

  const handleCardClick = () => {
    if (!detailHref) return;
    navigateToDetail();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!detailHref) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToDetail();
    }
  };

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/25 bg-zinc-950 p-[3px] shadow-[0_24px_55px_rgba(0,0,0,0.55)] ${
        detailHref ? "cursor-pointer" : ""
      }`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      role={detailHref ? "link" : undefined}
      tabIndex={detailHref ? 0 : undefined}
      aria-label={detailHref ? `Ver detalle y comentarios de ${title}` : undefined}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-white/15 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
        <div className="mx-auto w-full max-w-[280px] px-4 pt-4 sm:max-w-[300px]">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/20 bg-zinc-900">
            {movie?.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={movie.posterUrl}
                alt={`Poster de ${title}`}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 px-6 text-center text-sm text-zinc-300">
                Poster próximamente
              </div>
            )}
          </div>

          <div className="flex justify-center py-3">
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-zinc-800 text-xs font-semibold text-zinc-100">
                {movie?.topUser?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={movie.topUser.avatarUrl}
                    alt={`Top user: ${topUserName}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span>{getAvatarFallback(movie?.topUser?.name)}</span>
                )}
              </div>
              <p className="max-w-[160px] truncate text-center text-[11px] uppercase tracking-[0.15em] text-zinc-400">
                {topUserName}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto border-t border-white/10 bg-zinc-950/80 p-4 text-zinc-100">
          <h3 className="line-clamp-2 text-xl font-semibold leading-tight text-zinc-50">{title}</h3>

          <p className="mt-2 text-sm text-zinc-400">
            <span>{genre}</span>
            <span className="mx-2 text-zinc-600">•</span>
            <span>{type}</span>
            <span className="mx-2 text-zinc-600">•</span>
            <span className="inline-block min-w-[4ch] tabular-nums">{hasYear ? year : "\u00A0"}</span>
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 sm:gap-3">
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">General</p>
              <p className="text-base font-semibold text-zinc-100">⭐ {formatAverageRating(movie?.displayRating)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Seguidos</p>
              <p className="text-base font-semibold text-zinc-100">👥 {formatFollowingRating(movie?.followingAvgRating, movie?.followingRatingsCount)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Mi calificación</p>
              <div className="mt-1">
                {movie && onRated ? (
                  <RatingPopover
                    movieId={movie.id}
                    currentRating={movie.myRating}
                    onRated={(score, payload) => onRated(movie.id, score, payload)}
                    nullLabel="—"
                    ariaLabel="Mi calificación"
                  />
                ) : (
                  <p className="text-base font-semibold text-zinc-100">🙋 {formatMyRating(movie?.myRating)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(WeeklyHeroCard);
