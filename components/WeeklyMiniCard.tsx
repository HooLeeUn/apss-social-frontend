"use client";

import { memo } from "react";
import { Movie } from "../lib/movies";
import { formatAverageRating, formatFollowingRating, formatFollowingRatingsCount, formatMyRating } from "../lib/rating-format";
import CommentDetailButton from "./CommentDetailButton";
import RatingPopover from "./RatingPopover";

interface WeeklyMiniCardProps {
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

function WeeklyMiniCard({ movie, fallbackLabel, onRated }: WeeklyMiniCardProps) {
  const title = movie?.title ?? fallbackLabel;
  const genres = movie?.genres?.filter(Boolean) ?? [];
  const genre = genres.length ? genres.slice(0, 3).join(" • ") : "Sin género";
  const type = movie?.contentType ?? "Movie / Series";
  const year = movie?.year?.trim();
  const hasYear = Boolean(year && year !== "-");
  const topUserName = movie?.topUser?.name?.trim() || "Top user";
  const detailHref = movie ? `/movies/${encodeURIComponent(String(movie.id))}` : null;

  return (
    <article className="relative h-full pl-4">
      <div className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-semibold text-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.45)]">
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

      <div className="absolute right-[calc(34%+0.35rem)] top-1/2 z-10 -translate-y-1/2">
        <CommentDetailButton href={detailHref} title={title} className="h-[30px] w-[30px]" />
      </div>

      <div className="flex h-full overflow-hidden rounded-xl border border-white/25 bg-zinc-950 p-[2px] shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
        <div className="flex h-full w-full overflow-hidden rounded-[10px] border border-white/10 bg-zinc-900/90">
          <div className="flex min-w-0 flex-1 flex-col p-2.5 pt-2">
            <div className="flex h-full min-w-0 flex-col justify-between">
              <div className="min-w-0">
                <h4 className="line-clamp-2 min-h-[2.4rem] text-sm font-semibold leading-snug text-zinc-50">{title}</h4>

                <div className="mt-2 min-h-[2.7rem]">
                  <p className="line-clamp-2 text-[11px] leading-snug text-zinc-400">
                    <span>{genre}</span>
                    <span className="mx-1.5 text-zinc-600">•</span>
                    <span>{type}</span>
                    <span className="mx-1.5 text-zinc-600">•</span>
                    <span className="inline-block min-w-[4ch] tabular-nums">{hasYear ? year : "\u00A0"}</span>
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex flex-wrap items-start gap-1.5 text-[10px] text-zinc-200">
                  <span className="rounded-md border border-white/10 bg-zinc-950/80 px-1.5 py-0.5">⭐ {formatAverageRating(movie?.displayRating)}</span>
                  <span className="rounded-md border border-white/10 bg-zinc-950/80 px-1.5 py-0.5">
                    <span className="flex flex-col leading-tight">
                      <span>👥 {formatFollowingRating(movie?.followingAvgRating)}</span>
                      {formatFollowingRatingsCount(movie?.followingRatingsCount) ? (
                        <span className="text-[10px] font-normal text-zinc-500">{formatFollowingRatingsCount(movie?.followingRatingsCount)}</span>
                      ) : null}
                    </span>
                  </span>
                  {movie && onRated ? (
                    <RatingPopover
                      movieId={movie.id}
                      currentRating={movie.myRating}
                      onRated={(score, payload) => onRated(movie.id, score, payload)}
                      nullLabel="—"
                      ariaLabel="Mi calificación"
                    />
                  ) : (
                    <span className="rounded-md border border-white/10 bg-zinc-950/80 px-1.5 py-0.5">🙋 {formatMyRating(movie?.myRating)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="w-[34%] min-w-[72px] max-w-[92px] border-l border-white/10 bg-zinc-950">
            <div className="h-full w-full">
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
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 px-2 text-center text-[10px] text-zinc-400">
                  Sin poster
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(WeeklyMiniCard);
