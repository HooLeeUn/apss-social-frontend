"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, apiFetch } from "../lib/api";
import { formatMyRating } from "../lib/rating-format";
import { useI18n } from "../hooks/useI18n";

interface RatingPopoverProps {
  movieId: number | string;
  currentRating: number | null;
  onRated: (score: number, payload: unknown) => void | Promise<void>;
  onOptimisticRate?: (score: number) => void;
  onRateError?: () => void;
  submitRatingRequest?: (score: number) => Promise<unknown>;
  className?: string;
  icon?: ReactNode;
  disabled?: boolean;
  nullLabel?: string;
  ariaLabel?: string;
}

const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const POPOVER_WIDTH = 260;

export default function RatingPopover({
  movieId,
  currentRating,
  onRated,
  onOptimisticRate,
  onRateError,
  submitRatingRequest,
  className = "",
  icon = "🙋",
  disabled = false,
  nullLabel = "Mi calificación",
  ariaLabel = "Mi calificación",
}: RatingPopoverProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [selectedFlash, setSelectedFlash] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const previewScore = hoveredScore ?? currentRating;
  const hasValidMovieId = movieId !== null && movieId !== undefined && String(movieId).trim().length > 0;
  const isDisabled = disabled || !hasValidMovieId;

  const displayScore = useMemo(() => {
    if (previewScore === null || Number.isNaN(previewScore)) return "-";
    return formatMyRating(Number(previewScore));
  }, [previewScore]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const clearScheduledClose = useCallback(() => {
    if (closeTimeoutRef.current === null) return;
    window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = null;
  }, []);

  const closePopover = useCallback(() => {
    clearScheduledClose();
    setIsOpen(false);
    setHoveredScore(null);
    setError("");
  }, [clearScheduledClose]);

  useEffect(() => {
    if (isDisabled) closePopover();
  }, [closePopover, isDisabled]);

  const scheduleDesktopClose = useCallback(() => {
    clearScheduledClose();
    closeTimeoutRef.current = window.setTimeout(() => {
      closePopover();
    }, 200);
  }, [clearScheduledClose, closePopover]);

  useEffect(() => {
    return () => {
      clearScheduledClose();
    };
  }, [clearScheduledClose]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - POPOVER_WIDTH - 8);
      const alignedLeft = rect.right - POPOVER_WIDTH;
      const popoverHeight = popoverRef.current?.offsetHeight ?? 180;
      const availableBelow = window.innerHeight - rect.bottom;
      const availableAbove = rect.top;
      const shouldOpenAbove = window.matchMedia("(min-width: 1024px)").matches
        && availableBelow < popoverHeight + 8
        && availableAbove > availableBelow;
      const desiredTop = shouldOpenAbove ? rect.top - popoverHeight - 8 : rect.bottom + 8;
      const maxTop = Math.max(8, window.innerHeight - popoverHeight - 8);

      setPopoverPosition({
        top: Math.min(Math.max(8, desiredTop), maxTop),
        left: Math.min(Math.max(8, alignedLeft), maxLeft),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;

      closePopover();
    };

    const handleScrollOrDrag = (event: Event) => {
      if (event instanceof PointerEvent && event.pointerType === "mouse") return;

      const target = event.target as Node | null;
      if (target && (containerRef.current?.contains(target) || popoverRef.current?.contains(target))) return;
      closePopover();
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrDrag, { capture: true, passive: true });
    document.addEventListener("touchmove", handleScrollOrDrag, { passive: true });
    document.addEventListener("pointermove", handleScrollOrDrag, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrDrag, { capture: true });
      document.removeEventListener("touchmove", handleScrollOrDrag);
      document.removeEventListener("pointermove", handleScrollOrDrag);
    };
  }, [closePopover, isOpen]);

  const submitRating = async (score: number) => {
    if (isSaving || isDisabled) return;
    clearScheduledClose();
    onOptimisticRate?.(score);

    try {
      setIsSaving(true);
      setError("");
      const response = submitRatingRequest
        ? await submitRatingRequest(score)
        : await apiFetch(`/movies/${encodeURIComponent(String(movieId))}/rating/`, {
            method: "PUT",
            body: JSON.stringify({ score }),
          });
      await onRated(score, response);
      setSelectedFlash(score);
      closePopover();
      window.setTimeout(() => setSelectedFlash(null), 220);
    } catch (submitError) {
      onRateError?.();
      console.error("Rating submit error:", submitError);
      if (submitError instanceof ApiError) {
        setError("No se pudo guardar tu puntaje.");
      } else {
        setError("Error inesperado al guardar.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`} onMouseEnter={clearScheduledClose} onMouseLeave={scheduleDesktopClose}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          if (isSaving || isDisabled) return;
          clearScheduledClose();
          setIsOpen((value) => !value);
          setError("");
        }}
        disabled={isSaving || isDisabled}
        className={`inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-900/80 px-2 py-1 text-sm font-semibold text-zinc-100 transition-all hover:border-white/35 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 ${
          selectedFlash !== null ? "scale-[1.02] ring-1 ring-emerald-400/70" : ""
        }`}
        aria-label={ariaLabel}
        aria-expanded={isDisabled ? false : isOpen}
        aria-disabled={isDisabled}
      >
        <span aria-hidden="true">{icon}</span>
        <span>{currentRating !== null ? formatMyRating(currentRating) : nullLabel}</span>
        {isSaving ? <span className="text-[11px] text-zinc-400">Guardando...</span> : null}
      </button>

      {isMounted && isOpen
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed z-[120] w-[260px] rounded-xl border border-white/15 bg-zinc-950/95 p-3 shadow-[0_18px_30px_rgba(0,0,0,0.55)] backdrop-blur"
              style={{ top: popoverPosition.top, left: popoverPosition.left }}
              onMouseEnter={clearScheduledClose}
              onMouseLeave={scheduleDesktopClose}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-zinc-400">{t("ratingPopoverTitle")}</p>
              <p className="mb-2 text-sm text-zinc-200">{t("ratingPopoverLabel")}: {displayScore}</p>

              <div className="grid grid-cols-5 gap-1.5">
                {RATING_OPTIONS.map((score) => {
                  const isActive = previewScore !== null && score <= previewScore;

                  return (
                    <button
                      key={score}
                      type="button"
                      disabled={isSaving}
                      onMouseEnter={() => setHoveredScore(score)}
                      onMouseLeave={() => setHoveredScore(null)}
                      onFocus={() => setHoveredScore(score)}
                      onBlur={() => setHoveredScore(null)}
                      onClick={() => void submitRating(score)}
                      className={`rounded-md border px-0 py-1.5 text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? "border-violet-400/80 bg-violet-500/20 text-violet-100"
                          : "border-white/10 bg-zinc-900 text-zinc-300 hover:border-violet-300/70 hover:bg-violet-900/30"
                      } ${isSaving ? "cursor-not-allowed opacity-70" : "hover:scale-[1.03]"}`}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>

              {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
