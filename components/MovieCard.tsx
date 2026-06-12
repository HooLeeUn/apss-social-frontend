"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent, MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../hooks/useI18n";
import { resolveMovieTitles } from "../lib/i18n";
import { addMovieToMyList, addMovieToMyRecommendations, Movie, removeMovieFromMyList, removeMovieFromMyRecommendations } from "../lib/movies";
import { fetchPersonDetail, MoviePersonCredit, PersonDetail } from "../lib/people";
import { formatAverageRating, formatFollowingRating, formatFollowingRatingsCount, formatMyRating } from "../lib/rating-format";
import CommentDetailButton from "./CommentDetailButton";
import RatingPopover from "./RatingPopover";

const TOOLTIP_OFFSET_PX = 10;
const TOOLTIP_VIEWPORT_PADDING_PX = 16;
const TOOLTIP_MAX_WIDTH_PX = 280;

interface TooltipPosition {
  left: number;
  top: number;
  transform: string;
}

function getTooltipPosition(target: HTMLElement): TooltipPosition {
  const rect = target.getBoundingClientRect();
  const centeredLeft = rect.left + rect.width / 2;
  const minLeft = TOOLTIP_VIEWPORT_PADDING_PX + TOOLTIP_MAX_WIDTH_PX / 2;
  const maxLeft = window.innerWidth - TOOLTIP_VIEWPORT_PADDING_PX - TOOLTIP_MAX_WIDTH_PX / 2;
  const left = Math.min(Math.max(centeredLeft, minLeft), Math.max(minLeft, maxLeft));
  const shouldShowBelow = rect.top < 96;

  return {
    left,
    top: shouldShowBelow ? rect.bottom + TOOLTIP_OFFSET_PX : rect.top - TOOLTIP_OFFSET_PX,
    transform: shouldShowBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
  };
}

function QNextTooltip({ text, position }: { text: string; position: TooltipPosition }) {
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[9999] whitespace-pre-line rounded-lg border border-[#86ADE0]/30 bg-zinc-950/95 px-3 py-2 text-center text-[11px] font-medium leading-snug text-zinc-100 shadow-[0_14px_32px_rgba(0,0,0,0.45)] ring-1 ring-black/40 backdrop-blur-sm"
      style={{
        left: position.left,
        top: position.top,
        maxWidth: TOOLTIP_MAX_WIDTH_PX,
        transform: position.transform,
      }}
    >
      {text}
    </div>,
    document.body,
  );
}

function TooltipTarget({ text, children }: { text: string; children: ReactNode }) {
  const targetRef = useRef<HTMLSpanElement | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const showTooltip = () => {
    if (!targetRef.current) return;
    setPosition(getTooltipPosition(targetRef.current));
  };

  const hideTooltip = () => setPosition(null);

  return (
    <span
      ref={targetRef}
      className="inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {position ? <QNextTooltip text={text} position={position} /> : null}
    </span>
  );
}


const PERSON_CARD_OFFSET_PX = 12;
const PERSON_CARD_WIDTH_PX = 320;
const PERSON_HOVER_DELAY_MS = 500;
const PERSON_POPOVER_HIDE_EVENT = "qnext-hide-person-popovers";
const CAST_OVERFLOW_POPOVER_WIDTH_PX = 310;

type PersonDetailCacheEntry = { loading: boolean; detail: PersonDetail | null; error: boolean };
type PersonDetailCache = Record<string, PersonDetailCacheEntry>;

const personDetailMemoryCache: PersonDetailCache = {};
const personDetailRequests = new Map<string, Promise<PersonDetail | null>>();
const personDetailSubscribers = new Set<() => void>();

function notifyPersonDetailSubscribers() {
  personDetailSubscribers.forEach((subscriber) => subscriber());
}

function getPersonCacheKey(person: MoviePersonCredit): string {
  return person.id !== null && person.id !== undefined ? `id:${person.id}` : `name:${person.name.toLowerCase()}`;
}

function getFloatingPosition(target: HTMLElement, width: number): TooltipPosition {
  const rect = target.getBoundingClientRect();
  const centeredLeft = rect.left + rect.width / 2;
  const minLeft = TOOLTIP_VIEWPORT_PADDING_PX + width / 2;
  const maxLeft = window.innerWidth - TOOLTIP_VIEWPORT_PADDING_PX - width / 2;
  const left = Math.min(Math.max(centeredLeft, minLeft), Math.max(minLeft, maxLeft));
  const estimatedHeight = 250;
  const shouldShowBelow = rect.top < estimatedHeight + TOOLTIP_VIEWPORT_PADDING_PX;

  return {
    left,
    top: shouldShowBelow ? rect.bottom + PERSON_CARD_OFFSET_PX : rect.top - PERSON_CARD_OFFSET_PX,
    transform: shouldShowBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
  };
}

