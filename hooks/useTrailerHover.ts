"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Country } from "../lib/i18n";
import type { Movie } from "../lib/movies";
import { fetchMovieTrailer, withTrailerAutoplayParams } from "../lib/trailers";

const TRAILER_HOVER_DELAY_MS = 500;

export function useTrailerHover(movieId: Movie["id"] | null | undefined, country: Country, enabled: boolean, delayMs = TRAILER_HOVER_DELAY_MS) {
  const [open, setOpen] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [watchUrl, setWatchUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearTimer();
    requestRef.current += 1;
    setOpen(false);
    setTrailerUrl(null);
    setWatchUrl(null);
    setLoading(false);
    setUnavailable(false);
  }, [clearTimer]);

  const onMouseEnter = useCallback(() => {
    if (!enabled || movieId === null || movieId === undefined) return;
    clearTimer();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setOpen(false);
    setTrailerUrl(null);
    setWatchUrl(null);
    setUnavailable(false);
    setLoading(true);

    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      try {
        const trailer = await fetchMovieTrailer(movieId, country);
        if (requestRef.current !== requestId) return;
        if (trailer.available && trailer.trailerUrl) {
          setWatchUrl(trailer.watchUrl);
          setTrailerUrl(withTrailerAutoplayParams(trailer.trailerUrl));
          setUnavailable(false);
          setOpen(true);
        } else {
          setWatchUrl(null);
          setTrailerUrl(null);
          setUnavailable(true);
        }
      } catch {
        if (requestRef.current === requestId) setUnavailable(true);
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, delayMs);
  }, [clearTimer, country, delayMs, enabled, movieId]);

  const onMouseLeave = useCallback(() => {
    close();
  }, [close]);

  useEffect(() => {
    return () => {
      clearTimer();
      requestRef.current += 1;
    };
  }, [clearTimer]);

  return { open, trailerUrl, watchUrl, loading, unavailable, onMouseEnter, onMouseLeave, close };
}
