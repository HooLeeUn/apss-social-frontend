"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { Movie } from "../lib/movies";
import { formatAverageRating, formatFollowingRating, formatMyRating } from "../lib/rating-format";
import CommentDetailButton from "./CommentDetailButton";
import RatingPopover from "./RatingPopover";

interface WeeklyMiniCardProps {
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

function WeeklyMiniCard({ movie, fallbackLabel, currentUserId, onRated }: WeeklyMiniCardProps) {
  const title = movie?.displayTitle ?? movie?.title ?? fallbackLabel;
  const secondaryTitle = movie?.displaySecondaryTitle ?? null;
  const genres = movie?.genres?.filter(Boolean) ?? [];
  const genre = genres.length ? genres.slice(0, 3).join(" • ") : "Sin género";
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
  const followingRatingsCount = movie?.followingRatingsCount ?? 0;
  const followingRatingsTitle = followingRatingsCount > 0
    ? `${followingRatingsCount} ${followingRatingsCount === 1 ? "calificación" : "calificaciones"} de usuarios seguidos`
    : "Sin calificaciones de usuarios seguidos";

  return (
    <article className="relative h-full pl-4">
      <div className="interaction-icons pointer-events-none absolute left-10 top-[59%] z-10" aria-hidden="true">
        <span className="interaction-icon interaction-icon--compact interaction-icon--up">☝️</span>
        <span className="interaction-icon interaction-icon--compact interaction-icon--ok">👌</span>
      </div>
      {topUserHref ? (
        <Link
          href={topUserHref}
          aria-label={`Ir al perfil de ${topUsername}`}
          className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/30 bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-semibold text-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
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
        <div className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-semibold text-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.45)]">
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

      <div className="absolute right-[calc(34%+0.35rem)] top-1/2 z-10 -translate-y-1/2">
        <CommentDetailButton href={detailHref} title={title} className="h-[30px] w-[30px]" />
      </div>

      <div className="flex h-full overflow-hidden rounded-xl border border-white/25 bg-zinc-950 p-[2px] shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
        <div className="flex h-full w-full overflow-hidden rounded-[10px] border border-white/10 bg-zinc-900/90">
          <div className="flex min-w-0 flex-1 flex-col p-2.5 pt-2">
            <div className="flex h-full min-w-0 flex-col justify-between">
              <div className="min-w-0">
                <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-50">
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
                </h4>
                {secondaryTitle ? (
                  <p className="mt-0.5 line-clamp-1 min-h-[1rem] text-[11px] leading-tight text-blue-200/80">
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
                ) : (
                  <div className="min-h-[1rem]" aria-hidden="true" />
                )}

                <div className="mt-1.5 min-h-[2.7rem]">
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
                <div className="grid grid-cols-3 gap-1 text-[9px] text-zinc-200">
                  <span className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-white/10 bg-zinc-950/80 px-1 py-1 text-center">
                    <span className="text-[10px] font-semibold text-zinc-100">⭐ {formatAverageRating(movie?.displayRating)}</span>
                  </span>
                  <span
                    className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-white/10 bg-zinc-950/80 px-1 py-1 text-center"
                    title={followingRatingsTitle}
                  >
                    <span className="truncate text-[10px] font-semibold text-zinc-100">👥 {formatFollowingRating(movie?.followingAvgRating)}</span>
                  </span>
                  {movie && onRated ? (
                    <RatingPopover
                      movieId={movie.id}
                      currentRating={movie.myRating}
                      onRated={(score, payload) => onRated(movie.id, score, payload)}
                      nullLabel="—"
                      ariaLabel="Mi calificación"
                      className="w-full [&_button]:w-full [&_button]:justify-center [&_button]:gap-1 [&_button]:whitespace-nowrap [&_button]:cursor-pointer [&_button]:border-blue-400/65 [&_button]:bg-blue-950/45 [&_button]:px-1 [&_button]:py-1 [&_button]:text-[10px] [&_button]:font-semibold [&_button]:text-blue-100 [&_button]:shadow-[0_3px_10px_rgba(59,130,246,0.24)] [&_button:hover]:-translate-y-px [&_button:hover]:border-blue-300/90 [&_button:hover]:shadow-[0_7px_15px_rgba(59,130,246,0.3)]"
                    />
                  ) : (
                    <span className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-blue-400/65 bg-blue-950/45 px-1 py-1 text-center shadow-[0_3px_10px_rgba(59,130,246,0.24)] transition-all duration-150 hover:-translate-y-px hover:border-blue-300/90 hover:shadow-[0_7px_15px_rgba(59,130,246,0.3)]">
                      <span className="text-[10px] font-semibold text-blue-100">🙋 {formatMyRating(movie?.myRating)}</span>
                    </span>
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
