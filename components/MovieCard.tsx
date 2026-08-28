"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../hooks/useI18n";
import { useTrailerHover } from "../hooks/useTrailerHover";
import { resolveMovieTitles } from "../lib/i18n";
import type { Locale } from "../lib/i18n";
import { addMovieToMyList, addMovieToMyRecommendations, Movie, removeMovieFromMyList, removeMovieFromMyRecommendations } from "../lib/movies";
import { fetchMovieTrailer, withYouTubeIframeApiParams } from "../lib/trailers";
import { translateKnownForDepartment } from "../lib/personDepartments";
import { fetchPersonDetail, MoviePersonCredit, PersonDetail } from "../lib/people";
import { formatAverageRating, formatFollowingRating, formatFollowingRatingsCount, formatMyRating } from "../lib/rating-format";
import CommentDetailButton from "./CommentDetailButton";
import MyListIcon from "./MyListIcon";
import RatingPopover from "./RatingPopover";
import GuestContentGate from "./GuestContentGate";
import { useGuestGate } from "./GuestGateProvider";
import { RatingUserSmileIcon } from "./RatingIcons";
import TrailerModal from "./TrailerModal";
import TrailerHoverOverlay from "./TrailerHoverOverlay";
import PosterImage from "./PosterImage";
import type { AppBranding } from "../lib/branding";

const TOOLTIP_OFFSET_PX = 10;
const TOOLTIP_VIEWPORT_PADDING_PX = 16;
const TOOLTIP_MAX_WIDTH_PX = 280;

interface TooltipPosition {
  left: number;
  top: number;
  transform: string;
}

function getTooltipPosition(target: HTMLElement, placement: "auto" | "top" = "auto"): TooltipPosition {
  const rect = target.getBoundingClientRect();
  const centeredLeft = rect.left + rect.width / 2;
  const minLeft = TOOLTIP_VIEWPORT_PADDING_PX + TOOLTIP_MAX_WIDTH_PX / 2;
  const maxLeft = window.innerWidth - TOOLTIP_VIEWPORT_PADDING_PX - TOOLTIP_MAX_WIDTH_PX / 2;
  const left = Math.min(Math.max(centeredLeft, minLeft), Math.max(minLeft, maxLeft));
  const shouldShowBelow = placement === "auto" && rect.top < 96;

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
      className="pointer-events-none fixed z-[10100] whitespace-pre-line rounded-lg border border-[#86ADE0]/30 bg-zinc-950/95 px-3 py-2 text-center text-[11px] font-medium leading-snug text-zinc-100 shadow-[0_14px_32px_rgba(0,0,0,0.45)] ring-1 ring-black/40 backdrop-blur-sm"
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

function TooltipTarget({ text, children, placement = "auto" }: { text: string; children: ReactNode; placement?: "auto" | "top" }) {
  const targetRef = useRef<HTMLSpanElement | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const showTooltip = () => {
    if (!targetRef.current) return;
    setPosition(getTooltipPosition(targetRef.current, placement));
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
const MOBILE_METADATA_DRAG_EVENT = "qnext-mobile-metadata-drag";
const DEFAULT_TRAILER_HOVER_DELAY_MS = 500;
export const MAIN_FEED_TRAILER_HOVER_DELAY_MS = 2000;
const GLOBAL_POPOVERS_HIDE_EVENT = "qnext-hide-active-popovers";
const CAST_OVERFLOW_POPOVER_WIDTH_PX = 310;
const DESKTOP_CAST_MAX_ROWS = 4;
const MOBILE_CAST_VISIBLE_LIMIT = 7;
const UNAVAILABLE_PERSON_NAME_PATTERN = /^n\/?a$/i;

function splitDirectorName(name: string): string[] {
  return name
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !UNAVAILABLE_PERSON_NAME_PATTERN.test(part));
}

function normalizeDirectorPeople(directors: MoviePersonCredit[], director: string | null): MoviePersonCredit[] {
  const sourcePeople = directors.length ? directors : director?.trim() ? [{ id: null, name: director.trim() }] : [];

  return sourcePeople.flatMap((person) =>
    splitDirectorName(person.name).map((name) => ({
      ...person,
      id: name === person.name.trim() ? person.id : null,
      name,
    })),
  );
}

function isInsideQNextPopover(event: Event): boolean {
  return event.target instanceof Element && Boolean(event.target.closest("[data-qnext-popover='true']"));
}

function closeActivePopoversBeforeExternalNavigation() {
  window.dispatchEvent(new Event(PERSON_POPOVER_HIDE_EVENT));
  window.dispatchEvent(new Event(GLOBAL_POPOVERS_HIDE_EVENT));
}

type PersonDetailCacheEntry = { loading: boolean; detail: PersonDetail | null; error: boolean };
type PersonDetailCache = Record<string, PersonDetailCacheEntry>;

const personDetailMemoryCache: PersonDetailCache = {};
const personDetailRequests = new Map<string, Promise<PersonDetail | null>>();
const personDetailSubscribers = new Set<() => void>();

function notifyPersonDetailSubscribers() {
  personDetailSubscribers.forEach((subscriber) => subscriber());
}

function ensurePersonDetailCached(person: MoviePersonCredit) {
  const cacheKey = getPersonCacheKey(person);
  if (personDetailMemoryCache[cacheKey]?.detail || personDetailMemoryCache[cacheKey]?.error || personDetailMemoryCache[cacheKey]?.loading) return;

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
      if (personDetailRequests.get(cacheKey) === request) personDetailRequests.delete(cacheKey);
      notifyPersonDetailSubscribers();
    });
}

function getPersonCacheKey(person: MoviePersonCredit): string {
  const tmdbPersonId = person.tmdbPersonId ?? person.id;
  return tmdbPersonId !== null && tmdbPersonId !== undefined ? `tmdb:${tmdbPersonId}` : `name:${person.name.toLowerCase()}`;
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
    top: shouldShowBelow ? rect.bottom + PERSON_CARD_OFFSET_PX : Math.max(TOOLTIP_VIEWPORT_PADDING_PX, rect.top - PERSON_CARD_OFFSET_PX - estimatedHeight),
    transform: "translateX(-50%)",
  };
}

