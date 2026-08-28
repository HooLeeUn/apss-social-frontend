"use client";

import Link from "next/link";
import { memo, useId, useRef, useState } from "react";
import { useI18n } from "../hooks/useI18n";
import { resolveMovieTitles } from "../lib/i18n";
import { addMovieToMyList, addMovieToMyRecommendations, Movie, removeMovieFromMyList, removeMovieFromMyRecommendations } from "../lib/movies";
import { formatAverageRating, formatFollowingRating, formatMyRating } from "../lib/rating-format";
import { useTrailerHover } from "../hooks/useTrailerHover";
import { useTrailerLongPress } from "../hooks/useTrailerLongPress";
import CommentDetailButton from "./CommentDetailButton";
import DesktopOverflowTicker from "./DesktopOverflowTicker";
import MyListIcon from "./MyListIcon";
import RatingPopover from "./RatingPopover";
import TrailerHoverOverlay from "./TrailerHoverOverlay";
import TrailerModal from "./TrailerModal";
import PosterImage from "./PosterImage";
import type { AppBranding } from "../lib/branding";
import { RatingUserSmileIcon } from "./RatingIcons";
import GuestContentGate from "./GuestContentGate";
import { useGuestGate } from "./GuestGateProvider";

interface WeeklyMiniCardProps {
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
  desktopGuest?: boolean;
}

