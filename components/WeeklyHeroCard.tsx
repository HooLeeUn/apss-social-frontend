"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { Movie } from "../lib/movies";
import { formatAverageRating, formatFollowingRating, formatFollowingRatingsCount, formatMyRating } from "../lib/rating-format";
import CommentDetailButton from "./CommentDetailButton";
import RatingPopover from "./RatingPopover";

interface WeeklyHeroCardProps {
  movie?: Movie;
  fallbackLabel: string;
  currentUserId?: string | number | null;
  onRated?: (movieId: Movie["id"], score: number, payload?: unknown) => void | Promise<void>;
}

function getAvatarFallback(username?: string | null): string {
  const trimmed = username?.trim();
  if (!trimmed) return "★";

  const [first, second] = trimmed.split(/\s+/);
  const initials = `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase();
  return initials || "★";
}

function WeeklyHeroCard({ movie, fallbackLabel, currentUserId, onRated }: WeeklyHeroCardProps) {
  const title = movie?.displayTitle ?? movie?.title ?? fallbackLabel;
  const secondaryTitle = movie?.displaySecondaryTitle ?? null;
  const genre = movie?.genres?.[0] ?? "Sin género";
  const type = movie?.contentType ?? "Movie / Series";
  const year = movie?.year?.trim();
  const hasYear = Boolean(year && year !== "-");
  const topUsername = movie?.topUser?.username?.trim() || "Top user";
  const topUserId = movie?.topUser?.id;
  const topUserAvatar = movie?.topUser?.avatar ?? null;
  const [avatarFailedSrc, setAvatarFailedSrc] = useState<string | null>(null);
  const detailHref = movie ? `/movies/${encodeURIComponent(String(movie.id))}` : null;
  const hasAvatarError = Boolean(topUserAvatar && avatarFailedSrc === topUserAvatar);
  const hasTopUserNavigationData = Boolean(topUsername && topUserId !== null && topUserId !== undefined);
  const isCurrentUser = hasTopUserNavigationData && currentUserId !== null && currentUserId !== undefined
    ? String(topUserId) === String(currentUserId)
    : false;
  const topUserHref = hasTopUserNavigationData
    ? isCurrentUser
      ? "/profile-feed"
      : `/users/${encodeURIComponent(topUsername)}`
    : null;

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/25 bg-zinc-950 p-[3px] shadow-[0_24px_55px_rgba(0,0,0,0.55)]">
      <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-white/15 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
        <div className="mx-auto w-full max-w-[268px] px-4 pt-3 sm:max-w-[288px]">
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

          <div className="py-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col items-start gap-1">
                {topUserHref ? (
                  <Link
                    href={topUserHref}
                    aria-label={`Ir al perfil de ${topUsername}`}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/25 bg-zinc-800 text-xs font-semibold text-zinc-100"
                  >
                    {topUserAvatar && !hasAvatarError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={topUserAvatar}
                        alt={`Top user: ${topUsername}`}
                        className="block h-full w-full object-cover object-center"
                        loading="lazy"
                        decoding="async"
                        onError={() => setAvatarFailedSrc(topUserAvatar)}
                      />
                    ) : (
                      <span>{getAvatarFallback(movie?.topUser?.username)}</span>
                    )}
                  </Link>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-zinc-800 text-xs font-semibold text-zinc-100">
                    {topUserAvatar && !hasAvatarError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={topUserAvatar}
                        alt={`Top user: ${topUsername}`}
                        className="block h-full w-full object-cover object-center"
                        loading="lazy"
                        decoding="async"
                        onError={() => setAvatarFailedSrc(topUserAvatar)}
                      />
                    ) : (
                      <span>{getAvatarFallback(movie?.topUser?.username)}</span>
                    )}
                  </div>
                )}
                <p className="max-w-[150px] truncate text-left text-[11px] uppercase tracking-[0.15em] text-zinc-400">
                  {topUsername}
                </p>
              </div>
              <CommentDetailButton href={detailHref} title={title} className="h-9 w-9 shrink-0" />
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col border-t border-white/10 bg-zinc-950/80 p-3.5 text-zinc-100">
          <h3 className="line-clamp-2 text-xl font-semibold leading-tight text-zinc-50">
            {detailHref ? (
              <Link
                href={detailHref}
                aria-label={`Ver detalle de ${title}`}
                className="inline cursor-pointer transition-colors duration-150 hover:text-blue-100 focus-visible:text-blue-100 focus-visible:outline-none"
              >
                {title}
              </Link>
            ) : (
              title
            )}
          </h3>
          {secondaryTitle ? (
            <p className="mt-1 line-clamp-1 text-sm leading-tight text-blue-200/80">
              {detailHref ? (
                <Link
                  href={detailHref}
                  aria-label={`Ver detalle de ${title} (${secondaryTitle})`}
                  className="inline cursor-pointer transition-colors duration-150 hover:text-blue-100 focus-visible:text-blue-100 focus-visible:outline-none"
                >
                  {secondaryTitle}
                </Link>
              ) : (
                secondaryTitle
              )}
            </p>
          ) : null}

          <p className="mt-2 text-sm text-zinc-400">
            <span>{genre}</span>
            <span className="mx-2 text-zinc-600">•</span>
            <span>{type}</span>
            <span className="mx-2 text-zinc-600">•</span>
            <span className="inline-block min-w-[4ch] tabular-nums">{hasYear ? year : "\u00A0"}</span>
          </p>

          <div className="mt-auto grid grid-cols-1 gap-2 pt-3 text-sm sm:grid-cols-3 sm:gap-3">
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide whitespace-nowrap text-zinc-500">General</p>
              <p className="text-base font-semibold text-zinc-100">⭐ {formatAverageRating(movie?.displayRating)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide whitespace-nowrap text-zinc-500">Seguidos</p>
              <p className="text-base font-semibold text-zinc-100">👥 {formatFollowingRating(movie?.followingAvgRating)}</p>
              {formatFollowingRatingsCount(movie?.followingRatingsCount) ? (
                <p className="text-[10px] text-zinc-500">{formatFollowingRatingsCount(movie?.followingRatingsCount)}</p>
              ) : null}
            </div>
            <div className="rounded-lg border border-blue-500/35 bg-zinc-900/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide whitespace-nowrap text-blue-300">MI CALIF.</p>
              <div className="mt-1">
                {movie && onRated ? (
                  <RatingPopover
                    movieId={movie.id}
                    currentRating={movie.myRating}
                    onRated={(score, payload) => onRated(movie.id, score, payload)}
                    nullLabel="—"
                    ariaLabel="Mi calificación"
                    className="w-full [&_button]:w-full [&_button]:justify-between [&_button]:border-blue-500/40 [&_button]:text-blue-200 [&_button:hover]:border-blue-400/80"
                  />
                ) : (
                  <p className="text-base font-semibold text-blue-200">🙋 {formatMyRating(movie?.myRating)}</p>
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
