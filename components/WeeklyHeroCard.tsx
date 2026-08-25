"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { useI18n } from "../hooks/useI18n";
import { resolveMovieTitles } from "../lib/i18n";
import { addMovieToMyList, addMovieToMyRecommendations, Movie, removeMovieFromMyList, removeMovieFromMyRecommendations } from "../lib/movies";
import { formatAverageRating, formatFollowingRating, formatFollowingRatingsCount, formatMyRating } from "../lib/rating-format";
import { useTrailerHover } from "../hooks/useTrailerHover";
import { useTrailerLongPress } from "../hooks/useTrailerLongPress";
import CommentDetailButton from "./CommentDetailButton";
import MyListIcon from "./MyListIcon";
import RatingPopover from "./RatingPopover";
import TrailerHoverOverlay from "./TrailerHoverOverlay";
import TrailerModal from "./TrailerModal";
import PosterImage from "./PosterImage";
import type { AppBranding } from "../lib/branding";
import { RatingUserSmileIcon } from "./RatingIcons";

interface WeeklyHeroCardProps {
  movie?: Movie;
  fallbackLabel: string;
  currentUserId?: string | number | null;
  onRated?: (movieId: Movie["id"], score: number, payload?: unknown) => void | Promise<void>;
  isInMyList?: boolean;
  onToggleMyList?: (movieId: Movie["id"], nextValue: boolean) => Promise<void> | void;
  isInMyRecommendations?: boolean;
  onToggleMyRecommendations?: (movieId: Movie["id"], nextValue: boolean) => Promise<void> | void;
  trailerHoverDelayMs?: number;
  branding?: AppBranding | null;
}

