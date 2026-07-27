"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { inspectTrailerExternalOnlyFallback, markTrailerExternalOnlyFallbackWithReason } from "../lib/trailerFallbackCache";
import { recordTrailerDebugEvent, recordTrailerStateInitialization, traceFallbackWriteAttempt } from "../lib/trailerDebug";

const PLAYER_READY_TIMEOUT_MS = 20_000;
const TERMINAL_YOUTUBE_ERROR_CODES = new Set([2, 100, 101, 150]);

type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "embedError";

interface TrailerModalProps {
  open: boolean;
  trailerUrl: string | null;
  watchUrl: string | null;
  loading: boolean;
  error?: boolean;
  unavailable?: boolean;
  externalOnly?: boolean;
  onClose: () => void;
  currentLanguage: Locale;
  posterUrl?: string | null;
  diagnosticContext?: {
    movieId: unknown;
    videoId: unknown;
    available: unknown;
    interaction: "hover" | "long-press";
    device: "mobile" | "desktop";
  };
}

export default function TrailerModal({ open, trailerUrl, watchUrl, loading, error = false, unavailable = false, externalOnly = false, onClose, currentLanguage, posterUrl = null, diagnosticContext }: TrailerModalProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playerCreatedRef = useRef(false);
  const lastErrorCodeRef = useRef<number | null>(null);
  const recordedFallbackConditionsRef = useRef(new Set<string>());
  const initializationRecordedRef = useRef(false);
  const hasOpenedBeforeRef = useRef(false);
  const [playerState, setPlayerState] = useState<{ url: string | null; status: PlayerStatus }>({ url: null, status: "idle" });
  const embedError = Boolean(trailerUrl && playerState.url === trailerUrl && playerState.status === "embedError");
  const iframeReady = Boolean(trailerUrl && playerState.url === trailerUrl && (playerState.status === "ready" || playerState.status === "playing"));
  const cacheLookup = inspectTrailerExternalOnlyFallback(trailerUrl, watchUrl);
  const cachedExternalOnly = Boolean(trailerUrl && cacheLookup.value);
  const shouldAttemptIframe = Boolean(open && trailerUrl && !loading && !error && !unavailable && !externalOnly && !embedError && !cachedExternalOnly);

  const traceFallback = (reason: string, previousState: unknown, requestedState: unknown, sourceFunction: string, sourceLine: string) => {
    const attemptKey = `${reason}|${String(previousState)}|${String(requestedState)}`;
    if (recordedFallbackConditionsRef.current.has(attemptKey)) return;
    recordedFallbackConditionsRef.current.add(attemptKey);
    traceFallbackWriteAttempt({
      previousState,
      requestedState,
      reason,
      movieId: diagnosticContext?.movieId ?? null,
      videoId: diagnosticContext?.videoId ?? null,
      available: diagnosticContext?.available ?? Boolean(trailerUrl),
      externalOnly,
      currentError: error ? "error prop=true" : playerState.status === "embedError" ? "embedError" : null,
      errorCode: lastErrorCodeRef.current,
      cachedFallbackValue: cacheLookup.value,
      cacheKey: cacheLookup.matchedKey ?? cacheLookup.keys,
      playerReady: iframeReady,
      playerCreated: playerCreatedRef.current,
      iframeMounted: Boolean(iframeRef.current),
      interaction: diagnosticContext?.interaction ?? "unknown",
      device: diagnosticContext?.device ?? "unknown",
      sourceFile: "components/TrailerModal.tsx",
      sourceFunction,
      sourceLine,
    });
  };

  useEffect(() => {
    if (!open || initializationRecordedRef.current) return;
    initializationRecordedRef.current = true;
    const retainedFromPreviousOpening = hasOpenedBeforeRef.current && playerState.status !== "idle";
    recordTrailerStateInitialization({
      playerState: { value: playerState, source: hasOpenedBeforeRef.current ? "retained useState value from mounted TrailerModal" : 'useState literal { url: null, status: "idle" }', dependency: "component instance lifetime", fromPreviousOpening: retainedFromPreviousOpening },
      embedError: { value: embedError, source: "derived from playerState.url/status and trailerUrl", dependency: "playerState + trailerUrl", fromPreviousOpening: retainedFromPreviousOpening && embedError },
      playerError: { value: playerState.status === "embedError" ? "embedError" : null, source: "playerState.status", dependency: "player callbacks or ready timeout", fromPreviousOpening: retainedFromPreviousOpening },
      externalOnly: { value: externalOnly, source: "TrailerModal prop (default false)", dependency: "interaction hook response", fromPreviousOpening: false },
      cachedExternalOnly: { value: cachedExternalOnly, source: "module-level externalOnlyFallbacks Set lookup", dependency: cacheLookup.keys, fromPreviousOpening: cachedExternalOnly },
      isYouTubeFallback: { value: Boolean((externalOnly || embedError || cachedExternalOnly) && watchUrl), source: "derived render condition", dependency: "externalOnly || embedError || cachedExternalOnly, gated by watchUrl", fromPreviousOpening: cachedExternalOnly || (retainedFromPreviousOpening && embedError) },
    });
    hasOpenedBeforeRef.current = true;
    recordTrailerDebugEvent("CACHE LOOKUP", "TrailerModal.tsx · modal initialization effect (~line 78)", cachedExternalOnly ? "fallback" : "normal", {
      ...cacheLookup, movieId: diagnosticContext?.movieId ?? null, videoId: diagnosticContext?.videoId ?? null,
    }, cacheLookup.metadata?.stack);
  }, [cacheLookup, cachedExternalOnly, diagnosticContext?.movieId, diagnosticContext?.videoId, embedError, externalOnly, open, playerState, watchUrl]);

  useEffect(() => {
    if (!open) {
      initializationRecordedRef.current = false;
      recordedFallbackConditionsRef.current.clear();
    }
  }, [open]);

  useEffect(() => {
    if (!shouldAttemptIframe || !iframeRef.current) return;

    let cancelled = false;
    let ready = false;
    const iframe = iframeRef.current;
    const readyTimeout = window.setTimeout(() => {
      if (!cancelled) {
        traceFallback("readyTimeout callback fired && cancelled === false", playerState, { url: trailerUrl, status: "embedError" }, "readyTimeout callback", "~line 105");
        setPlayerState({ url: trailerUrl, status: "embedError" });
      }
    }, PLAYER_READY_TIMEOUT_MS);

    const handleTerminalEmbedError = () => {
      traceFallback(`TERMINAL_YOUTUBE_ERROR_CODES.has(${String(lastErrorCodeRef.current)}) === true`, playerState, { url: trailerUrl, status: "embedError" }, "handleTerminalEmbedError", "~line 111");
      markTrailerExternalOnlyFallbackWithReason(`TERMINAL_YOUTUBE_ERROR_CODES.has(${String(lastErrorCodeRef.current)}) === true`, trailerUrl, watchUrl);
      setPlayerState({ url: trailerUrl, status: "embedError" });
    };
    const createPlayer = () => {
      if (cancelled || !window.YT?.Player || !iframe.isConnected) return;
      playerCreatedRef.current = true;
      playerRef.current = new window.YT.Player(iframe, {
        events: {
          onReady: (event) => {
            if (cancelled) return;
            ready = true;
            window.clearTimeout(readyTimeout);
            setPlayerState({ url: trailerUrl, status: "ready" });
            event.target.mute();
            // A mobile browser may still require another tap. That is not an embed failure.
            event.target.playVideo();
          },
          onStateChange: (event) => {
            if (!cancelled && event.data === 1) {
              setPlayerState({ url: trailerUrl, status: "playing" });
            }
          },
          onError: (event) => {
            if (cancelled) return;
            window.clearTimeout(readyTimeout);
            lastErrorCodeRef.current = event.data;
            if (TERMINAL_YOUTUBE_ERROR_CODES.has(event.data)) {
              handleTerminalEmbedError();
            } else {
              // Error 5 and unknown/transient errors keep the player available for a user retry.
              setPlayerState({ url: trailerUrl, status: "ready" });
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        createPlayer();
      };

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimeout);
      if (ready) playerRef.current?.stopVideo();
      playerRef.current?.destroy();
      playerRef.current = null;
      playerCreatedRef.current = false;
    };
  // Diagnostic callbacks deliberately stay outside the dependency list so tracing cannot restart the player lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAttemptIframe, trailerUrl, watchUrl]);

  useEffect(() => {
    if (externalOnly && (trailerUrl || watchUrl)) {
      traceFallback("externalOnly === true && Boolean(trailerUrl || watchUrl)", "cache entries unchanged", "cache entries set to true", "externalOnly cache effect", "~line 173");
      markTrailerExternalOnlyFallbackWithReason("externalOnly === true && Boolean(trailerUrl || watchUrl)", trailerUrl, watchUrl);
    }
  // Diagnostic callbacks deliberately stay outside the dependency list so tracing cannot alter this product effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOnly, trailerUrl, watchUrl]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const isYouTubeFallback = Boolean((externalOnly || embedError || cachedExternalOnly) && watchUrl);
  useEffect(() => {
    if (!isYouTubeFallback) return;
    if (externalOnly) traceFallback("externalOnly === true && Boolean(watchUrl)", "non-fallback render", "fallback render", "TrailerModal fallback decision effect", "~line 199");
    else if (embedError) traceFallback('playerState.status === "embedError" && playerState.url === trailerUrl && Boolean(watchUrl)', playerState.status, "fallback", "TrailerModal fallback decision effect", "~line 200");
    else if (cachedExternalOnly) traceFallback("externalOnlyFallbacks contains a generated cache key && Boolean(watchUrl)", false, true, "TrailerModal fallback decision effect", "~line 201");
  // traceFallback is intentionally omitted so diagnostics never change the product effect lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedExternalOnly, embedError, externalOnly, isYouTubeFallback, playerState.status, watchUrl]);

  if (!open || typeof document === "undefined") return null;

  const showIframePlaceholder = shouldAttemptIframe && !iframeReady;
  const handleFallbackWatchClick = () => {
    onClose();
  };
  const statusText = loading
    ? t(currentLanguage, "trailerLoading")
    : isYouTubeFallback
      ? t(currentLanguage, "trailerWatchOnYoutube")
      : error
        ? t(currentLanguage, "trailerError")
        : unavailable || !trailerUrl
          ? t(currentLanguage, "trailerUnavailable")
          : null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/78 px-3 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="trailer-modal-title" onMouseDown={onClose}>
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-[#86ADE0]/35 bg-gradient-to-b from-zinc-950 to-black shadow-[0_24px_80px_rgba(47,155,255,0.22)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
          <h2 id="trailer-modal-title" className="text-base font-semibold text-[#c7dcf6] sm:text-lg">{t(currentLanguage, "trailerTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-semibold text-zinc-100 transition hover:border-[#86ADE0]/50 hover:bg-[#86ADE0]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]"
            aria-label={t(currentLanguage, "trailerClose")}
          >
            ×
          </button>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          {shouldAttemptIframe ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
              {showIframePlaceholder ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/95 px-4 text-center text-sm font-medium text-zinc-300 sm:text-base">
                  {posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45 blur-[1px]" />
                  ) : null}
                  <div className="absolute inset-0 bg-black/60" />
                  <span className="relative z-10 rounded-full border border-[#86ADE0]/35 bg-black/65 px-4 py-2 text-base font-semibold text-white shadow-[0_0_22px_rgba(47,155,255,0.2)]">{t(currentLanguage, "trailerLoading")}</span>
                </div>
              ) : null}
              <iframe
                key={trailerUrl}
                ref={iframeRef}
                src={trailerUrl ?? undefined}
                title="Trailer"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
                allowFullScreen
                className={`h-full w-full transition-opacity duration-150 ${iframeReady ? "opacity-100" : "opacity-0"}`}
              />
            </div>
          ) : (
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-center text-sm font-medium text-zinc-300 sm:text-base">
              {posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55 blur-[1px]" />
              ) : null}
              <div className="absolute inset-0 bg-black/55" />
              {isYouTubeFallback ? (
                <a
                  href={watchUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleFallbackWatchClick}
                  className="relative z-10 rounded-full border border-[#86ADE0]/45 bg-black/70 px-5 py-3 text-base font-semibold text-white shadow-[0_0_22px_rgba(47,155,255,0.24)] transition hover:border-[#86ADE0]/70 hover:bg-[#1f4f7a]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]"
                >
                  {t(currentLanguage, "trailerWatchOnYoutube")}
                </a>
              ) : (
                <span className="relative z-10 rounded-full border border-[#86ADE0]/35 bg-black/65 px-4 py-2 text-base font-semibold text-white shadow-[0_0_22px_rgba(47,155,255,0.2)]">{statusText}</span>
              )}
            </div>
          )}
          {watchUrl && !isYouTubeFallback ? (
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#86ADE0]/40 bg-[#1f4f7a]/70 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(47,155,255,0.18)] transition hover:bg-[#2f73ad]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0] sm:w-auto"
            >
              {t(currentLanguage, "trailerWatchOnYoutube")}
            </a>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
