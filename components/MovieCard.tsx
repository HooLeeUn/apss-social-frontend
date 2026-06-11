"use client";

import Link from "next/link";
import { memo, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../hooks/useI18n";
import { resolveMovieTitles } from "../lib/i18n";
import { addMovieToMyList, addMovieToMyRecommendations, Movie, removeMovieFromMyList, removeMovieFromMyRecommendations } from "../lib/movies";
import { formatAverageRating, formatFollowingRating, formatFollowingRatingsCount, formatMyRating } from "../lib/rating-format";
import CommentDetailButton from "./CommentDetailButton";
import RatingPopover from "./RatingPopover";

interface MovieCardProps {
  movie: Movie;
  variant?: "large" | "compact" | "feed";
  linkToDetail?: boolean;
  showExtendedMetadata?: boolean;
  highlightMyRatingSlot?: boolean;
  onRated?: (movieId: Movie["id"], score: number, payload?: unknown) => void | Promise<void>;
  showBottomInteractionIcons?: boolean;
  enlargeInteractionIcons?: boolean;
  pinInteractionIconsToMetadataRow?: boolean;
  compactRatingsRow?: boolean;
  isInMyListOverride?: boolean;
  onToggleMyList?: (movieId: Movie["id"], nextValue: boolean) => Promise<void> | void;
  isInMyRecommendationsOverride?: boolean;
  onToggleMyRecommendations?: (movieId: Movie["id"], nextValue: boolean) => Promise<void> | void;
  stretchPosterColumn?: boolean;
  extendedMetadataMiddleSlot?: ReactNode;
}

function formatContentType(contentType: string, labels: { movie: string; series: string; unknown: string }) {
  const normalized = contentType.trim().toLowerCase();
  if (normalized === "movie") return labels.movie;
  if (normalized === "series" || normalized === "tv series" || normalized === "tvseries") return labels.series;
  if (!contentType.trim()) return labels.unknown;
  return contentType;
}

function MovieCard({
  movie,
  variant = "compact",
  linkToDetail = true,
  showExtendedMetadata = false,
  highlightMyRatingSlot = false,
  onRated,
  showBottomInteractionIcons = true,
  enlargeInteractionIcons: _enlargeInteractionIcons = false,
  pinInteractionIconsToMetadataRow = false,
  compactRatingsRow = false,
  isInMyListOverride,
  onToggleMyList,
  isInMyRecommendationsOverride,
  onToggleMyRecommendations,
  stretchPosterColumn = false,
  extendedMetadataMiddleSlot,
}: MovieCardProps) {
  const { locale, t } = useI18n();
  const isLarge = variant === "large";
  const isFeed = variant === "feed";
  const detailHref = `/movies/${encodeURIComponent(String(movie.id))}`;
  const typeYearLine = [formatContentType(movie.contentType, { movie: t("movieDetailMovie"), series: t("movieDetailSeries"), unknown: t("movieDetailUnknown") }), movie.year && movie.year !== "-" ? movie.year : null]
    .filter(Boolean)
    .join(" · ");
  const genresLine = movie.genres.length > 0 ? movie.genres.join(" · ") : t("movieDetailNoGenre");
  const resolvedTitles = resolveMovieTitles(locale, movie.titleSpanish, movie.titleEnglish, movie.displayTitle || movie.title);
  const displayTitle = resolvedTitles.primary;
  const displaySecondaryTitle = resolvedTitles.secondary ?? movie.displaySecondaryTitle ?? null;
  const hasDirector = Boolean(movie.director?.trim());
  const castPreview = movie.castMembers.slice(0, 4);
  const hasCast = castPreview.length > 0;
  const canNavigateToDetail = linkToDetail;
  const titleLinkClassName = `inline-block max-w-full truncate transition-colors duration-150 ${
    isFeed ? "cursor-pointer hover:text-blue-100 focus-visible:text-blue-100" : "cursor-pointer hover:text-sky-700 focus-visible:text-sky-700"
  } focus-visible:outline-none`;
  const feedInteractionIconClassName = "interaction-icon interaction-icon--action";
  const compactInteractionIconClassName = "interaction-icon interaction-icon--action";
  void _enlargeInteractionIcons;
  const [localIsInMyList, setLocalIsInMyList] = useState<boolean | null>(null);
  const [localIsInMyRecommendations, setLocalIsInMyRecommendations] = useState<boolean | null>(null);
  const [posterFailedSrc, setPosterFailedSrc] = useState<string | null>(null);
  const isInMyList = localIsInMyList ?? Boolean(isInMyListOverride ?? movie.isInMyList);
  const isInMyRecommendations = localIsInMyRecommendations ?? Boolean(isInMyRecommendationsOverride ?? movie.isInMyRecommendations);
  const posterSrc = movie.image || movie.posterUrl;
  const hasPosterError = Boolean(posterSrc && posterFailedSrc === posterSrc);

  const handleToggleMyList = async () => {
    const nextValue = !isInMyList;
    if (!onToggleMyList) setLocalIsInMyList(nextValue);

    try {
      if (onToggleMyList) {
        await onToggleMyList(movie.id, nextValue);
      } else if (nextValue) {
        await addMovieToMyList(movie.id);
      } else {
        await removeMovieFromMyList(movie.id);
      }
    } catch (error) {
      console.warn("No se pudo actualizar Mi Lista.", error);
      if (!onToggleMyList) setLocalIsInMyList(!nextValue);
    }
  };
  const handleToggleMyRecommendations = async () => {
    const nextValue = !isInMyRecommendations;
    if (!onToggleMyRecommendations) setLocalIsInMyRecommendations(nextValue);
    try {
      if (onToggleMyRecommendations) await onToggleMyRecommendations(movie.id, nextValue);
      else if (nextValue) await addMovieToMyRecommendations(movie.id);
      else await removeMovieFromMyRecommendations(movie.id);
    } catch (error) {
      console.warn("No se pudo actualizar Mis recomendadas.", error);
      if (!onToggleMyRecommendations) setLocalIsInMyRecommendations(!nextValue);
    }
  };

  const tagIconClassName = `interaction-icon-tag ${isInMyList ? "interaction-icon-tag--active" : "interaction-icon-tag--inactive"}`;

  const cardContent = (
    <article
      className={`${isFeed && showExtendedMetadata && extendedMetadataMiddleSlot ? "overflow-visible" : "overflow-hidden"} rounded-xl border shadow-sm transition-colors ${
        isFeed ? "border border-white/35 bg-zinc-950/90 text-zinc-100" : "border border-gray-200 bg-white"
      } ${isLarge || isFeed ? "flex" : ""} ${isFeed ? "relative items-stretch" : ""}`}
    >
      <div
        className={`group relative flex-shrink-0 overflow-hidden ${
          isFeed
            ? `${stretchPosterColumn ? "h-auto self-stretch" : "h-[164px] sm:h-[172px]"} w-[108px] bg-zinc-900 sm:w-[114px]`
            : "bg-gray-200"
        } ${isLarge ? "h-72 md:h-auto md:w-48" : isFeed ? "" : "h-56"}`}
      >
        {posterSrc && !hasPosterError ? (
          canNavigateToDetail && isFeed ? (
            <Link href={detailHref} aria-label={`Ver detalle de ${displayTitle}`} className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterSrc}
                alt={`Poster de ${displayTitle}`}
                className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
                loading="lazy"
                decoding="async"
                onError={() => setPosterFailedSrc(posterSrc)}
              />
            </Link>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterSrc}
              alt={`Poster de ${displayTitle}`}
              className="h-full w-full object-cover"
              loading={isFeed ? "lazy" : "eager"}
              decoding="async"
              onError={() => setPosterFailedSrc(posterSrc)}
            />
          )
        ) : canNavigateToDetail && isFeed ? (
          <Link
            href={detailHref}
            aria-label={`Ver detalle de ${displayTitle}`}
            className={`flex h-full w-full cursor-pointer items-center justify-center px-3 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
              isFeed ? "text-zinc-400" : "text-gray-500"
            }`}
          >
            {t("noPoster")}
          </Link>
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center px-3 text-center text-sm ${
              isFeed ? "text-zinc-400" : "text-gray-500"
            }`}
          >
            {t("noPoster")}
          </div>
        )}

      </div>

      <div className={`flex min-w-0 flex-1 flex-col p-3 sm:p-3.5 ${isFeed ? "justify-between text-zinc-100" : "space-y-2"}`}>
        <div
          className={`${isFeed ? "min-w-0 space-y-1.5" : "space-y-2"} ${
            showExtendedMetadata
              ? extendedMetadataMiddleSlot
                ? "md:grid md:grid-cols-[minmax(0,0.72fr)_minmax(132px,auto)_minmax(0,1.2fr)] md:items-start md:gap-x-3 md:gap-y-2 lg:gap-x-7 md:space-y-0"
                : "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:gap-6 md:space-y-0"
              : ""
          }`}
        >
          <div className="min-w-0 space-y-1.5">
            <div className="min-w-0">
              <h3 className={`truncate font-semibold ${isLarge ? "text-lg" : "text-base"}`}>
                {canNavigateToDetail ? (
                  <Link href={detailHref} aria-label={`Ver detalle de ${displayTitle}`} className={titleLinkClassName}>
                    {displayTitle}
                  </Link>
                ) : (
                  displayTitle
                )}
              </h3>
              {displaySecondaryTitle ? (
                <p className={`truncate text-xs leading-tight ${isFeed ? "text-blue-200/80" : "text-sky-700"}`}>
                  {canNavigateToDetail ? (
                    <Link
                      href={detailHref}
                      aria-label={`Ver detalle de ${displayTitle} (${displaySecondaryTitle})`}
                      className="inline-block max-w-full cursor-pointer truncate transition-colors duration-150 hover:text-blue-100 focus-visible:text-blue-100 focus-visible:outline-none"
                    >
                      {displaySecondaryTitle}
                    </Link>
                  ) : (
                    displaySecondaryTitle
                  )}
                </p>
              ) : null}
            </div>
            <p className={`truncate text-sm ${isFeed ? "text-zinc-300" : "text-gray-500"}`}>{typeYearLine || t("movieDetailUnknown")}</p>
            <p className={`truncate text-sm ${isFeed ? "text-zinc-400" : "text-gray-600"}`}>{genresLine}</p>
          </div>
          {showExtendedMetadata && extendedMetadataMiddleSlot ? (
            <div className="relative z-30 min-w-0 overflow-visible md:pt-0.5">{extendedMetadataMiddleSlot}</div>
          ) : null}
          {showExtendedMetadata && (hasDirector || hasCast) ? (
            <div className="space-y-1.5 md:pt-0.5">
              {hasDirector ? (
                <p className={`text-sm leading-snug ${isFeed ? "text-zinc-300" : "text-gray-600"}`}>
                  <span className={`font-semibold ${isFeed ? "text-zinc-100" : "text-gray-900"}`}>{t("movieDetailDirector")}:</span> {movie.director}
                </p>
              ) : null}
              {hasCast ? (
                <p className={`line-clamp-2 text-sm leading-snug ${isFeed ? "text-zinc-400" : "text-gray-600"}`}>
                  <span className={`font-semibold ${isFeed ? "text-zinc-100" : "text-gray-900"}`}>{t("movieDetailCast")}:</span> {castPreview.join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}
          {isFeed && (highlightMyRatingSlot || pinInteractionIconsToMetadataRow) && !showExtendedMetadata ? (
            <div
              className="interaction-icons absolute right-2 top-[4.85rem] z-10"
            >
              <button type="button" onClick={handleToggleMyList} className="cursor-pointer" aria-label={isInMyList ? "Quitar de Mi Lista" : "Agregar a Mi Lista"}>
                <img src="/icons/tag.png" alt="" className={`${feedInteractionIconClassName} ${tagIconClassName}`} />
              </button>
              <button type="button" onClick={handleToggleMyRecommendations} className="cursor-pointer" aria-label={isInMyRecommendations ? "Quitar de Mis recomendadas" : "Agregar a Mis recomendadas"}>
                <img src="/icons/Ticket.png" alt="" className={`${feedInteractionIconClassName} ${isInMyRecommendations ? "interaction-icon-tag--active" : ""}`} />
              </button>
            </div>
          ) : null}
        </div>
        <div
          className={`mt-2 rounded-lg border ${
            isFeed
              ? `flex items-center border-white/10 bg-black/35 px-2.5 py-2 text-zinc-200 ${compactRatingsRow ? "gap-3 sm:gap-4" : "gap-2"}`
              : "grid grid-cols-3 gap-1.5 border-gray-200 bg-gray-50 px-2 py-2 text-center text-gray-700"
          }`}
        >
          <div className={isFeed ? `flex items-center text-sm font-semibold ${compactRatingsRow ? "gap-1.5" : "gap-1"}` : ""}>
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
          <div className={isFeed ? `flex items-center text-sm font-semibold ${compactRatingsRow ? "gap-1.5" : "gap-1"}` : ""}>
            {isFeed ? (
              <div
                className="flex leading-tight"
                title={formatFollowingRatingsCount(movie.followingRatingsCount) || undefined}
              >
                <span className="font-semibold" aria-label="Calificación de seguidos">👥 {formatFollowingRating(movie.followingAvgRating)}</span>
                {!compactRatingsRow && formatFollowingRatingsCount(movie.followingRatingsCount) ? (
                  <span className="text-[10px] font-normal text-zinc-500">{formatFollowingRatingsCount(movie.followingRatingsCount)}</span>
                ) : null}
              </div>
            ) : (
              <>
                <p className={`text-[10px] uppercase tracking-[0.12em] ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>{t("following")}</p>
                <p className="text-sm font-semibold">{formatFollowingRating(movie.followingAvgRating)}</p>
                {formatFollowingRatingsCount(movie.followingRatingsCount) ? (
                  <p className="text-[10px] font-normal text-zinc-500">{formatFollowingRatingsCount(movie.followingRatingsCount)}</p>
                ) : null}
              </>
            )}
          </div>
          <div
            className={
              isFeed
                ? `flex items-center ${compactRatingsRow ? "gap-1.5" : "gap-1"} rounded-md px-1.5 py-1 text-sm font-semibold transition-all duration-150 ${
                    highlightMyRatingSlot && !onRated
                      ? "border-blue-400/65 bg-blue-950/40 shadow-[0_4px_12px_rgba(59,130,246,0.24)] hover:-translate-y-px hover:border-blue-300/90 hover:shadow-[0_8px_16px_rgba(59,130,246,0.3)]"
                      : ""
                  }`
                : ""
            }
          >
            {isFeed ? (
              onRated ? (
                <RatingPopover
                  movieId={movie.id}
                  currentRating={movie.myRating}
                  onRated={(score, payload) => onRated(movie.id, score, payload)}
                  nullLabel="—"
                  ariaLabel="Mi calificación"
                  className={
                    highlightMyRatingSlot
                      ? "[&_button]:cursor-pointer [&_button]:border-blue-400/65 [&_button]:bg-blue-950/45 [&_button]:text-blue-100 [&_button]:shadow-[0_2px_10px_rgba(59,130,246,0.22)] [&_button:hover]:border-blue-300/90 [&_button:hover]:bg-blue-900/45 [&_button:hover]:shadow-[0_6px_14px_rgba(59,130,246,0.28)]"
                      : ""
                  }
                />
              ) : (
                <>
                  <span aria-hidden="true" className={highlightMyRatingSlot ? "text-blue-100" : ""}>🙋</span>
                  <span aria-label="Mi calificación" className={highlightMyRatingSlot ? "text-blue-100" : ""}>
                    {formatMyRating(movie.myRating)}
                  </span>
                </>
              )
            ) : (
              <>
                <p className={`text-[11px] uppercase tracking-wide whitespace-nowrap ${isFeed ? "text-zinc-500" : "text-gray-500"}`}>{t("myRating")}</p>
                <p className="text-sm font-semibold">{formatMyRating(movie.myRating)}</p>
              </>
            )}
          </div>
          {isFeed ? (
            <div className={`relative ml-auto ${highlightMyRatingSlot ? "min-w-[9rem]" : ""}`}>
              {showBottomInteractionIcons ? (
                <div
                  className={`interaction-icons absolute z-10 ${
                    highlightMyRatingSlot
                      ? showExtendedMetadata
                        ? "left-[58%] top-1/2 -translate-x-1/2 -translate-y-1/2"
                        : "hidden"
                        : "right-10 -top-7"
                  }`}
                >
                  <button type="button" onClick={handleToggleMyList} className="cursor-pointer" aria-label={isInMyList ? "Quitar de Mi Lista" : "Agregar a Mi Lista"}>
                <img src="/icons/tag.png" alt="" className={`${feedInteractionIconClassName} ${tagIconClassName}`} />
              </button>
                  <button type="button" onClick={handleToggleMyRecommendations} className="cursor-pointer" aria-label={isInMyRecommendations ? "Quitar de Mis recomendadas" : "Agregar a Mis recomendadas"}>
                    <img src="/icons/Ticket.png" alt="" className={`${feedInteractionIconClassName} ${isInMyRecommendations ? "interaction-icon-tag--active" : ""}`} />
                  </button>
                </div>
              ) : null}
              <CommentDetailButton title={displayTitle} synopsisEs={movie.synopsis_es} synopsis={movie.synopsis} className="h-8 w-8 shrink-0" />
            </div>
          ) : (
            <div className="col-span-3 mt-1 flex justify-center" aria-hidden="true">
              <div className="interaction-icons">
                <button type="button" onClick={handleToggleMyList} className="cursor-pointer" aria-label={isInMyList ? "Quitar de Mi Lista" : "Agregar a Mi Lista"}>
                <img src="/icons/tag.png" alt="" className={`${compactInteractionIconClassName} ${tagIconClassName}`} />
              </button>
                <button type="button" onClick={handleToggleMyRecommendations} className="cursor-pointer" aria-label={isInMyRecommendations ? "Quitar de Mis recomendadas" : "Agregar a Mis recomendadas"}>
                  <img src="/icons/Ticket.png" alt="" className={`${compactInteractionIconClassName} ${isInMyRecommendations ? "interaction-icon-tag--active" : ""}`} />
                </button>
              </div>
            </div>
          )}
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