function getAvatarFallback(username?: string | null): string {
  const trimmed = username?.trim();
  if (!trimmed) return "★";

  const [first, second] = trimmed.split(/\s+/);
  const initials = `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase();
  return initials || "★";
}

function WeeklyHeroCard({ movie, fallbackLabel, currentUserId, onRated, isInMyList = false, onToggleMyList, isInMyRecommendations = false, onToggleMyRecommendations, trailerHoverDelayMs, branding = null }: WeeklyHeroCardProps) {
  const { locale, country, t } = useI18n();
  const resolvedTitles = resolveMovieTitles(locale, movie?.titleSpanish, movie?.titleEnglish, movie?.displayTitle ?? movie?.title ?? fallbackLabel);
  const title = resolvedTitles.primary;
  const secondaryTitle = resolvedTitles.secondary ?? movie?.displaySecondaryTitle ?? null;
  const genre = movie?.genres?.[0] ?? "Sin género";
  const type = movie?.contentType ?? "Movie / Series";
  const year = movie?.year?.trim();
  const hasYear = Boolean(year && year !== "-");
  const topUsername = movie?.topUser?.username?.trim() || "Top user";
  const topUserId = movie?.topUser?.id;
  const topUserAvatar = movie?.topUser?.avatar ?? null;
  const [avatarFailedSrc, setAvatarFailedSrc] = useState<string | null>(null);
  const posterSrc = movie?.image || movie?.posterUrl || null;
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
  const handleToggleMyList = async () => {
    if (!movie) return;
    const nextValue = !isInMyList;
    try {
      if (onToggleMyList) await onToggleMyList(movie.id, nextValue);
      else if (nextValue) await addMovieToMyList(movie.id);
      else await removeMovieFromMyList(movie.id);
    } catch (error) {
      console.warn("No se pudo actualizar Mi Lista.", error);
    }
  };
  const handleToggleMyRecommendations = async () => {
    if (!movie) return;
    const nextValue = !isInMyRecommendations;
    try {
      if (onToggleMyRecommendations) await onToggleMyRecommendations(movie.id, nextValue);
      else if (nextValue) await addMovieToMyRecommendations(movie.id);
      else await removeMovieFromMyRecommendations(movie.id);
    } catch (error) {
      console.warn("No se pudo actualizar Mis recomendadas.", error);
    }
  };
  const trailerHover = useTrailerHover(movie?.id, country, Boolean(movie), trailerHoverDelayMs);
  const trailerLongPress = useTrailerLongPress(movie?.id, country, Boolean(movie));
  const tagIconClassName = `interaction-icon interaction-icon--hero-sm interaction-icon--hero-lg interaction-icon-tag ${isInMyList ? "interaction-icon-tag--active" : "interaction-icon-tag--inactive"}`;

  return (
    <article className="weekly-hero-card relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/25 bg-zinc-950 p-[3px] shadow-[0_24px_55px_rgba(0,0,0,0.55)]">
      <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-white/15 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
        <div className="mx-auto w-full max-w-[270px] px-4 pt-3 sm:max-w-[270px] lg:max-w-[288px]">
          <div className="relative h-[318px] w-full overflow-hidden rounded-xl border border-white/20 bg-zinc-900 lg:aspect-[2/3] lg:h-auto" onMouseEnter={trailerHover.onMouseEnter} onMouseLeave={trailerHover.onMouseLeave} {...trailerLongPress.posterProps}>
            {movie ? (
              detailHref ? (
                <Link href={detailHref} aria-label={`Ver detalle de ${title}`} className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
                  <PosterImage
                    posterSrc={posterSrc}
                    title={title}
                    branding={branding}
                    className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
                    placeholderClassName="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-950 object-contain p-6"
                    loading="lazy"
                    decoding="async"
                  />
                </Link>
              ) : (
                <PosterImage posterSrc={posterSrc} title={title} branding={branding} className="h-full w-full object-cover" placeholderClassName="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-950 object-contain p-6" loading="lazy" decoding="async" />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 px-6 text-center text-sm text-zinc-300">
                {fallbackLabel}
              </div>
            )}
            <TrailerHoverOverlay loading={trailerHover.loading || trailerLongPress.loading} unavailable={trailerHover.unavailable || trailerLongPress.unavailable} locale={locale} />
          </div>

          <div className="py-2">
            <div className="relative grid grid-cols-4 items-center gap-2 lg:flex lg:items-start lg:justify-between lg:gap-4">
              <div className="flex min-w-0 flex-col items-center gap-1 justify-self-start lg:items-start">
                {topUserHref ? (
                  <Link
                    href={topUserHref}
                    aria-label={`Ir al perfil de ${topUsername}`}
                    title={topUsername}
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
                  <div
                    title={topUsername}
                    aria-label={`Top user: ${topUsername}`}
                    className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-zinc-800 text-xs font-semibold text-zinc-100"
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
                  </div>
                )}
                <span className="sr-only">{topUsername}</span>
              </div>
              <div className="interaction-icons col-span-2 z-10 flex justify-around justify-self-stretch lg:absolute lg:right-12 lg:top-0.5">
                <button type="button" onClick={handleToggleMyList} className="cursor-pointer" aria-label={isInMyList ? "Quitar de Mi Lista" : "Agregar a Mi Lista"}>
                  <MyListIcon cardSize className={tagIconClassName} />
                </button>
                <button type="button" onClick={handleToggleMyRecommendations} className="cursor-pointer" aria-label={isInMyRecommendations ? "Quitar de Mis recomendadas" : "Agregar a Mis recomendadas"}><img src="/icons/Ticket.png" alt="" className={`interaction-icon interaction-icon--hero-sm interaction-icon--hero-lg ${isInMyRecommendations ? "interaction-icon-tag--active" : ""}`} /></button>
              </div>
              <CommentDetailButton title={title} synopsisEs={movie?.synopsis_es} synopsis={movie?.synopsis} className="h-9 w-9 shrink-0 justify-self-end" />
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col border-t border-white/10 bg-zinc-950/80 p-3 text-zinc-100 lg:p-3.5">
          <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-zinc-50 lg:text-xl">
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

          <p className="mt-1.5 text-xs text-zinc-400 lg:mt-2 lg:text-sm">
            <span>{genre}</span>
            <span className="mx-2 text-zinc-600">•</span>
            <span>{type}</span>
            <span className="mx-2 text-zinc-600">•</span>
            <span className="inline-block min-w-[4ch] tabular-nums">{hasYear ? year : "\u00A0"}</span>
          </p>

          <div className="mt-2 grid grid-cols-3 gap-1.5 pt-1 text-xs lg:mt-auto lg:gap-3 lg:pt-3 lg:text-sm">
            <div className="weekly-hero-rating weekly-hero-rating--general rounded-lg border border-transparent bg-zinc-900/40 px-1.5 py-1.5 lg:border-white/10 lg:bg-zinc-900/60 lg:px-3 lg:py-2">
              <p className="text-[11px] uppercase tracking-wide whitespace-nowrap text-zinc-500">General</p>
              <p className="weekly-hero-rating__value whitespace-nowrap text-sm font-semibold text-zinc-100 lg:text-base">⭐ {formatAverageRating(movie?.displayRating)}</p>
            </div>
            <div className="weekly-hero-rating weekly-hero-rating--following rounded-lg border border-transparent bg-zinc-900/40 px-1.5 py-1.5 lg:border-white/10 lg:bg-zinc-900/60 lg:px-3 lg:py-2">
              <p className="text-[11px] uppercase tracking-wide whitespace-nowrap text-zinc-500">{t("following")}</p>
              <p className="whitespace-nowrap text-sm font-semibold text-zinc-100 lg:text-base">👥 {formatFollowingRating(movie?.followingAvgRating)}</p>
              {formatFollowingRatingsCount(movie?.followingRatingsCount) ? (
                <p className="text-[10px] text-zinc-500">{formatFollowingRatingsCount(movie?.followingRatingsCount)}</p>
              ) : null}
            </div>
            <div className="weekly-hero-rating weekly-hero-rating--mine rounded-lg border border-transparent bg-blue-950/25 px-1.5 py-1.5 transition-all duration-150 hover:-translate-y-px lg:bg-blue-950/35 lg:px-3 lg:py-2 lg:shadow-[0_4px_12px_rgba(59,130,246,0.22)] lg:hover:shadow-[0_8px_18px_rgba(59,130,246,0.28)]">
              <p className="text-[11px] uppercase tracking-wide whitespace-nowrap text-blue-200">{t("myRating").toUpperCase()}</p>
              <div className="mt-1">
                {movie && onRated ? (
                  <RatingPopover
                    movieId={movie.id}
                    currentRating={movie.myRating}
                    onRated={(score, payload) => onRated(movie.id, score, payload)}
                    nullLabel="—"
                    ariaLabel="Mi calificación"
                    icon={<RatingUserSmileIcon className="h-4 w-4 shrink-0 text-violet-400" />}
                    className="w-full [&_button]:w-full [&_button]:justify-center [&_button]:cursor-pointer [&_button]:border-transparent [&_button]:bg-blue-950/25 [&_button]:px-1 [&_button]:text-xs [&_button]:text-blue-100 lg:[&_button]:justify-between lg:[&_button]:bg-blue-950/45 lg:[&_button]:text-sm lg:[&_button]:shadow-[0_2px_10px_rgba(59,130,246,0.2)] lg:[&_button:hover]:bg-blue-900/50 lg:[&_button:hover]:shadow-[0_6px_14px_rgba(59,130,246,0.26)]"
                  />
                ) : (
                  <p className="inline-flex items-center gap-1 text-base font-semibold text-blue-100"><RatingUserSmileIcon className="h-4 w-4 shrink-0 text-violet-400" /> {formatMyRating(movie?.myRating)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <TrailerModal open={trailerHover.open} trailerUrl={trailerHover.trailerUrl} watchUrl={trailerHover.watchUrl} loading={trailerHover.loading} unavailable={trailerHover.unavailable} onClose={trailerHover.close} currentLanguage={locale} posterUrl={posterSrc} />
      <TrailerModal open={trailerLongPress.open} trailerUrl={trailerLongPress.trailerUrl} watchUrl={trailerLongPress.watchUrl} loading={trailerLongPress.loading} error={trailerLongPress.error} unavailable={trailerLongPress.unavailable} externalOnly={trailerLongPress.externalOnly} onClose={trailerLongPress.close} currentLanguage={locale} posterUrl={posterSrc} />
    </article>
  );
}

export default memo(WeeklyHeroCard);
