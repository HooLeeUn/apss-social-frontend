"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { withYouTubeIframeApiParams } from "../lib/trailers";

type YouTubePlayer = {
  mute: () => void;
  playVideo: () => void;
  destroy: () => void;
};

type YouTubePlayerConstructor = new (elementId: string, options: {
  events: {
    onReady: (event: { target: YouTubePlayer }) => void;
    onError: () => void;
  };
}) => YouTubePlayer;

declare global {
  interface Window {
    YT?: { Player?: YouTubePlayerConstructor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeIframeApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube API is only available in the browser"));
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeIframeApiPromise) return youtubeIframeApiPromise;

  youtubeIframeApiPromise = new Promise<void>((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return youtubeIframeApiPromise;
}

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
  onClose: () => void;
  currentLanguage: Locale;
}

export default function TrailerModal({ open, trailerUrl, watchUrl, loading, error = false, unavailable = false, onClose, currentLanguage }: TrailerModalProps) {
  const mobilePlayerId = useId().replace(/:/g, "");
  const mobilePlayerRef = useRef<YouTubePlayer | null>(null);
  const [failedMobileTrailerUrl, setFailedMobileTrailerUrl] = useState<string | null>(null);
  const isMobile = useIsMobileTrailerModal(open);
  const mobileTrailerUrl = useMemo(() => (trailerUrl ? withYouTubeIframeApiParams(trailerUrl) : null), [trailerUrl]);
  const mobileEmbedFailed = Boolean(open && trailerUrl && failedMobileTrailerUrl === trailerUrl);

  useEffect(() => {
    if (!open || !isMobile || !mobileTrailerUrl || loading || error || unavailable || mobileEmbedFailed) return;
    let cancelled = false;

    loadYouTubeIframeApi()
      .then(() => {
        if (cancelled || !window.YT?.Player) return;
        mobilePlayerRef.current?.destroy();
        mobilePlayerRef.current = new window.YT.Player(mobilePlayerId, {
          events: {
            onReady: (event) => {
              event.target.mute();
              event.target.playVideo();
            },
            onError: () => {
              if (cancelled) return;
              mobilePlayerRef.current?.destroy();
              mobilePlayerRef.current = null;
              setFailedMobileTrailerUrl(trailerUrl);
              if (watchUrl) window.open(watchUrl, "_blank", "noopener,noreferrer");
            },
          },
        });
      })
      .catch(() => setFailedMobileTrailerUrl(trailerUrl));

    return () => {
      cancelled = true;
      mobilePlayerRef.current?.destroy();
      mobilePlayerRef.current = null;
    };
  }, [error, isMobile, loading, mobileEmbedFailed, mobilePlayerId, mobileTrailerUrl, open, trailerUrl, unavailable, watchUrl]);
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const statusText = loading
    ? t(currentLanguage, "trailerLoading")
    : mobileEmbedFailed
      ? t(currentLanguage, "trailerOpensOnYoutube")
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
          {trailerUrl && !loading && !error && !unavailable && !mobileEmbedFailed ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
              {isMobile ? (
                <iframe
                  id={mobilePlayerId}
                  src={mobileTrailerUrl ?? trailerUrl}
                  title="Trailer"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <iframe
                  src={trailerUrl}
                  title="Trailer"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
              )}
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-center text-sm font-medium text-zinc-300 sm:text-base">
              {statusText}
            </div>
          )}
          {watchUrl ? (
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
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
