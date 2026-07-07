"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import type { Country } from "../lib/i18n";
import type { Movie } from "../lib/movies";
import { fetchMovieTrailer, withYouTubeIframeApiParams } from "../lib/trailers";

const LONG_PRESS_DELAY_MS = 600;
const MOVE_THRESHOLD_X = 14;
const MOVE_THRESHOLD_Y = 12;

export function useTrailerLongPress(movieId: Movie["id"] | null | undefined, country: Country, enabled = true) {
  const [open, setOpen] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [watchUrl, setWatchUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [externalOnly, setExternalOnly] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unavailableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const requestRef = useRef(0);
  const suppressNextClickRef = useRef(false);

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

  const reset = useCallback((invalidateRequest = true) => {
    clearLongPressTimer();
    clearUnavailableTimer();
    if (invalidateRequest) requestRef.current += 1;
    setLoading(false);
    setError(false);
    setUnavailable(false);
    setExternalOnly(false);
    setOpen(false);
    setTrailerUrl(null);
    setWatchUrl(null);
  }, [clearLongPressTimer, clearUnavailableTimer]);

  const openTrailer = useCallback(async () => {
    if (!movieId) return;
    clearUnavailableTimer();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(false);
    setUnavailable(false);
    setExternalOnly(false);
    setTrailerUrl(null);
    setWatchUrl(null);

    try {
      const trailer = await fetchMovieTrailer(movieId, country);
      if (requestRef.current !== requestId) return;
      if (trailer.available && trailer.trailerUrl) {
        setWatchUrl(trailer.watchUrl);
        setTrailerUrl(withYouTubeIframeApiParams(trailer.trailerUrl));
        setUnavailable(false);
        setExternalOnly(false);
        setOpen(true);
      } else if (!trailer.available && trailer.externalOnly && trailer.watchUrl) {
        setWatchUrl(trailer.watchUrl);
        setTrailerUrl(null);
        setUnavailable(false);
        setExternalOnly(true);
        setOpen(true);
      } else {
        setOpen(false);
        setWatchUrl(null);
        setTrailerUrl(null);
        setExternalOnly(false);
        setUnavailable(true);
        unavailableTimerRef.current = setTimeout(() => {
          unavailableTimerRef.current = null;
          setUnavailable(false);
        }, 900);
      }
    } catch {
      if (requestRef.current === requestId) {
        setOpen(false);
        setError(true);
      }
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [clearUnavailableTimer, country, movieId]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (!enabled || !movieId || event.pointerType === "mouse") return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    clearLongPressTimer();
    clearUnavailableTimer();
    requestRef.current += 1;
    setLoading(true);
    setError(false);
    setUnavailable(false);
    setExternalOnly(false);
    setOpen(false);
    setTrailerUrl(null);
    setWatchUrl(null);
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      suppressNextClickRef.current = true;
      void openTrailer();
    }, LONG_PRESS_DELAY_MS);
  }, [clearLongPressTimer, clearUnavailableTimer, enabled, movieId, openTrailer]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    const start = pointerStartRef.current;
    if (!start || start.id !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaY) > MOVE_THRESHOLD_Y || Math.abs(deltaX) > MOVE_THRESHOLD_X) {
      pointerStartRef.current = null;
      reset(true);
    }
  }, [reset]);

  const handlePointerEnd = useCallback(() => {
    if (longPressTimerRef.current) reset(true);
    clearLongPressTimer();
    pointerStartRef.current = null;
  }, [clearLongPressTimer, reset]);

  const handleClickCapture = useCallback((event: React.MouseEvent) => {
    if (!suppressNextClickRef.current) return;
    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
      event.preventDefault();
    }
  }, []);

  const close = useCallback(() => reset(true), [reset]);

  useEffect(() => () => reset(true), [reset]);

  return {
    open,
    trailerUrl,
    watchUrl,
    loading,
    error,
    unavailable,
    externalOnly,
    close,
    posterProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
      onPointerLeave: handlePointerEnd,
      onClickCapture: handleClickCapture,
      onContextMenu: handleContextMenu,
      style: { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as React.CSSProperties,
    },
  };
}
