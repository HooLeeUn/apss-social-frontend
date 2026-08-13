"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { hasTrailerExternalOnlyFallback, markTrailerExternalOnlyFallback } from "../lib/trailerFallbackCache";
function useIsMobileTrailerModal(open: boolean) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!open) return;
    const mediaQuery = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, [open]);

  return isMobile;
}

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
}

export default function TrailerModal({ open, trailerUrl, watchUrl, loading, error = false, unavailable = false, externalOnly = false, onClose, currentLanguage, posterUrl = null }: TrailerModalProps) {
  const isMobile = useIsMobileTrailerModal(open);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const wasFullscreenRef = useRef(false);
  const trailerMutedRef = useRef(true);
  const [embedErrorUrl, setEmbedErrorUrl] = useState<string | null>(null);
  const [iframeReadyUrl, setIframeReadyUrl] = useState<string | null>(null);
  const [cachedExternalOnlyUrl, setCachedExternalOnlyUrl] = useState<string | null>(null);
  const embedError = Boolean(trailerUrl && embedErrorUrl === trailerUrl);
  const iframeReady = Boolean(trailerUrl && iframeReadyUrl === trailerUrl);
  const cachedExternalOnly = Boolean(trailerUrl && (cachedExternalOnlyUrl === trailerUrl || hasTrailerExternalOnlyFallback(trailerUrl, watchUrl)));
  const shouldAttemptIframe = Boolean(open && trailerUrl && !loading && !error && !unavailable && !externalOnly && !embedError && !cachedExternalOnly);

  useEffect(() => {
    if (!shouldAttemptIframe || !iframeRef.current) return;

    let cancelled = false;
    const iframe = iframeRef.current;
    const handleEmbedError = () => {
      if (!cancelled) {
        markTrailerExternalOnlyFallback(trailerUrl, watchUrl);
        setCachedExternalOnlyUrl(trailerUrl);
        setEmbedErrorUrl(trailerUrl);
      }
    };
    const createPlayer = () => {
      if (cancelled || !window.YT?.Player || !iframe.isConnected) return;
      new window.YT.Player(iframe, {
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            if (!cancelled) setIframeReadyUrl(trailerUrl);
          },
          onError: handleEmbedError,
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
      playerRef.current = null;
    };
  }, [shouldAttemptIframe, trailerUrl, watchUrl]);

  useEffect(() => {
    if (externalOnly && (trailerUrl || watchUrl)) {
      markTrailerExternalOnlyFallback(trailerUrl, watchUrl);
    }
  }, [externalOnly, trailerUrl, watchUrl]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const isDetailTrailer = Boolean(document.querySelector("[data-desktop-video-reaction-history]"));
    const previousOverflow = document.body.style.overflow;
    if (isDetailTrailer) {
      document.body.classList.add("detail-trailer-active");
      document.body.style.overflow = "hidden";
    }

    const setTrailerAudio = (event: Event) => {
      if (document.body.dataset.trailerCompanionView !== "reaction") return;
      const reactionMuted = (event as CustomEvent<{ muted: boolean }>).detail.muted;
      if (reactionMuted) playerRef.current?.unMute();
      else playerRef.current?.mute();
    };
    const handleReactionFullscreen = () => {
      playerRef.current?.pauseVideo();
      onClose();
    };
    const syncReactionAudio = () => {
      const muted = playerRef.current?.isMuted() ?? true;
      trailerMutedRef.current = muted;
      window.dispatchEvent(new CustomEvent("qnext:trailer-muted-change", { detail: { muted } }));
    };
    const handleFullscreenChange = () => {
      const trailerFullscreen = document.fullscreenElement === iframeRef.current || Boolean(iframeRef.current && document.fullscreenElement?.contains(iframeRef.current));
      if (trailerFullscreen) {
        wasFullscreenRef.current = true;
        window.dispatchEvent(new Event("qnext:trailer-fullscreen-enter"));
      } else if (wasFullscreenRef.current) {
        wasFullscreenRef.current = false;
        onClose();
      }
    };
    const audioPoll = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const muted = player.isMuted();
      if (trailerMutedRef.current !== muted && document.body.dataset.trailerCompanionView === "reaction") {
        window.dispatchEvent(new CustomEvent("qnext:trailer-muted-change", { detail: { muted } }));
      }
      trailerMutedRef.current = muted;
    }, 400);

    window.addEventListener("qnext:reaction-muted-change", setTrailerAudio);
    window.addEventListener("qnext:companion-reaction-enter", syncReactionAudio);
    window.addEventListener("qnext:reaction-fullscreen-enter", handleReactionFullscreen);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    if (isDetailTrailer) window.dispatchEvent(new Event("qnext:detail-trailer-open"));
    return () => {
      window.clearInterval(audioPoll);
      window.removeEventListener("qnext:reaction-muted-change", setTrailerAudio);
      window.removeEventListener("qnext:companion-reaction-enter", syncReactionAudio);
      window.removeEventListener("qnext:reaction-fullscreen-enter", handleReactionFullscreen);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (isDetailTrailer) {
        document.body.classList.remove("detail-trailer-active");
        delete document.body.dataset.trailerCompanionView;
        document.body.style.overflow = previousOverflow;
        window.dispatchEvent(new Event("qnext:detail-trailer-close"));
      }
      wasFullscreenRef.current = false;
      trailerMutedRef.current = true;
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const isYouTubeFallback = Boolean((externalOnly || embedError || cachedExternalOnly) && watchUrl);
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
    <div className="trailer-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-black/78 px-3 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="trailer-modal-title" onMouseDown={onClose}>
      <div
        className="trailer-modal-card relative w-full max-w-3xl overflow-hidden rounded-2xl border border-[#86ADE0]/35 bg-gradient-to-b from-zinc-950 to-black shadow-[0_24px_80px_rgba(47,155,255,0.22)]"
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
        <div className="trailer-modal-content space-y-4 p-4 sm:p-5">
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
              {isMobile ? (
                <iframe
                  key={trailerUrl}
                  ref={iframeRef}
                  src={trailerUrl ?? undefined}
                  title="Trailer"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className={`h-full w-full transition-opacity duration-150 ${iframeReady ? "opacity-100" : "opacity-0"}`}
                />
              ) : (
                <iframe
                  key={trailerUrl}
                  ref={iframeRef}
                  src={trailerUrl ?? undefined}
                  title="Trailer"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className={`h-full w-full transition-opacity duration-150 ${iframeReady ? "opacity-100" : "opacity-0"}`}
                />
              )}
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
              className="trailer-youtube-link inline-flex min-h-11 w-fit items-center justify-center rounded-xl border border-[#86ADE0]/40 bg-[#1f4f7a]/70 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(47,155,255,0.18)] transition hover:bg-[#2f73ad]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]"
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