function getCursorFloatingPosition(event: Pick<MouseEvent, "clientX" | "clientY">, width: number): TooltipPosition {
  const left = Math.min(Math.max(event.clientX + PERSON_CARD_OFFSET_PX, TOOLTIP_VIEWPORT_PADDING_PX), window.innerWidth - width - TOOLTIP_VIEWPORT_PADDING_PX);
  const estimatedHeight = 270;
  const belowTop = event.clientY + PERSON_CARD_OFFSET_PX;
  const shouldShowAbove = belowTop + estimatedHeight > window.innerHeight - TOOLTIP_VIEWPORT_PADDING_PX;

  return {
    left,
    top: shouldShowAbove ? Math.max(TOOLTIP_VIEWPORT_PADDING_PX, event.clientY - PERSON_CARD_OFFSET_PX) : belowTop,
    transform: shouldShowAbove ? "translate(0, -100%)" : "translate(0, 0)",
  };
}

function PersonAvatar({ detail, person }: { detail: PersonDetail | null; person: MoviePersonCredit }) {
  const imageUrl = detail?.profileUrl ?? person.profileUrl ?? null;
  const displayName = detail?.name ?? person.name;

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-900 text-xl font-bold text-[#86ADE0] shadow-inner">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={displayName} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        displayName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join("") || "—"
      )}
    </div>
  );
}

function PersonInfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[6.7rem_minmax(0,1fr)] gap-2 text-[11px] leading-snug">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 text-zinc-200">{value}</span>
    </div>
  );
}