function getAvatarFallback(username?: string | null): string {
  const trimmed = username?.trim();
  if (!trimmed) return "★";

  const [first, second] = trimmed.split(/\s+/);
  const initials = `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase();
  return initials || "★";
}

function WeeklyMiniCard({ movie, fallbackLabel, currentUserId, onRated, isInMyList = false, onToggleMyList, isInMyRecommendations = false, onToggleMyRecommendations, trailerHoverDelayMs, branding = null, desktopGuest = false }: WeeklyMiniCardProps) {
  const { locale, country } = useI18n();
  const { showGuestGate } = useGuestGate();
  const gateInstanceId = useId();
  const gateBaseId = `weekly-mini:${movie?.id ?? fallbackLabel}:${gateInstanceId}`;
  const ratingGateAnchorRef = useRef<HTMLSpanElement | null>(null);
  const resolvedTitles = resolveMovieTitles(locale, movie?.titleSpanish, movie?.titleEnglish, movie?.displayTitle ?? movie?.title ?? fallbackLabel);
  const title = resolvedTitles.primary;
  const secondaryTitle = resolvedTitles.secondary ?? movie?.displaySecondaryTitle ?? null;
  const genres = movie?.genres?.filter(Boolean) ?? [];
  const genre = genres.length ? genres.slice(0, 3).join(" • ") : "Sin género";
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
  const followingRatingsCount = movie?.followingRatingsCount ?? 0;
  const followingRatingsTitle = followingRatingsCount > 0
    ? `${followingRatingsCount} ${followingRatingsCount === 1 ? "calificación" : "calificaciones"} de usuarios seguidos`
    : "Sin calificaciones de usuarios seguidos";
  const handleToggleMyList = async () => {
    if (!movie) return;
    if (desktopGuest) { showGuestGate(`${gateBaseId}:list`, "list"); return; }
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
    if (desktopGuest) { showGuestGate(`${gateBaseId}:recommend`, "recommend"); return; }
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
  const tagIconClassName = `interaction-icon interaction-icon--compact interaction-icon--mini interaction-icon--mini-lg interaction-icon-tag ${isInMyList ? "interaction-icon-tag--active" : "interaction-icon-tag--inactive"}`;

  return (
    <article className="weekly-mini-card relative h-full min-w-0 pl-3 xl:pl-3">
      <div className="interaction-icons absolute left-11 bottom-[2.85rem] z-20 xl:z-10 xl:left-10 xl:bottom-auto xl:top-[59%]">
        <span className="relative inline-flex"><button type="button" onMouseEnter={() => { if (desktopGuest) showGuestGate(`${gateBaseId}:list`, "list"); }} onClick={handleToggleMyList} className={desktopGuest ? "cursor-default" : "cursor-pointer"} aria-label={isInMyList ? "Quitar de Mi Lista" : "Agregar a Mi Lista"}><MyListIcon cardSize className={tagIconClassName} /></button><GuestContentGate gateId={`${gateBaseId}:list`} placement="below-end" /></span>
        <span className="relative inline-flex"><button type="button" onMouseEnter={() => { if (desktopGuest) showGuestGate(`${gateBaseId}:recommend`, "recommend"); }} onClick={handleToggleMyRecommendations} className={desktopGuest ? "cursor-default" : "cursor-pointer"} aria-label={isInMyRecommendations ? "Quitar de Mis recomendadas" : "Agregar a Mis recomendadas"}><img src="/icons/Ticket.png" alt="" className={`interaction-icon interaction-icon--compact interaction-icon--mini interaction-icon--mini-lg ${isInMyRecommendations ? "interaction-icon-tag--active" : ""}`} /></button><GuestContentGate gateId={`${gateBaseId}:recommend`} placement="below-end" /></span>
      </div>
      {topUserHref ? (
        <Link
          href={topUserHref}
          aria-label={`Ir al perfil de ${topUsername}`}
          title={topUsername}
          className="absolute left-0 top-[56%] z-10 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/30 bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-semibold text-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.45)] xl:top-1/2"
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
          className="absolute left-0 top-[56%] z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-semibold text-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.45)] xl:top-1/2"
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

      <div className="absolute right-[calc(32%+0.45rem)] bottom-[4.25rem] z-20 xl:z-10 xl:right-[calc(34%+0.35rem)] xl:bottom-auto xl:top-[calc(59%+19px)] xl:-translate-y-1/2">
        <CommentDetailButton title={title} synopsisEs={movie?.synopsis_es} synopsis={movie?.synopsis} className="h-[30px] w-[30px]" />
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

                <div className="mt-1.5 min-h-[2.7rem] xl:w-[calc(100%-2.25rem)]">
                  <DesktopOverflowTicker className="text-[11px] leading-snug text-zinc-400">
                    <span>{genre}</span>
                    <span className="mx-1.5 text-zinc-600">•</span>
                    <span>{type}</span>
                    <span className="mx-1.5 text-zinc-600">•</span>
                    <span className="inline-block min-w-[4ch] tabular-nums">{hasYear ? year : "\u00A0"}</span>
                  </DesktopOverflowTicker>
                </div>
              </div>

              <div className="pt-2">
                <div className="grid grid-cols-3 gap-1.5 text-[9px] text-zinc-200 xl:gap-1">
                  <span className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent bg-zinc-950/60 px-1.5 py-1 text-center xl:border-white/10 xl:bg-zinc-950/80 xl:px-1">
                    <span className="text-[10px] font-semibold text-zinc-100">⭐ {formatAverageRating(movie?.displayRating)}</span>
                  </span>
                  <span
                    className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent bg-zinc-950/60 px-1.5 py-1 text-center xl:border-white/10 xl:bg-zinc-950/80 xl:px-1"
                    title={followingRatingsTitle}
                  >
                    <span className="truncate text-[10px] font-semibold text-zinc-100">👥 {formatFollowingRating(movie?.followingAvgRating)}</span>
                  </span>
                  {desktopGuest && movie ? (
                    <span ref={ratingGateAnchorRef} className="relative inline-flex w-full"><button type="button" className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-blue-950/45 px-1 py-1 text-[10px] font-semibold text-blue-100" onMouseEnter={() => showGuestGate(`${gateBaseId}:rate`, "rate")} onClick={() => showGuestGate(`${gateBaseId}:rate`, "rate")}><RatingUserSmileIcon className="h-4 w-4 shrink-0 text-violet-400" />—</button><GuestContentGate gateId={`${gateBaseId}:rate`} portal anchorRef={ratingGateAnchorRef} /></span>
                  ) : movie && onRated ? (
                    <RatingPopover
                      movieId={movie.id}
                      currentRating={movie.myRating}
                      onRated={(score, payload) => onRated(movie.id, score, payload)}
                      nullLabel="—"
                      ariaLabel="Mi calificación"
                      icon={<RatingUserSmileIcon className="h-4 w-4 shrink-0 text-violet-400" />}
                      className="w-full [&_button]:w-full [&_button]:justify-center [&_button]:gap-1 [&_button]:whitespace-nowrap [&_button]:cursor-pointer [&_button]:border-transparent [&_button]:bg-blue-950/35 [&_button]:px-1.5 [&_button]:py-1 [&_button]:text-[10px] [&_button]:font-semibold [&_button]:text-blue-100 xl:[&_button]:bg-blue-950/45 xl:[&_button]:px-1 xl:[&_button]:shadow-[0_3px_10px_rgba(59,130,246,0.24)] xl:[&_button:hover]:-translate-y-px xl:[&_button:hover]:shadow-[0_7px_15px_rgba(59,130,246,0.3)]"
                    />
                  ) : (
                    <span className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent bg-blue-950/35 px-1.5 py-1 text-center transition-all duration-150 hover:-translate-y-px xl:bg-blue-950/45 xl:px-1 xl:shadow-[0_3px_10px_rgba(59,130,246,0.24)] xl:hover:shadow-[0_7px_15px_rgba(59,130,246,0.3)]">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-100"><RatingUserSmileIcon className="h-4 w-4 shrink-0 text-violet-400" /> {formatMyRating(movie?.myRating)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="w-[32%] min-w-[82px] max-w-[110px] border-l border-white/10 bg-zinc-950 xl:w-[34%] xl:min-w-[72px] xl:max-w-[92px]">
            <div className="relative h-full w-full overflow-hidden" onMouseEnter={trailerHover.onMouseEnter} onMouseLeave={trailerHover.onMouseLeave} {...trailerLongPress.posterProps}>
              {movie ? (
                detailHref ? (
                  <Link href={detailHref} aria-label={`Ver detalle de ${title}`} className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
                    <PosterImage
                      posterSrc={posterSrc}
                      title={title}
                      branding={branding}
                      className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
                      placeholderClassName="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-950 object-contain p-3"
                      loading="lazy"
                      decoding="async"
                    />
                  </Link>
                ) : (
                  <PosterImage posterSrc={posterSrc} title={title} branding={branding} className="h-full w-full object-cover" placeholderClassName="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-950 object-contain p-3" loading="lazy" decoding="async" />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 px-2 text-center text-[10px] text-zinc-400">
                  {fallbackLabel}
                </div>
              )}
              <TrailerHoverOverlay loading={trailerHover.loading || trailerLongPress.loading} unavailable={trailerHover.unavailable || trailerLongPress.unavailable} locale={locale} />
            </div>
          </div>
        </div>
      </div>
      <TrailerModal open={trailerHover.open} trailerUrl={trailerHover.trailerUrl} watchUrl={trailerHover.watchUrl} loading={trailerHover.loading} unavailable={trailerHover.unavailable} onClose={trailerHover.close} currentLanguage={locale} posterUrl={posterSrc} />
      <TrailerModal open={trailerLongPress.open} trailerUrl={trailerLongPress.trailerUrl} watchUrl={trailerLongPress.watchUrl} loading={trailerLongPress.loading} error={trailerLongPress.error} unavailable={trailerLongPress.unavailable} externalOnly={trailerLongPress.externalOnly} onClose={trailerLongPress.close} currentLanguage={locale} posterUrl={posterSrc} />
    </article>
  );
}

export default memo(WeeklyMiniCard);