function getCastOverflowPersonPosition(listbox: HTMLElement, target: HTMLElement): TooltipPosition {
  if (window.matchMedia("(min-width: 1280px)").matches) return getFloatingPosition(target, PERSON_CARD_WIDTH_PX);

  const rect = listbox.getBoundingClientRect();
  const estimatedHeight = 250;
  const gap = PERSON_CARD_OFFSET_PX;
  const spaceBelow = window.innerHeight - rect.bottom - TOOLTIP_VIEWPORT_PADDING_PX;
  const spaceAbove = rect.top - TOOLTIP_VIEWPORT_PADDING_PX;
  const showBelow = spaceBelow >= Math.min(estimatedHeight, spaceAbove);
  const top = showBelow
    ? Math.min(rect.bottom + gap, window.innerHeight - TOOLTIP_VIEWPORT_PADDING_PX - estimatedHeight)
    : Math.max(TOOLTIP_VIEWPORT_PADDING_PX, rect.top - gap - estimatedHeight);

  return {
    left: window.innerWidth / 2,
    top: Math.max(TOOLTIP_VIEWPORT_PADDING_PX, top),
    transform: "translateX(-50%)",
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

function FacebookIcon() {
  return (
    <svg viewBox="0 0 320 512" aria-hidden="true" className="h-[17px] w-[17px]" fill="currentColor">
      <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06H297V6.26S260.43 0 225.36 0C152.14 0 104.17 44.38 104.17 124.72v70.62H22.89V288h81.28v224h100.28V288z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="currentColor">
      <path d="M18.9 2h3.68l-8.04 9.19L24 22h-7.41l-5.8-7.59L4.15 22H.47l8.6-9.83L0 2h7.59l5.24 6.93L18.9 2Zm-1.29 18.1h2.04L6.48 3.8H4.29L17.61 20.1Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

type PersonSocialNetwork = "facebook" | "x" | "instagram";

const PERSON_SOCIAL_ICONS: Record<PersonSocialNetwork, ReactNode> = {
  facebook: <FacebookIcon />,
  x: <XIcon />,
  instagram: <InstagramIcon />,
};

function PersonSocialLink({ href, label, network }: { href: string | null | undefined; label: string; network: PersonSocialNetwork }) {
  if (!href) return null;

  return (
    <TooltipTarget text={label} placement="top">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#86ADE0]/30 bg-zinc-950/80 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_18px_rgba(0,0,0,0.28)] transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#86ADE0]/70 hover:bg-[#86ADE0]/20 hover:text-[#DCEAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          closeActivePopoversBeforeExternalNavigation();
        }}
      >
        {PERSON_SOCIAL_ICONS[network]}
      </a>
    </TooltipTarget>
  );
}

function PersonFloatingCard({ person, cacheEntry, position, locale, onMouseEnter, onMouseLeave }: { person: MoviePersonCredit; cacheEntry: PersonDetailCacheEntry | undefined; position: TooltipPosition; locale: Locale; onMouseEnter: () => void; onMouseLeave: () => void }) {
  const isEnglish = locale === "en";
  const detail = cacheEntry?.detail ?? null;
  const hasSocials = Boolean(detail?.facebookUrl || detail?.xUrl || detail?.instagramUrl);
  const knownFor = translateKnownForDepartment(detail?.knownFor, locale);

  return createPortal(
    <div
      role="tooltip"
      data-qnext-popover="true"
      className="fixed z-[10060] w-[min(320px,calc(100vw-32px))] rounded-2xl border border-[#86ADE0]/30 bg-zinc-950/98 p-3 text-left text-zinc-100 shadow-[0_22px_48px_rgba(0,0,0,0.6)] ring-1 ring-black/50 backdrop-blur-md"
      style={{ left: position.left, top: position.top, transform: position.transform }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex gap-3">
        <PersonAvatar detail={detail} person={person} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-50">{detail?.name ?? person.name}</p>
          {cacheEntry?.loading ? <p className="mt-1 text-[11px] text-zinc-500">{isEnglish ? "Loading details…" : "Cargando ficha…"}</p> : null}
          {cacheEntry?.error ? <p className="mt-1 text-[11px] text-zinc-500">{isEnglish ? "Information not available" : "Información no disponible"}</p> : null}
          {hasSocials ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <PersonSocialLink href={detail?.facebookUrl} label="Facebook" network="facebook" />
              <PersonSocialLink href={detail?.xUrl} label="X" network="x" />
              <PersonSocialLink href={detail?.instagramUrl} label="Instagram" network="instagram" />
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
        <PersonInfoRow label={isEnglish ? "Known For" : "Conocido(a) por"} value={knownFor} />
        <PersonInfoRow label={isEnglish ? "Gender" : "Género"} value={detail?.gender} />
        <PersonInfoRow label={isEnglish ? "Birthday" : "Nacimiento"} value={detail?.birthday} />
        <PersonInfoRow label={isEnglish ? "Day of Death" : "Fallecimiento"} value={detail?.deathday} />
        <PersonInfoRow label={isEnglish ? "Place of Birth" : "Lugar de nacimiento"} value={detail?.placeOfBirth} />
        {!cacheEntry?.loading && !cacheEntry?.error && !knownFor && !detail?.gender && !detail?.birthday && !detail?.deathday && !detail?.placeOfBirth ? (
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
  const positionRef = useRef<TooltipPosition | null>(null);
  const isPinnedOpenRef = useRef(false);
  const isPointerOverNameRef = useRef(false);
  const isPointerOverCardRef = useRef(false);
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

  const updatePosition = useCallback((nextPosition: TooltipPosition | null) => {
    positionRef.current = nextPosition;
    setPosition(nextPosition);
  }, []);

  const hideCard = useCallback(() => {
    clearHoverTimer();
    cancelHide();
    isPinnedOpenRef.current = false;
    isPointerOverNameRef.current = false;
    isPointerOverCardRef.current = false;
    updatePosition(null);
  }, [cancelHide, clearHoverTimer, updatePosition]);

  useEffect(() => {
    const handleHideAll = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.cacheKey === cacheKey) return;
      hideCard();
    };
    const closeIfOutside = (event: Event) => {
      if (!positionRef.current) return;
      if (event.target instanceof Node && targetRef.current?.contains(event.target)) return;
      if (isInsideQNextPopover(event)) return;
      hideCard();
    };
    const closeOnOutsideDrag = (event: Event) => {
      if (event instanceof PointerEvent && event.buttons === 0) return;
      closeIfOutside(event);
    };
    window.addEventListener(PERSON_POPOVER_HIDE_EVENT, handleHideAll);
    window.addEventListener(GLOBAL_POPOVERS_HIDE_EVENT, handleHideAll);
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("pointermove", closeOnOutsideDrag, { passive: true });
    document.addEventListener("touchmove", closeOnOutsideDrag, { passive: true });
    document.addEventListener(MOBILE_METADATA_DRAG_EVENT, closeIfOutside);
    return () => {
      window.removeEventListener(PERSON_POPOVER_HIDE_EVENT, handleHideAll);
      window.removeEventListener(GLOBAL_POPOVERS_HIDE_EVENT, handleHideAll);
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("pointermove", closeOnOutsideDrag);
      document.removeEventListener("touchmove", closeOnOutsideDrag);
      document.removeEventListener(MOBILE_METADATA_DRAG_EVENT, closeIfOutside);
      clearHoverTimer();
      cancelHide();
    };
  }, [cacheKey, cancelHide, clearHoverTimer, hideCard]);

  const scheduleShow = () => {
    isPointerOverNameRef.current = true;
    clearHoverTimer();
    cancelHide();
    if (positionRef.current) return;

    hoverTimerRef.current = window.setTimeout(() => {
      if (!targetRef.current || !isPointerOverNameRef.current) return;
      const initialPosition = getFloatingPosition(targetRef.current, PERSON_CARD_WIDTH_PX);
      window.dispatchEvent(new CustomEvent(PERSON_POPOVER_HIDE_EVENT, { detail: { cacheKey } }));
      isPinnedOpenRef.current = false;
      isPointerOverNameRef.current = true;
      onEnsureDetail(person);
      updatePosition(initialPosition);
    }, PERSON_HOVER_DELAY_MS);
  };

  const scheduleHide = () => {
    isPointerOverNameRef.current = false;
    clearHoverTimer();
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => {
      if (!isPinnedOpenRef.current && !isPointerOverNameRef.current && !isPointerOverCardRef.current) updatePosition(null);
    }, 140);
  };

  const showCardNow = () => {
    if (!targetRef.current) return;
    clearHoverTimer();
    cancelHide();
    const initialPosition = getFloatingPosition(targetRef.current, PERSON_CARD_WIDTH_PX);
    window.dispatchEvent(new CustomEvent(PERSON_POPOVER_HIDE_EVENT, { detail: { cacheKey } }));
    isPinnedOpenRef.current = true;
    isPointerOverNameRef.current = true;
    onEnsureDetail(person);
    updatePosition(initialPosition);
  };

  const handleCardMouseEnter = () => {
    isPointerOverCardRef.current = true;
    cancelHide();
  };

  const handleCardMouseLeave = () => {
    isPointerOverCardRef.current = false;
    if (!isPointerOverNameRef.current) {
      hideTimerRef.current = window.setTimeout(() => {
        if (!isPinnedOpenRef.current && !isPointerOverNameRef.current && !isPointerOverCardRef.current) updatePosition(null);
      }, 120);
    }
  };

  return (
    <span
      ref={targetRef}
      className={`inline-flex min-w-0 ${className}`}
      onMouseEnter={scheduleShow}
      onMouseLeave={scheduleHide}
      onFocus={scheduleShow}
      onBlur={scheduleHide}
      onPointerDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        showCardNow();
      }}
      tabIndex={0}
    >
      <span className="cursor-pointer truncate decoration-[#86ADE0]/50 underline-offset-4 transition hover:text-blue-100 hover:underline focus-visible:text-blue-100">{person.name}</span>
      {position ? <PersonFloatingCard person={person} cacheEntry={cache[cacheKey]} position={position} locale={locale} onMouseEnter={handleCardMouseEnter} onMouseLeave={handleCardMouseLeave} /> : null}
    </span>
  );
}

function CastOverflowPopover({ people, cache, onEnsureDetail, position, locale, onMouseEnter, onMouseLeave }: { people: MoviePersonCredit[]; cache: PersonDetailCache; onEnsureDetail: (person: MoviePersonCredit) => void; position: TooltipPosition; locale: Locale; onMouseEnter: () => void; onMouseLeave: () => void }) {
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<{ person: MoviePersonCredit; position: TooltipPosition } | null>(null);
  const selectedCacheKey = selectedPerson ? getPersonCacheKey(selectedPerson.person) : null;

  return createPortal(
    <div
      role="tooltip"
      data-qnext-popover="true"
      className="fixed z-[10040] w-[min(310px,calc(100vw-32px))] rounded-2xl border border-[#86ADE0]/30 bg-zinc-950/98 p-2.5 text-sm text-zinc-100 shadow-[0_22px_48px_rgba(0,0,0,0.58)] ring-1 ring-black/50 backdrop-blur-md [touch-action:pan-y]"
      style={{ left: position.left, top: position.top, transform: position.transform }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        ref={listboxRef}
        className="scrollbar-dark max-h-56 space-y-1 overflow-y-auto overscroll-contain pr-1 [touch-action:pan-y]"
        onScroll={() => setSelectedPerson(null)}
      >
        {people.map((person, index) => (
          <button
            key={`${getPersonCacheKey(person)}-${index}`}
            type="button"
            className="block w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            onPointerDown={(event) => {
              event.stopPropagation();
              onMouseEnter();
            }}
            onTouchStart={(event) => {
              event.stopPropagation();
              onMouseEnter();
            }}
            onClick={(event) => {
              event.stopPropagation();
              const target = event.currentTarget;
              const cacheKey = getPersonCacheKey(person);
              onMouseEnter();
              onEnsureDetail(person);
              setSelectedPerson({ person, position: getCastOverflowPersonPosition(listboxRef.current ?? target, target) });
              window.dispatchEvent(new CustomEvent(PERSON_POPOVER_HIDE_EVENT, { detail: { cacheKey } }));
            }}
          >
            <span className="cursor-pointer truncate decoration-[#86ADE0]/50 underline-offset-4 transition hover:text-blue-100 hover:underline focus-visible:text-blue-100">{person.name}</span>
          </button>
        ))}
      </div>
      {selectedPerson && selectedCacheKey ? (
        <PersonFloatingCard
          person={selectedPerson.person}
          cacheEntry={cache[selectedCacheKey]}
          position={selectedPerson.position}
          locale={locale}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      ) : null}
    </div>,
    document.body,
  );
}

function CastLine({
  label,
  people,
  cache,
  onEnsureDetail,
  isFeed,
  maxRows = DESKTOP_CAST_MAX_ROWS,
  fixedVisibleCount,
  maxVisibleCount,
  singleLine = false,
}: {
  label: string;
  people: MoviePersonCredit[];
  cache: PersonDetailCache;
  onEnsureDetail: (person: MoviePersonCredit) => void;
  isFeed: boolean;
  maxRows?: number;
  fixedVisibleCount?: number;
  maxVisibleCount?: number;
  singleLine?: boolean;
}) {
  const { locale } = useI18n();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const initialVisibleCount = maxVisibleCount !== undefined ? Math.min(people.length, maxVisibleCount) : Math.min(people.length, singleLine ? 1 : 12);
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);
  const [overflowPosition, setOverflowPosition] = useState<TooltipPosition | null>(null);

  useEffect(() => () => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    if (!overflowPosition) return;
    const closeIfOutside = (event: Event) => {
      if (event.target instanceof Node && rowRef.current?.contains(event.target)) return;
      if (isInsideQNextPopover(event)) return;
      setOverflowPosition(null);
    };
    const closeOnOutsideDrag = (event: Event) => {
      if (event instanceof PointerEvent && event.buttons === 0) return;
      closeIfOutside(event);
    };
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("pointermove", closeOnOutsideDrag, { passive: true });
    document.addEventListener("touchmove", closeOnOutsideDrag, { passive: true });
    document.addEventListener(MOBILE_METADATA_DRAG_EVENT, closeIfOutside);
    window.addEventListener(GLOBAL_POPOVERS_HIDE_EVENT, closeIfOutside);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("pointermove", closeOnOutsideDrag);
      document.removeEventListener("touchmove", closeOnOutsideDrag);
      document.removeEventListener(MOBILE_METADATA_DRAG_EVENT, closeIfOutside);
      window.removeEventListener(GLOBAL_POPOVERS_HIDE_EVENT, closeIfOutside);
    };
  }, [overflowPosition]);

  useEffect(() => {
    if (fixedVisibleCount !== undefined) return;

    const updateVisibleCount = () => {
      if (!rowRef.current || !measureRef.current) return;
      const availableWidth = rowRef.current.getBoundingClientRect().width;
      const items = Array.from(measureRef.current.querySelectorAll<HTMLElement>("[data-cast-measure]"));
      const more = measureRef.current.querySelector<HTMLElement>("[data-cast-more-measure]");
      if (!items.length || !more) return;
      const labelWidth = measureRef.current.querySelector<HTMLElement>("[data-cast-label-measure]")?.getBoundingClientRect().width ?? 0;
      const moreWidth = more.getBoundingClientRect().width;
      const maxWidthAcrossRows = availableWidth * (singleLine ? 1 : maxRows);
      const candidateItems = maxVisibleCount !== undefined ? items.slice(0, maxVisibleCount) : items;
      let used = labelWidth;
      let count = 0;
      for (const item of candidateItems) {
        const width = item.getBoundingClientRect().width;
        const needsMore = count < people.length - 1;
        if (used + width + (needsMore ? moreWidth : 0) <= maxWidthAcrossRows) {
          used += width;
          count += 1;
        } else {
          break;
        }
      }
      const minimumVisibleCount = maxVisibleCount !== undefined ? Math.min(maxVisibleCount, people.length) : singleLine ? 0 : 1;
      const cappedCount = maxVisibleCount !== undefined ? Math.min(count, maxVisibleCount) : count;
      setVisibleCount(Math.max(minimumVisibleCount, Math.min(cappedCount, people.length)));
    };

    updateVisibleCount();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateVisibleCount) : null;
    if (rowRef.current && resizeObserver) resizeObserver.observe(rowRef.current);
    window.addEventListener("resize", updateVisibleCount);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateVisibleCount);
    };
  }, [fixedVisibleCount, label, maxRows, maxVisibleCount, people, singleLine]);

  const effectiveVisibleCount = fixedVisibleCount !== undefined ? Math.max(0, Math.min(fixedVisibleCount, people.length)) : Math.max(0, Math.min(visibleCount, people.length));
  const visiblePeople = people.slice(0, effectiveVisibleCount);
  const overflowPeople = people.slice(effectiveVisibleCount);
  const remainingCount = overflowPeople.length;
  const hasOverflow = remainingCount > 0;

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
    <div ref={rowRef} className={`relative min-w-0 text-sm leading-[1.18] ${singleLine ? "max-h-[1.25rem] whitespace-nowrap" : "overflow-hidden"} ${singleLine ? "" : fixedVisibleCount !== undefined ? "max-h-none" : maxRows > DESKTOP_CAST_MAX_ROWS ? "max-h-[6.25rem]" : "max-h-[4.95rem]"} ${isFeed ? "text-zinc-400" : "text-gray-600"}`}>
      <span className={`font-semibold ${isFeed ? "text-zinc-100" : "text-gray-900"}`}>{label}:</span>{" "}
      {visiblePeople.map((person, index) => (
        <span key={`${getPersonCacheKey(person)}-${index}`} className="inline-flex min-w-0 align-baseline">
          {index > 0 ? <span className="mx-1.5 text-zinc-600">·</span> : null}
          <PersonName person={person} cache={cache} onEnsureDetail={onEnsureDetail} />
        </span>
      ))}
      {hasOverflow ? (
        <>
          {visiblePeople.length > 0 ? <span className="mx-1.5 text-zinc-600">·</span> : null}
          <button
            ref={moreRef}
            type="button"
            className="inline-flex rounded-full border border-[#86ADE0]/25 bg-[#86ADE0]/10 px-2 py-0 text-xs font-bold leading-[1.18] text-blue-100 shadow-sm transition hover:border-[#86ADE0]/55 hover:bg-[#86ADE0]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/60"
            onPointerDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onMouseEnter={showOverflow}
            onMouseLeave={scheduleHide}
            onFocus={showOverflow}
            onBlur={scheduleHide}
            onClick={(event) => {
              event.stopPropagation();
              if (overflowPosition) setOverflowPosition(null);
              else showOverflow();
            }}
          >
            +{remainingCount}
          </button>
          {overflowPosition ? (
            <CastOverflowPopover people={overflowPeople} cache={cache} onEnsureDetail={onEnsureDetail} position={overflowPosition} locale={locale} onMouseEnter={cancelHide} onMouseLeave={scheduleHide} />
          ) : null}
        </>
      ) : null}
      <div ref={measureRef} className="pointer-events-none fixed left-[-9999px] top-[-9999px] whitespace-nowrap text-sm leading-[1.18] opacity-0" aria-hidden="true">
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
  ratingReadOnly?: boolean;
  guestActions?: boolean;
  onRatingReadOnlyClick?: () => void;
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
  preloadPersonDetails?: boolean;
  enableMobileDetailCarousel?: boolean;
  trailerHoverDelayMs?: number;
  branding?: AppBranding | null;
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
  ratingReadOnly = false,
  guestActions = false,
  onRatingReadOnlyClick,
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
  preloadPersonDetails = false,
  enableMobileDetailCarousel = false,
  trailerHoverDelayMs = DEFAULT_TRAILER_HOVER_DELAY_MS,
  branding = null,
}: MovieCardProps) {
  const { showGuestGate } = useGuestGate();
  const guestGateInstanceId = useId();
  const guestRatingGateId = `movie-actions:${movie.id}:${guestGateInstanceId}:rate`;
  const guestListGateId = `movie-actions:${movie.id}:${guestGateInstanceId}:list`;
  const guestRecommendGateId = `movie-actions:${movie.id}:${guestGateInstanceId}:recommend`;
  const guestRatingGateAnchorRef = useRef<HTMLSpanElement | null>(null);
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
  const directorPeople = useMemo<MoviePersonCredit[]>(() => normalizeDirectorPeople(movie.directors, movie.director), [movie.director, movie.directors]);
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
  const [personDetailCache, setPersonDetailCache] = useState<PersonDetailCache>({ ...personDetailMemoryCache });
  const isInMyList = localIsInMyList ?? Boolean(isInMyListOverride ?? movie.isInMyList);
  const isInMyRecommendations = localIsInMyRecommendations ?? Boolean(isInMyRecommendationsOverride ?? movie.isInMyRecommendations);
  const posterSrc = movie.image || movie.posterUrl;
  const shouldRoundDesktopPosterLeft = isLarge || (isFeed && showExtendedMetadata);
  const isDetailMovieCard = isFeed && showExtendedMetadata && !linkToDetail;
  const mobileCarouselRef = useRef<HTMLDivElement | null>(null);
  const [mobileCarouselIndex, setMobileCarouselIndex] = useState(0);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [trailerWatchUrl, setTrailerWatchUrl] = useState<string | null>(null);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [trailerError, setTrailerError] = useState(false);
  const [trailerUnavailable, setTrailerUnavailable] = useState(false);
  const [trailerExternalOnly, setTrailerExternalOnly] = useState(false);
  const [detailTrailerAvailable, setDetailTrailerAvailable] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unavailableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const trailerRequestRef = useRef(0);
  const suppressNextClickRef = useRef(false);
  const hoverTrailer = useTrailerHover(movie.id, country, isDesktopViewport && (isFeed || !linkToDetail), trailerHoverDelayMs);


  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const clearUnavailableTimer = useCallback(() => {
    if (unavailableTimerRef.current) {
      clearTimeout(unavailableTimerRef.current);
      unavailableTimerRef.current = null;
    }
  }, []);

  const resetTrailerState = useCallback((invalidateRequest = true) => {
    clearLongPressTimer();
    clearUnavailableTimer();
    if (invalidateRequest) trailerRequestRef.current += 1;
    setTrailerLoading(false);
    setTrailerError(false);
    setTrailerUnavailable(false);
    setTrailerExternalOnly(false);
    setTrailerOpen(false);
    setTrailerUrl(null);
    setTrailerWatchUrl(null);
  }, [clearLongPressTimer, clearUnavailableTimer]);

  const openTrailer = useCallback(async (options?: { openWhileLoading?: boolean; showUnavailableToast?: boolean }) => {
    clearUnavailableTimer();
    const requestId = trailerRequestRef.current + 1;
    trailerRequestRef.current = requestId;
    setTrailerLoading(true);
    setTrailerError(false);
    setTrailerUnavailable(false);
    setTrailerExternalOnly(false);
    setTrailerUrl(null);
    setTrailerWatchUrl(null);
    if (options?.openWhileLoading) setTrailerOpen(true);

    try {
      const trailer = await fetchMovieTrailer(movie.id, country);
      if (trailerRequestRef.current !== requestId) return;
      if (trailer.available && trailer.trailerUrl) {
        setTrailerWatchUrl(trailer.watchUrl);
        setTrailerUrl(withYouTubeIframeApiParams(trailer.trailerUrl));
        setTrailerUnavailable(false);
        setTrailerExternalOnly(false);
        setTrailerOpen(true);
      } else if (!trailer.available && trailer.externalOnly && trailer.watchUrl) {
        setTrailerWatchUrl(trailer.watchUrl);
        setTrailerUrl(null);
        setTrailerUnavailable(false);
        setTrailerExternalOnly(true);
        setTrailerOpen(true);
      } else {
        setTrailerOpen(false);
        setTrailerWatchUrl(null);
        setTrailerUrl(null);
        setTrailerExternalOnly(false);
        if (options?.showUnavailableToast) {
          setTrailerUnavailable(true);
          unavailableTimerRef.current = setTimeout(() => {
            unavailableTimerRef.current = null;
            setTrailerUnavailable(false);
          }, 900);
        }
      }
    } catch {
      if (trailerRequestRef.current === requestId) {
        setTrailerOpen(Boolean(options?.openWhileLoading));
        setTrailerError(Boolean(options?.openWhileLoading));
      }
    } finally {
      if (trailerRequestRef.current === requestId) setTrailerLoading(false);
    }
  }, [clearUnavailableTimer, country, movie.id]);

  const closeTrailer = useCallback(() => {
    resetTrailerState(true);
  }, [resetTrailerState]);

  const handleTrailerClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void openTrailer({ openWhileLoading: true });
  }, [openTrailer]);

  const handlePosterTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    clearLongPressTimer();
    clearUnavailableTimer();
    trailerRequestRef.current += 1;
    setTrailerLoading(true);
    setTrailerError(false);
    setTrailerUnavailable(false);
    setTrailerExternalOnly(false);
    setTrailerOpen(false);
    setTrailerUrl(null);
    setTrailerWatchUrl(null);
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      suppressNextClickRef.current = true;
      void openTrailer({ showUnavailableToast: true });
    }, 600);
  }, [clearLongPressTimer, clearUnavailableTimer, openTrailer]);

  const handlePosterTouchMove = useCallback((event: React.TouchEvent) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaY) > 12 || Math.abs(deltaX) > 14) {
      touchStartRef.current = null;
      resetTrailerState(true);
    }
  }, [resetTrailerState]);

  const handlePosterTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) resetTrailerState(true);
    clearLongPressTimer();
    touchStartRef.current = null;
  }, [clearLongPressTimer, resetTrailerState]);

  const handlePosterClickCapture = useCallback((event: React.MouseEvent) => {
    if (!suppressNextClickRef.current) return;
    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const updateMobileCarouselIndex = useCallback(() => {
    const node = mobileCarouselRef.current;
    if (!node) return;
    const columnWidth = node.clientWidth || 1;
    setMobileCarouselIndex(Math.max(0, Math.min(2, Math.round(node.scrollLeft / columnWidth))));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const syncDesktopViewport = () => setIsDesktopViewport(mediaQuery.matches);
    syncDesktopViewport();
    mediaQuery.addEventListener("change", syncDesktopViewport);
    return () => mediaQuery.removeEventListener("change", syncDesktopViewport);
  }, []);

  useEffect(() => () => resetTrailerState(true), [resetTrailerState]);

  useEffect(() => {
    const syncCache = () => setPersonDetailCache({ ...personDetailMemoryCache });
    personDetailSubscribers.add(syncCache);
    return () => {
      personDetailSubscribers.delete(syncCache);
    };
  }, []);

  const ensurePersonDetail = useCallback((person: MoviePersonCredit) => {
    ensurePersonDetailCached(person);
  }, []);

  useEffect(() => {
    if (!preloadPersonDetails) return;
    const peopleToPreload = [...directorPeople, ...castPeople.slice(0, 8)];
    peopleToPreload.forEach(ensurePersonDetail);
  }, [castPeople, directorPeople, ensurePersonDetail, preloadPersonDetails]);

  useEffect(() => {
    if (isFeed || linkToDetail || !isDesktopViewport) return;
    let cancelled = false;
    setDetailTrailerAvailable(false);
    fetchMovieTrailer(movie.id, country)
      .then((trailer) => {
        if (!cancelled) setDetailTrailerAvailable(Boolean(trailer.available && trailer.trailerUrl));
      })
      .catch(() => {
        if (!cancelled) setDetailTrailerAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [country, isDesktopViewport, isFeed, linkToDetail, movie.id]);

  const handleToggleMyList = async () => {
    if (guestActions) { showGuestGate(guestListGateId, "list"); return; }
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
    if (guestActions) { showGuestGate(guestRecommendGateId, "recommend"); return; }
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

  const splitFeedRatingClassName = splitFeedActions ? "hidden xl:flex" : "";
  const splitFeedTmdbClassName = splitFeedActions
    ? "contents xl:relative xl:mx-auto xl:grid xl:h-8 xl:w-[290px] xl:min-w-fit xl:shrink-0 xl:grid-cols-[minmax(0,1fr)_82px_minmax(0,1fr)] xl:items-center"
    : "mx-auto grid w-[210px] min-w-fit shrink-0 grid-cols-[minmax(0,1fr)_82px_minmax(0,1fr)] items-center sm:w-[250px] xl:w-[290px]";
  const splitFeedTmdbLogoClassName = splitFeedActions
    ? "inline-flex h-8 w-[82px] shrink-0 items-center justify-center justify-self-start transition hover:-translate-y-px hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#90CEA1]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black xl:justify-self-center"
    : "inline-flex h-8 w-[82px] shrink-0 items-center justify-center justify-self-center transition hover:-translate-y-px hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#90CEA1]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";
  const splitFeedTmdbSlotClassName = splitFeedActions ? "relative z-30 shrink-0 justify-self-center xl:justify-self-start xl:pl-10" : "relative z-30 shrink-0 justify-self-start pl-5 sm:pl-8 xl:pl-10";
  const mobileDetailRatingsRow = splitFeedActions ? (
    <div className="mt-0.5 flex flex-nowrap items-center gap-1.5 text-zinc-200">
      <div className="flex items-center gap-1 text-sm font-semibold">
        <span aria-hidden="true">⭐</span>
        <span aria-label="Calificación general">{formatAverageRating(movie.displayRating)}</span>
      </div>
      <div className="flex items-center gap-1 text-sm font-semibold" title={formatFollowingRatingsCount(movie.followingRatingsCount) || undefined}>
        <span aria-label="Calificación de seguidos">👥 {formatFollowingRating(movie.followingAvgRating)}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs font-semibold sm:text-sm">
        {ratingReadOnly ? (
          <button type="button" onMouseEnter={() => { if (guestActions) showGuestGate(guestRatingGateId, "rate"); }} onClick={() => guestActions ? showGuestGate(guestRatingGateId, "rate") : onRatingReadOnlyClick?.()} className="flex items-center gap-1 rounded-md bg-blue-950/45 px-2 py-1 text-blue-100"><RatingUserSmileIcon className="h-4 w-4 shrink-0 text-violet-400" /><span aria-label="Mi calificación">—</span></button>
        ) : onRated ? (
          <RatingPopover
            movieId={movie.id}
            currentRating={movie.myRating}
            onRated={(score, payload) => onRated(movie.id, score, payload)}
            nullLabel="—"
            ariaLabel="Mi calificación"
            icon={<RatingUserSmileIcon className="h-4 w-4 shrink-0 text-violet-400" />}
            className={`[&_button]:px-1.5 [&_button]:py-0.5 [&_button]:text-xs sm:[&_button]:px-2 sm:[&_button]:py-1 sm:[&_button]:text-sm ${
              highlightMyRatingSlot
                ? "[&_button]:cursor-pointer [&_button]:border-transparent [&_button]:bg-blue-950/45 [&_button]:text-blue-100 [&_button]:shadow-[0_2px_10px_rgba(59,130,246,0.22)] [&_button:hover]:bg-blue-900/45 [&_button:hover]:shadow-[0_6px_14px_rgba(59,130,246,0.28)]"
                : ""
            }`}
          />
        ) : (
          <>
            <RatingUserSmileIcon className="h-4 w-4 shrink-0 text-violet-400" />
            <span aria-label="Mi calificación" className={highlightMyRatingSlot ? "text-blue-100" : ""}>{formatMyRating(movie.myRating)}</span>
          </>
        )}
      </div>
    </div>
  ) : null;

  const mobileSplitFeedActionsRow = splitFeedActions ? (
    <div className={`${feedRatingsCardClassName} grid grid-cols-[1fr_auto_1fr] items-center gap-2 xl:hidden`}>
      <div className="min-w-0 justify-self-start">
        {tmdbUrl ? (
          <TooltipTarget text={tmdbTooltip}>
            {guestActions ? <span aria-label={tmdbTooltip} className="inline-flex h-8 w-[82px] shrink-0 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/tmdb.svg" alt="" className="h-auto w-full object-contain" loading="lazy" />
            </span> : <a
              href={tmdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={tmdbTooltip}
              className="inline-flex h-8 w-[82px] shrink-0 items-center justify-center transition hover:-translate-y-px hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#90CEA1]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              onClick={closeActivePopoversBeforeExternalNavigation}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/tmdb.svg" alt="" className="h-auto w-full object-contain" loading="lazy" />
            </a>}
          </TooltipTarget>
        ) : null}
      </div>
      <div className="relative z-30 shrink-0 justify-self-center">{ratingsActionsTmdbSlot}</div>
      <div className="flex min-w-0 flex-nowrap items-center justify-self-end gap-2">
        <CommentDetailButton tourTarget="feed-card-synopsis" title={displayTitle} synopsisEs={movie.synopsis_es} synopsis={movie.synopsis} className="h-8 w-8 shrink-0" />
        {showBottomInteractionIcons ? (
          <div className="interaction-icons static z-10 flex flex-nowrap items-center gap-1">
            <button data-tour="feed-card-tag" type="button" onMouseEnter={() => { if (guestActions) showGuestGate(guestListGateId, "list"); }} onClick={handleToggleMyList} className={guestActions ? "cursor-default" : "cursor-pointer"} aria-label={isInMyList ? "Quitar de Mi Lista" : "Agregar a Mi Lista"}>
              <MyListIcon cardSize className={`${feedInteractionIconClassName} ${tagIconClassName}`} />
            </button>
            <button data-tour="feed-card-ticket" type="button" onMouseEnter={() => { if (guestActions) showGuestGate(guestRecommendGateId, "recommend"); }} onClick={handleToggleMyRecommendations} className={guestActions ? "cursor-default" : "cursor-pointer"} aria-label={isInMyRecommendations ? "Quitar de Mis recomendadas" : "Agregar a Mis recomendadas"}>
              <img src="/icons/Ticket.png" alt="" className={`${feedInteractionIconClassName} ${isInMyRecommendations ? "interaction-icon-tag--active" : ""}`} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  const ratingsActionsRow = (
    <div
      className={`${splitFeedActions ? "hidden xl:flex" : "mt-2"} ${
        isFeed
          ? `${splitFeedActions ? "flex-wrap items-center justify-start gap-2" : "flex items-center"} ${feedRatingsCardClassName}`
          : "grid grid-cols-3 gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-center text-gray-700"
      }`}
    >
      <div data-tour="feed-card-rating-overall" className={isFeed ? `${splitFeedRatingClassName} items-center text-sm font-semibold ${compactRatingsRow ? "gap-1.5" : "gap-1"}` : ""}>
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
      <div data-tour="feed-card-rating-following" className={isFeed ? `${splitFeedRatingClassName} items-center text-sm font-semibold ${compactRatingsRow ? "gap-1.5" : "gap-1"}` : ""}>
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
        data-tour="feed-card-rating-mine"
        className={
          isFeed
            ? `${splitFeedRatingClassName} items-center ${compactRatingsRow ? "gap-1.5" : "gap-1"} rounded-md px-1.5 py-1 text-sm font-semibold transition-all duration-150 ${
                highlightMyRatingSlot && !onRated
                  ? "border-transparent bg-blue-950/40 shadow-[0_4px_12px_rgba(59,130,246,0.24)] hover:-translate-y-px hover:shadow-[0_8px_16px_rgba(59,130,246,0.3)]"
                  : ""
              }`
            : ""
        }
      >
        {isFeed ? (
          ratingReadOnly ? (
            <span ref={guestRatingGateAnchorRef} className="relative inline-flex"><button type="button" onMouseEnter={() => { if (guestActions) showGuestGate(guestRatingGateId, "rate"); }} onClick={() => guestActions ? showGuestGate(guestRatingGateId, "rate") : onRatingReadOnlyClick?.()} className="flex items-center gap-1 rounded-md bg-blue-950/45 px-2 py-1 text-blue-100"><RatingUserSmileIcon className="h-4 w-4 shrink-0 text-violet-400" /><span aria-label="Mi calificación">—</span></button><GuestContentGate gateId={guestRatingGateId} portal anchorRef={guestRatingGateAnchorRef} /></span>
          ) : onRated ? (
            <RatingPopover
              movieId={movie.id}
              currentRating={movie.myRating}
              onRated={(score, payload) => onRated(movie.id, score, payload)}
              nullLabel="—"
              ariaLabel="Mi calificación"
              icon={<RatingUserSmileIcon className="h-4 w-4 shrink-0 text-violet-400" />}
              className={
                highlightMyRatingSlot
                  ? "[&_button]:cursor-pointer [&_button]:border-transparent [&_button]:bg-blue-950/45 [&_button]:text-blue-100 [&_button]:shadow-[0_2px_10px_rgba(59,130,246,0.22)] [&_button:hover]:bg-blue-900/45 [&_button:hover]:shadow-[0_6px_14px_rgba(59,130,246,0.28)]"
                  : ""
              }
            />
          ) : (
            <>
              <RatingUserSmileIcon className="h-4 w-4 shrink-0 text-violet-400" />
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
            <div className={splitFeedTmdbClassName}>
              <div aria-hidden="true" />
              {tmdbUrl ? (
                <TooltipTarget text={tmdbTooltip}>
                  {guestActions ? <span aria-label={tmdbTooltip} className={splitFeedTmdbLogoClassName}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/tmdb.svg" alt="" className="h-auto w-full object-contain" loading="lazy" />
                  </span> : <a
                    href={tmdbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tmdbTooltip}
                    className={splitFeedTmdbLogoClassName}
                    onClick={closeActivePopoversBeforeExternalNavigation}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/tmdb.svg" alt="" className="h-auto w-full object-contain" loading="lazy" />
                  </a>}
                </TooltipTarget>
              ) : null}
              {ratingsActionsTmdbSlot ? <div className={splitFeedTmdbSlotClassName}>{ratingsActionsTmdbSlot}</div> : null}
            </div>
          ) : null}
          <div className={`relative ${splitFeedActions ? "ml-0 flex min-w-fit items-center justify-self-end gap-2 xl:ml-auto" : highlightMyRatingSlot ? "ml-auto min-w-[9rem]" : "ml-auto"}`}>
            {splitFeedActions ? (
              <CommentDetailButton tourTarget="feed-card-synopsis" title={displayTitle} synopsisEs={movie.synopsis_es} synopsis={movie.synopsis} className="h-8 w-8 shrink-0" />
            ) : null}
            {showBottomInteractionIcons ? (
              <div
                className={`interaction-icons z-10 ${
                  splitFeedActions
                    ? "static"
                    : `absolute ${highlightMyRatingSlot ? (showExtendedMetadata ? "left-[58%] top-1/2 -translate-x-1/2 -translate-y-1/2" : "hidden") : "right-10 -top-7"}`
                }`}
              >
                <span className="relative inline-flex"><button data-tour="feed-card-tag" type="button" onMouseEnter={() => { if (guestActions) showGuestGate(guestListGateId, "list"); }} onClick={handleToggleMyList} className={guestActions ? "cursor-default" : "cursor-pointer"} aria-label={isInMyList ? "Quitar de Mi Lista" : "Agregar a Mi Lista"}>
                  <MyListIcon cardSize className={`${feedInteractionIconClassName} ${tagIconClassName}`} />
                </button><GuestContentGate gateId={guestListGateId} placement="below-end" /></span>
                <span className="relative inline-flex"><button data-tour="feed-card-ticket" type="button" onMouseEnter={() => { if (guestActions) showGuestGate(guestRecommendGateId, "recommend"); }} onClick={handleToggleMyRecommendations} className={guestActions ? "cursor-default" : "cursor-pointer"} aria-label={isInMyRecommendations ? "Quitar de Mis recomendadas" : "Agregar a Mis recomendadas"}>
                  <img src="/icons/Ticket.png" alt="" className={`${feedInteractionIconClassName} ${isInMyRecommendations ? "interaction-icon-tag--active" : ""}`} />
                </button><GuestContentGate gateId={guestRecommendGateId} placement="below-end" /></span>
              </div>
            ) : null}
            {!splitFeedActions ? (
              <CommentDetailButton tourTarget="feed-card-synopsis" title={displayTitle} synopsisEs={movie.synopsis_es} synopsis={movie.synopsis} className="h-8 w-8 shrink-0" />
            ) : null}
          </div>
        </>
      ) : (
        <div className="col-span-3 mt-1 flex justify-center" aria-hidden="true">
          <div className="interaction-icons">
            <button data-tour="feed-card-tag" type="button" onMouseEnter={() => { if (guestActions) showGuestGate(guestListGateId, "list"); }} onClick={handleToggleMyList} className={guestActions ? "cursor-default" : "cursor-pointer"} aria-label={isInMyList ? "Quitar de Mi Lista" : "Agregar a Mi Lista"}>
              <MyListIcon cardSize className={`${compactInteractionIconClassName} ${tagIconClassName}`} />
            </button>
            <button data-tour="feed-card-ticket" type="button" onMouseEnter={() => { if (guestActions) showGuestGate(guestRecommendGateId, "recommend"); }} onClick={handleToggleMyRecommendations} className={guestActions ? "cursor-default" : "cursor-pointer"} aria-label={isInMyRecommendations ? "Quitar de Mis recomendadas" : "Agregar a Mis recomendadas"}>
              <img src="/icons/Ticket.png" alt="" className={`${compactInteractionIconClassName} ${isInMyRecommendations ? "interaction-icon-tag--active" : ""}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );


  const trailerOverlay = isFeed ? null : !linkToDetail && isDesktopViewport && detailTrailerAvailable ? (
    <button
      type="button"
      onClick={handleTrailerClick}
      className="absolute inset-0 z-10 hidden items-center justify-center bg-black/30 text-center text-xs font-bold uppercase tracking-[0.14em] text-white opacity-0 transition-opacity duration-200 hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0] xl:flex"
      aria-label={`${t("trailerTitle")} ${displayTitle}`}
    >
      <span className="rounded-full border border-[#86ADE0]/55 bg-black/65 px-3 py-2 shadow-[0_0_18px_rgba(47,155,255,0.25)]">▶ {t("trailerTitle")}</span>
    </button>
  ) : null;

  const supportsMobileTrailerLongPress = isFeed || !linkToDetail;
  const trailerTouchHandlers = supportsMobileTrailerLongPress
    ? {
        onTouchStart: handlePosterTouchStart,
        onTouchMove: handlePosterTouchMove,
        onTouchEnd: handlePosterTouchEnd,
        onTouchCancel: handlePosterTouchEnd,
        onContextMenu: (event: React.MouseEvent) => { if (!isDesktopViewport) event.preventDefault(); },
        onClickCapture: handlePosterClickCapture,
        style: { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as React.CSSProperties,
      }
    : {};


  const desktopCardContent = (
    <article data-tour={isDetailMovieCard ? undefined : "feed-card"}
      className={`${isFeed && showExtendedMetadata && extendedMetadataMiddleSlot ? "overflow-visible" : "overflow-hidden"} rounded-xl border shadow-sm transition-colors ${
        isFeed ? "border border-white/35 bg-zinc-950/90 text-zinc-100" : "border border-gray-200 bg-white"
      } ${isLarge || isFeed ? "flex" : ""} ${isFeed ? "relative items-stretch" : ""}`}
    >
      <div
        data-tour={isDetailMovieCard ? undefined : "feed-card-poster"}
        data-tour-desktop={isDetailMovieCard ? "detail-trailer" : undefined}
        {...trailerTouchHandlers}
        onMouseEnter={hoverTrailer.onMouseEnter}
        onMouseLeave={hoverTrailer.onMouseLeave}
        className={`group relative flex-shrink-0 overflow-hidden ${shouldRoundDesktopPosterLeft ? "rounded-l-xl" : ""} ${
          isFeed
            ? `${stretchPosterColumn ? "h-auto self-stretch" : "h-[164px] sm:h-[172px]"} w-[108px] bg-zinc-900 sm:w-[114px]`
            : "bg-gray-200"
        } ${isLarge ? "h-72 xl:h-auto xl:w-48" : isFeed ? "" : "h-56"}`}
      >
        {posterSrc ? (
          canNavigateToDetail && isFeed ? (
            <Link href={detailHref} aria-label={`Ver detalle de ${displayTitle}`} className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
              <PosterImage
                posterSrc={posterSrc}
                title={displayTitle}
                branding={branding}
                className={`${shouldRoundDesktopPosterLeft ? "rounded-l-xl" : ""} h-full w-full object-cover transition-transform duration-200 hover:scale-[1.02]`}
                placeholderClassName={`${shouldRoundDesktopPosterLeft ? "rounded-l-xl" : ""} h-full w-full bg-zinc-900 object-contain p-3`}
                loading="lazy"
                decoding="async"
              />
            </Link>
          ) : (
            <PosterImage
              posterSrc={posterSrc}
              title={displayTitle}
              branding={branding}
              className={`${shouldRoundDesktopPosterLeft ? "rounded-l-xl" : ""} h-full w-full object-cover`}
              placeholderClassName={`${shouldRoundDesktopPosterLeft ? "rounded-l-xl" : ""} h-full w-full bg-zinc-900 object-contain p-3`}
              loading={isFeed ? "lazy" : "eager"}
              decoding="async"
            />
          )
        ) : canNavigateToDetail && isFeed ? (
          <Link
            href={detailHref}
            aria-label={`Ver detalle de ${displayTitle}`}
            className={`flex h-full w-full cursor-pointer items-center justify-center overflow-hidden ${shouldRoundDesktopPosterLeft ? "rounded-l-xl" : ""} px-3 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
              isFeed ? "text-zinc-400" : "text-gray-500"
            }`}
          >
            <PosterImage posterSrc={null} title={displayTitle} branding={branding} className={`${shouldRoundDesktopPosterLeft ? "rounded-l-xl" : ""} h-full w-full object-cover`} placeholderClassName={`${shouldRoundDesktopPosterLeft ? "rounded-l-xl" : ""} h-full w-full bg-zinc-900 object-contain p-3`} loading="lazy" decoding="async" />
          </Link>
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center overflow-hidden ${shouldRoundDesktopPosterLeft ? "rounded-l-xl" : ""} px-3 text-center text-sm ${
              isFeed ? "text-zinc-400" : "text-gray-500"
            }`}
          >
            <PosterImage posterSrc={null} title={displayTitle} branding={branding} className={`${shouldRoundDesktopPosterLeft ? "rounded-l-xl" : ""} h-full w-full object-cover`} placeholderClassName={`${shouldRoundDesktopPosterLeft ? "rounded-l-xl" : ""} h-full w-full bg-zinc-900 object-contain p-3`} loading={isFeed ? "lazy" : "eager"} decoding="async" />
          </div>
        )}
        {trailerOverlay}
        <TrailerHoverOverlay loading={hoverTrailer.loading || trailerLoading} unavailable={hoverTrailer.unavailable || trailerUnavailable} locale={locale} />

      </div>

      <div className={`flex min-w-0 flex-1 flex-col p-3 sm:p-3.5 ${isFeed ? "justify-between text-zinc-100" : "space-y-2"}`}>
        <div
          data-tour-desktop={isDetailMovieCard ? "detail-info" : undefined}
          data-tour-detail-metadata={isDetailMovieCard ? "true" : undefined}
          className={`${isFeed ? "min-w-0 space-y-1.5" : "space-y-2"} ${
            showExtendedMetadata
              ? extendedMetadataMiddleSlot
                ? "xl:grid xl:grid-cols-[minmax(0,0.72fr)_minmax(132px,auto)_minmax(0,1.2fr)] xl:items-start xl:gap-x-3 xl:gap-y-2 lg:gap-x-7 xl:space-y-0"
                : "xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] xl:gap-6 xl:space-y-0"
              : ""
          }`}
        >
          <div className="min-w-0 space-y-1.5">
            <div className="min-w-0">
              <h3 data-tour="feed-card-title" className={`truncate font-semibold ${isLarge ? "text-lg" : "text-base"}`}>
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
            <div className="relative z-30 min-w-0 overflow-visible xl:pt-0.5">{extendedMetadataMiddleSlot}</div>
          ) : null}
          {showExtendedMetadata && (hasDirector || hasCast || creditsLoading) ? (
            <div className="min-w-0 space-y-1 overflow-visible xl:pt-0">
              {hasDirector ? (
                <CastLine label={t("movieDetailDirector")} people={directorPeople} cache={personDetailCache} onEnsureDetail={ensurePersonDetail} isFeed={isFeed} maxRows={1} maxVisibleCount={2} singleLine />
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
              <span className="relative inline-flex"><button data-tour="feed-card-tag" type="button" onMouseEnter={() => { if (guestActions) showGuestGate(guestListGateId, "list"); }} onClick={handleToggleMyList} className={guestActions ? "cursor-default" : "cursor-pointer"} aria-label={isInMyList ? "Quitar de Mi Lista" : "Agregar a Mi Lista"}>
                <MyListIcon cardSize className={`${feedInteractionIconClassName} ${tagIconClassName}`} />
              </button><GuestContentGate gateId={guestListGateId} placement="below-end" /></span>
              <span className="relative inline-flex"><button data-tour="feed-card-ticket" type="button" onMouseEnter={() => { if (guestActions) showGuestGate(guestRecommendGateId, "recommend"); }} onClick={handleToggleMyRecommendations} className={guestActions ? "cursor-default" : "cursor-pointer"} aria-label={isInMyRecommendations ? "Quitar de Mis recomendadas" : "Agregar a Mis recomendadas"}>
                <img src="/icons/Ticket.png" alt="" className={`${feedInteractionIconClassName} ${isInMyRecommendations ? "interaction-icon-tag--active" : ""}`} />
              </button><GuestContentGate gateId={guestRecommendGateId} placement="below-end" /></span>
            </div>
          ) : null}
        </div>
        {!splitFeedActions ? ratingsActionsRow : null}
      </div>
    </article>
  );

  const trailerModal = (
    <>
    <TrailerModal
      open={trailerOpen}
      trailerUrl={trailerUrl}
      watchUrl={trailerWatchUrl}
      loading={trailerLoading}
      error={trailerError}
      unavailable={trailerUnavailable}
      externalOnly={trailerExternalOnly}
      onClose={closeTrailer}
      currentLanguage={locale}
      posterUrl={posterSrc}
    />
    <TrailerModal
      open={hoverTrailer.open}
      trailerUrl={hoverTrailer.trailerUrl}
      watchUrl={hoverTrailer.watchUrl}
      loading={hoverTrailer.loading}
      unavailable={hoverTrailer.unavailable}
      onClose={hoverTrailer.close}
      currentLanguage={locale}
      posterUrl={posterSrc}
    />
    </>
  );

  const mobileDetailCardContent = enableMobileDetailCarousel && isFeed && showExtendedMetadata ? (
    <>
      <article data-tour-mobile={isDetailMovieCard ? "detail-info-mobile" : undefined} className="relative flex overflow-hidden rounded-xl border border-white/35 bg-zinc-950/90 text-zinc-100 shadow-sm transition-colors xl:hidden">
        <div data-tour-mobile={isDetailMovieCard ? "detail-poster-mobile" : undefined} className="group relative h-[164px] w-[108px] flex-shrink-0 overflow-hidden bg-zinc-900 sm:h-[172px] sm:w-[114px]" {...trailerTouchHandlers}>
          {posterSrc ? (
            <Link href={detailHref} aria-label={`Ver detalle de ${displayTitle}`} className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
              <PosterImage posterSrc={posterSrc} title={displayTitle} branding={branding} className="h-full w-full object-cover" placeholderClassName="h-full w-full bg-zinc-900 object-contain p-3" loading="lazy" decoding="async" />
            </Link>
          ) : (
            <Link href={detailHref} aria-label={`Ver detalle de ${displayTitle}`} className="flex h-full w-full cursor-pointer items-center justify-center px-3 text-center text-sm text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
              <PosterImage posterSrc={null} title={displayTitle} branding={branding} className="h-full w-full object-cover" placeholderClassName="h-full w-full bg-zinc-900 object-contain p-3" loading="lazy" decoding="async" />
            </Link>
          )}
          <TrailerHoverOverlay loading={trailerLoading} unavailable={trailerUnavailable} locale={locale} />
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          {mobileCarouselIndex > 0 ? <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2 z-20 text-lg font-black leading-none text-[#2f9bff] drop-shadow">‹</span> : null}
          {mobileCarouselIndex < 2 ? <span data-tour-mobile={isDetailMovieCard ? "detail-more-mobile" : undefined} aria-hidden="true" className="pointer-events-none absolute right-2 top-2 z-20 text-lg font-black leading-none text-[#2f9bff] drop-shadow">›</span> : null}
          <div
            ref={mobileCarouselRef}
            className="flex h-[164px] snap-x snap-mandatory overflow-x-auto scroll-smooth overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:h-[172px]"
            onScroll={(event) => {
              updateMobileCarouselIndex();
              document.dispatchEvent(new CustomEvent(MOBILE_METADATA_DRAG_EVENT, { detail: { target: event.target } }));
            }}
            onPointerMove={(event) => document.dispatchEvent(new CustomEvent(MOBILE_METADATA_DRAG_EVENT, { detail: { target: event.target } }))}
            onTouchMove={(event) => document.dispatchEvent(new CustomEvent(MOBILE_METADATA_DRAG_EVENT, { detail: { target: event.target } }))}
          >
            <section className="flex h-full min-w-full snap-start flex-col justify-start px-3 py-3 pr-6 sm:px-3.5" aria-label="Metadata">
              <div className="min-w-0 space-y-1.5">
                <h3 className={`line-clamp-2 break-words font-semibold leading-tight ${isLarge ? "text-lg" : "text-base"}`}>{displayTitle}</h3>
                {displaySecondaryTitle ? <p className="truncate text-xs leading-tight text-blue-200/80">{displaySecondaryTitle}</p> : null}
                <p className="truncate text-sm text-zinc-300">{typeYearLine || t("movieDetailUnknown")}</p>
                <p className="truncate text-sm text-zinc-400">{genresLine}</p>
                {mobileDetailRatingsRow}
              </div>
            </section>
            <section className="h-full min-w-full snap-start overflow-visible px-3 py-3 pr-6 sm:px-3.5" aria-label={locale === "en" ? "Available on" : "Disponible en"}>
              <div className="max-h-full min-w-0 overflow-visible">{extendedMetadataMiddleSlot}</div>
            </section>
            <section className="h-full min-w-full snap-start overflow-visible px-3 py-3 pr-6 sm:px-3.5" aria-label={`${t("movieDetailDirector")} / ${t("movieDetailCast")}`}>
              <div className="min-w-0 space-y-1 overflow-visible">
                {hasDirector ? (
                  <CastLine label={t("movieDetailDirector")} people={directorPeople} cache={personDetailCache} onEnsureDetail={ensurePersonDetail} isFeed={isFeed} maxRows={1} maxVisibleCount={1} singleLine />
                ) : null}
                {hasCast ? (
                  <CastLine
                    label={t("movieDetailCast")}
                    people={castPeople}
                    cache={personDetailCache}
                    onEnsureDetail={ensurePersonDetail}
                    isFeed={isFeed}
                    fixedVisibleCount={MOBILE_CAST_VISIBLE_LIMIT}
                  />
                ) : null}
                {creditsLoading && !hasCast && !hasDirector ? (
                  <div className="space-y-2" aria-label={locale === "en" ? "Loading cast" : "Cargando reparto"}>
                    <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
                    <div className="h-3 w-44 animate-pulse rounded-full bg-white/10" />
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </article>
      <div className="hidden xl:block">{desktopCardContent}</div>
      {trailerModal}
    </>
  ) : (
    <>
      {desktopCardContent}
      {trailerModal}
    </>
  );

  if (splitFeedActions) {
    return (
      <div className="space-y-2">
        {mobileDetailCardContent}
        {mobileSplitFeedActionsRow}
        {ratingsActionsRow}
      </div>
    );
  }

  if (!linkToDetail || isFeed) {
    return mobileDetailCardContent;
  }

  return (
    <Link href={detailHref} className="block">
      {mobileDetailCardContent}
    </Link>
  );
}

export default memo(MovieCard);