function PersonSocialLink({ href, label }: { href: string | null | undefined; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-[#86ADE0]/25 bg-[#86ADE0]/10 px-2 py-0.5 text-[10px] font-semibold text-blue-100 transition hover:border-[#86ADE0]/60 hover:bg-[#86ADE0]/20"
    >
      {label}
    </a>
  );
}

function PersonFloatingCard({ person, cacheEntry, position, locale, onMouseEnter, onMouseLeave }: { person: MoviePersonCredit; cacheEntry: PersonDetailCacheEntry | undefined; position: TooltipPosition; locale: string; onMouseEnter: () => void; onMouseLeave: () => void }) {
  const isEnglish = locale === "en";
  const detail = cacheEntry?.detail ?? null;
  const hasSocials = Boolean(detail?.facebookUrl || detail?.xUrl || detail?.instagramUrl);

  return createPortal(
    <div
      role="tooltip"
      className="fixed z-[10050] w-[min(320px,calc(100vw-32px))] rounded-2xl border border-[#86ADE0]/30 bg-zinc-950/98 p-3 text-left text-zinc-100 shadow-[0_22px_48px_rgba(0,0,0,0.6)] ring-1 ring-black/50 backdrop-blur-md"
      style={{ left: position.left, top: position.top, transform: position.transform }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex gap-3">
        <PersonAvatar detail={detail} person={person} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-50">{detail?.name ?? person.name}</p>
          {cacheEntry?.loading ? <p className="mt-1 text-[11px] text-zinc-500">{isEnglish ? "Loading details…" : "Cargando ficha…"}</p> : null}
          {hasSocials ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <PersonSocialLink href={detail?.facebookUrl} label="Facebook" />
              <PersonSocialLink href={detail?.xUrl} label="X" />
              <PersonSocialLink href={detail?.instagramUrl} label="Instagram" />
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
        <PersonInfoRow label={isEnglish ? "Known For" : "Conocido(a) por"} value={detail?.knownFor} />
        <PersonInfoRow label={isEnglish ? "Gender" : "Género"} value={detail?.gender} />
        <PersonInfoRow label={isEnglish ? "Birthday" : "Nacimiento"} value={detail?.birthday} />
        <PersonInfoRow label={isEnglish ? "Day of Death" : "Fallecimiento"} value={detail?.deathday} />
        <PersonInfoRow label={isEnglish ? "Place of Birth" : "Lugar de nacimiento"} value={detail?.placeOfBirth} />
        {!cacheEntry?.loading && !detail?.knownFor && !detail?.gender && !detail?.birthday && !detail?.deathday && !detail?.placeOfBirth ? (
          <p className="text-[11px] text-zinc-500">—</p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function PersonName({ person, cache, onEnsureDetail, className = "" }: { person: MoviePersonCredit; cache: PersonDetailCache; onEnsureDetail: (person: MoviePersonCredit) => void; className?: string }) {
  const { locale } = useI18n();
  const targetRef = useRef<HTMLSpanElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const cacheKey = getPersonCacheKey(person);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const hideCard = useCallback(() => {
    clearHoverTimer();
    cancelHide();
    setPosition(null);
  }, [cancelHide, clearHoverTimer]);

  useEffect(() => {
    const handleHideAll = () => hideCard();
    window.addEventListener(PERSON_POPOVER_HIDE_EVENT, handleHideAll);
    return () => {
      window.removeEventListener(PERSON_POPOVER_HIDE_EVENT, handleHideAll);
      clearHoverTimer();
      cancelHide();
    };
  }, [cancelHide, clearHoverTimer, hideCard]);

  const scheduleShow = (event: MouseEvent<HTMLSpanElement> | FocusEvent<HTMLSpanElement>) => {
    clearHoverTimer();
    cancelHide();
    const clientX = "clientX" in event ? event.clientX : targetRef.current?.getBoundingClientRect().left ?? 0;
    const clientY = "clientY" in event ? event.clientY : targetRef.current?.getBoundingClientRect().bottom ?? 0;
    hoverTimerRef.current = window.setTimeout(() => {
      window.dispatchEvent(new Event(PERSON_POPOVER_HIDE_EVENT));
      onEnsureDetail(person);
      setPosition(getCursorFloatingPosition({ clientX, clientY }, PERSON_CARD_WIDTH_PX));
    }, PERSON_HOVER_DELAY_MS);
  };

  const scheduleHide = () => {
    clearHoverTimer();
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => setPosition(null), 140);
  };

  return (
    <span ref={targetRef} className={`inline-flex min-w-0 ${className}`} onMouseEnter={scheduleShow} onMouseLeave={scheduleHide} onFocus={scheduleShow} onBlur={scheduleHide} tabIndex={0}>
      <span className="cursor-default truncate decoration-[#86ADE0]/50 underline-offset-4 transition hover:text-blue-100 hover:underline focus-visible:text-blue-100">{person.name}</span>
      {position ? <PersonFloatingCard person={person} cacheEntry={cache[cacheKey]} position={position} locale={locale} onMouseEnter={cancelHide} onMouseLeave={hideCard} /> : null}
    </span>
  );
}

function CastOverflowPopover({ people, cache, onEnsureDetail, position, onMouseEnter, onMouseLeave }: { people: MoviePersonCredit[]; cache: PersonDetailCache; onEnsureDetail: (person: MoviePersonCredit) => void; position: TooltipPosition; onMouseEnter: () => void; onMouseLeave: () => void }) {
  return createPortal(
    <div
      role="tooltip"
      className="fixed z-[10040] w-[min(310px,calc(100vw-32px))] rounded-2xl border border-[#86ADE0]/30 bg-zinc-950/98 p-2.5 text-sm text-zinc-100 shadow-[0_22px_48px_rgba(0,0,0,0.58)] ring-1 ring-black/50 backdrop-blur-md"
      style={{ left: position.left, top: position.top, transform: position.transform }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="scrollbar-dark max-h-56 space-y-1 overflow-y-auto pr-1">
        {people.map((person, index) => (
          <div key={`${getPersonCacheKey(person)}-${index}`} className="rounded-lg px-2 py-1.5 transition hover:bg-white/10">
            <PersonName person={person} cache={cache} onEnsureDetail={onEnsureDetail} className="max-w-full" />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}

function CastLine({ label, people, cache, onEnsureDetail, isFeed }: { label: string; people: MoviePersonCredit[]; cache: PersonDetailCache; onEnsureDetail: (person: MoviePersonCredit) => void; isFeed: boolean }) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(Math.min(people.length, 12));
  const [overflowPosition, setOverflowPosition] = useState<TooltipPosition | null>(null);

  useEffect(() => () => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    const updateVisibleCount = () => {
      if (!rowRef.current || !measureRef.current) return;
      const availableWidth = rowRef.current.getBoundingClientRect().width;
      const items = Array.from(measureRef.current.querySelectorAll<HTMLElement>("[data-cast-measure]"));
      const more = measureRef.current.querySelector<HTMLElement>("[data-cast-more-measure]");
      if (!items.length || !more) return;
      const labelWidth = measureRef.current.querySelector<HTMLElement>("[data-cast-label-measure]")?.getBoundingClientRect().width ?? 0;
      const moreWidth = more.getBoundingClientRect().width;
      const maxWidthAcrossRows = availableWidth * 4;
      let used = labelWidth;
      let count = 0;
      for (const item of items) {
        const width = item.getBoundingClientRect().width;
        const needsMore = count < people.length - 1;
        if (used + width + (needsMore ? moreWidth : 0) <= maxWidthAcrossRows) {
          used += width;
          count += 1;
        } else {
          break;
        }
      }
      setVisibleCount(Math.max(1, Math.min(count, people.length)));
    };

    updateVisibleCount();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateVisibleCount) : null;
    if (rowRef.current && resizeObserver) resizeObserver.observe(rowRef.current);
    window.addEventListener("resize", updateVisibleCount);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateVisibleCount);
    };
  }, [label, people]);

  const visiblePeople = people.slice(0, visibleCount);
  const hiddenPeople = people.slice(visibleCount);
  const hasOverflow = hiddenPeople.length > 0;

  const cancelHide = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };
  const showOverflow = () => {
    cancelHide();
    if (!moreRef.current) return;
    setOverflowPosition(getFloatingPosition(moreRef.current, CAST_OVERFLOW_POPOVER_WIDTH_PX));
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => setOverflowPosition(null), 120);
  };

  return (
    <div ref={rowRef} className={`relative max-h-[5.5rem] min-w-0 overflow-hidden text-sm leading-snug ${isFeed ? "text-zinc-400" : "text-gray-600"}`}>
      <span className={`font-semibold ${isFeed ? "text-zinc-100" : "text-gray-900"}`}>{label}:</span>{" "}
      {visiblePeople.map((person, index) => (
        <span key={`${getPersonCacheKey(person)}-${index}`} className="inline-flex min-w-0 align-baseline">
          {index > 0 ? <span className="mx-1.5 text-zinc-600">·</span> : null}
          <PersonName person={person} cache={cache} onEnsureDetail={onEnsureDetail} />
        </span>
      ))}
      {hasOverflow ? (
        <>
          <span className="mx-1.5 text-zinc-600">·</span>
          <button
            ref={moreRef}
            type="button"
            className="inline-flex rounded-full border border-[#86ADE0]/25 bg-[#86ADE0]/10 px-2 py-0.5 text-xs font-bold text-blue-100 shadow-sm transition hover:border-[#86ADE0]/55 hover:bg-[#86ADE0]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/60"
            onMouseEnter={showOverflow}
            onMouseLeave={scheduleHide}
            onFocus={showOverflow}
            onBlur={scheduleHide}
          >
            +{hiddenPeople.length}
          </button>
          {overflowPosition ? (
            <CastOverflowPopover people={hiddenPeople} cache={cache} onEnsureDetail={onEnsureDetail} position={overflowPosition} onMouseEnter={cancelHide} onMouseLeave={scheduleHide} />
          ) : null}
        </>
      ) : null}
      <div ref={measureRef} className="pointer-events-none fixed left-[-9999px] top-[-9999px] whitespace-nowrap text-sm leading-snug opacity-0" aria-hidden="true">
        <span data-cast-label-measure className="font-semibold">{label}: </span>
        {people.map((person, index) => (
          <span key={`${person.name}-${index}`} data-cast-measure>
            {index > 0 ? " · " : ""}{person.name}
          </span>
        ))}
        <span data-cast-more-measure> · +99</span>
      </div>
    </div>
  );
}

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
  ratingsActionsTmdbSlot?: ReactNode;
  separateRatingsActionsCard?: boolean;
  creditsLoading?: boolean;
}

function formatContentType(contentType: string, labels: { movie: string; series: string; unknown: string }) {
  const normalized = contentType.trim().toLowerCase();
  if (normalized === "movie") return labels.movie;
  if (normalized === "series" || normalized === "tv series" || normalized === "tvseries") return labels.series;
  if (!contentType.trim()) return labels.unknown;
  return contentType;
}

function appendTmdbLocale(url: string, countryCode: string): string {
  const trimmedUrl = url.trim();
  const normalizedCountryCode = countryCode.trim().toUpperCase();

  if (!trimmedUrl || !normalizedCountryCode) return trimmedUrl;
  if (/[?&]locale=/i.test(trimmedUrl)) return trimmedUrl;

  const hashIndex = trimmedUrl.indexOf("#");
  const baseUrl = hashIndex >= 0 ? trimmedUrl.slice(0, hashIndex) : trimmedUrl;
  const hash = hashIndex >= 0 ? trimmedUrl.slice(hashIndex) : "";
  const separator = baseUrl.includes("?") ? "&" : "?";

  return `${baseUrl}${separator}locale=${encodeURIComponent(normalizedCountryCode)}${hash}`;
}

function resolveTmdbUrl(movie: Movie, countryCode: string): string | null {
  const directUrl = movie.tmdbWatchUrl || movie.link;

  if (directUrl) return appendTmdbLocale(directUrl, countryCode);

  if (movie.tmdbId === null || movie.tmdbId === undefined) return null;

  const normalizedTmdbId = String(movie.tmdbId).trim();
  if (!normalizedTmdbId) return null;

  const normalizedContentType = movie.contentType.trim().toLowerCase();
  const tmdbPath = normalizedContentType === "series" || normalizedContentType === "tv series" || normalizedContentType === "tvseries" ? "tv" : "movie";

  return appendTmdbLocale(`https://www.themoviedb.org/${tmdbPath}/${encodeURIComponent(normalizedTmdbId)}/watch`, countryCode);
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
  ratingsActionsTmdbSlot,
  separateRatingsActionsCard = false,
  creditsLoading = false,
}: MovieCardProps) {
  const { locale, country, t } = useI18n();
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
  const directorPeople = useMemo<MoviePersonCredit[]>(() => {
    if (movie.directors.length) return movie.directors;
    return movie.director?.trim() ? [{ id: null, name: movie.director.trim() }] : [];
  }, [movie.director, movie.directors]);
  const castPeople = useMemo<MoviePersonCredit[]>(() => {
    if (movie.cast.length) return movie.cast;
    return movie.castMembers.map((name) => ({ id: null, name })).filter((person) => person.name.trim());
  }, [movie.cast, movie.castMembers]);
  const hasDirector = directorPeople.length > 0;
  const hasCast = castPeople.length > 0;
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
  const [personDetailCache, setPersonDetailCache] = useState<PersonDetailCache>({ ...personDetailMemoryCache });
  const isInMyList = localIsInMyList ?? Boolean(isInMyListOverride ?? movie.isInMyList);
  const isInMyRecommendations = localIsInMyRecommendations ?? Boolean(isInMyRecommendationsOverride ?? movie.isInMyRecommendations);
  const posterSrc = movie.image || movie.posterUrl;
  const hasPosterError = Boolean(posterSrc && posterFailedSrc === posterSrc);

  useEffect(() => {
    const syncCache = () => setPersonDetailCache({ ...personDetailMemoryCache });
    personDetailSubscribers.add(syncCache);
    return () => {
      personDetailSubscribers.delete(syncCache);
    };
  }, []);

  const ensurePersonDetail = useCallback((person: MoviePersonCredit) => {
    const cacheKey = getPersonCacheKey(person);
    if (personDetailMemoryCache[cacheKey]?.detail || personDetailMemoryCache[cacheKey]?.loading) return;

    personDetailMemoryCache[cacheKey] = { loading: true, detail: null, error: false };
    notifyPersonDetailSubscribers();
    const request = personDetailRequests.get(cacheKey) ?? fetchPersonDetail(person);
    personDetailRequests.set(cacheKey, request);
    request
      .then((detail) => {
        personDetailMemoryCache[cacheKey] = { loading: false, detail, error: false };
      })
      .catch((error) => {
        console.warn("No se pudo cargar la ficha de persona.", error);
        personDetailMemoryCache[cacheKey] = { loading: false, detail: null, error: true };
      })
      .finally(() => {
        personDetailRequests.delete(cacheKey);
        notifyPersonDetailSubscribers();
      });
  }, []);

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
  const splitFeedActions = isFeed && separateRatingsActionsCard;
  const tmdbUrl = splitFeedActions ? resolveTmdbUrl(movie, country) : null;
  const tmdbTooltip = locale === "en" ? "View on TMDb" : "Ver en TMDb";
  const feedRatingsCardClassName = `rounded-lg border border-white/10 bg-black/35 px-2.5 py-2 text-zinc-200 ${
    compactRatingsRow ? "gap-3 sm:gap-4" : "gap-2"
  }`;

  const ratingsActionsRow = (
    <div
      className={`${splitFeedActions ? "" : "mt-2"} ${
        isFeed
          ? `${splitFeedActions ? "flex flex-wrap items-center" : "flex items-center"} ${feedRatingsCardClassName}`
          : "grid grid-cols-3 gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-center text-gray-700"
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
          <div className="flex leading-tight" title={formatFollowingRatingsCount(movie.followingRatingsCount) || undefined}>
            <span className="font-semibold" aria-label="Calificación de seguidos">
              👥 {formatFollowingRating(movie.followingAvgRating)}
            </span>
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
        <>
          {tmdbUrl || ratingsActionsTmdbSlot ? (
            <div className="mx-auto grid w-[210px] min-w-fit shrink-0 grid-cols-[minmax(0,1fr)_82px_minmax(0,1fr)] items-center sm:w-[250px] md:w-[290px]">
              <div aria-hidden="true" />
              {tmdbUrl ? (
                <TooltipTarget text={tmdbTooltip}>
                  <a
                    href={tmdbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tmdbTooltip}
                    className="inline-flex h-8 w-[82px] shrink-0 items-center justify-center justify-self-center transition hover:-translate-y-px hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#90CEA1]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/tmdb.svg" alt="" className="h-auto w-full object-contain" loading="lazy" />
                  </a>
                </TooltipTarget>
              ) : null}
              {ratingsActionsTmdbSlot ? <div className="relative z-30 shrink-0 justify-self-start pl-5 sm:pl-8 md:pl-10">{ratingsActionsTmdbSlot}</div> : null}
            </div>
          ) : null}
          <div className={`relative ml-auto ${splitFeedActions ? "flex min-w-fit items-center gap-2" : highlightMyRatingSlot ? "min-w-[9rem]" : ""}`}>
            {splitFeedActions ? (
              <CommentDetailButton title={displayTitle} synopsisEs={movie.synopsis_es} synopsis={movie.synopsis} className="h-8 w-8 shrink-0" />
            ) : null}
            {showBottomInteractionIcons ? (
              <div
                className={`interaction-icons z-10 ${
                  splitFeedActions
                    ? "static"
                    : `absolute ${highlightMyRatingSlot ? (showExtendedMetadata ? "left-[58%] top-1/2 -translate-x-1/2 -translate-y-1/2" : "hidden") : "right-10 -top-7"}`
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
            {!splitFeedActions ? (
              <CommentDetailButton title={displayTitle} synopsisEs={movie.synopsis_es} synopsis={movie.synopsis} className="h-8 w-8 shrink-0" />
            ) : null}
          </div>
        </>
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
  );

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
          {showExtendedMetadata && (hasDirector || hasCast || creditsLoading) ? (
            <div className="min-w-0 space-y-1.5 overflow-visible md:pt-0.5">
              {hasDirector ? (
                <p className={`min-w-0 overflow-visible whitespace-nowrap text-sm leading-snug ${isFeed ? "text-zinc-300" : "text-gray-600"}`}>
                  <span className={`font-semibold ${isFeed ? "text-zinc-100" : "text-gray-900"}`}>{t("movieDetailDirector")}:</span>{" "}
                  {directorPeople.map((person, index) => (
                    <span key={`${getPersonCacheKey(person)}-${index}`} className="inline-flex min-w-0 align-baseline">
                      {index > 0 ? <span className="mx-1.5 text-zinc-600">·</span> : null}
                      <PersonName person={person} cache={personDetailCache} onEnsureDetail={ensurePersonDetail} />
                    </span>
                  ))}
                </p>
              ) : null}
              {hasCast ? <CastLine label={t("movieDetailCast")} people={castPeople} cache={personDetailCache} onEnsureDetail={ensurePersonDetail} isFeed={isFeed} /> : null}
              {creditsLoading && !hasCast && !hasDirector ? (
                <div className="space-y-2" aria-label={locale === "en" ? "Loading cast" : "Cargando reparto"}>
                  <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
                  <div className="h-3 w-44 animate-pulse rounded-full bg-white/10" />
                </div>
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
        {!splitFeedActions ? ratingsActionsRow : null}
      </div>
    </article>
  );

  if (splitFeedActions) {
    return (
      <div className="space-y-2">
        {cardContent}
        {ratingsActionsRow}
      </div>
    );
  }

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
