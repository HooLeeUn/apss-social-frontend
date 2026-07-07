"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

type YouTubePlayerEvent = { data?: number; target?: YouTubePlayer };
type YouTubePlayer = { destroy: () => void };
type YouTubePlayerVars = Record<string, number | string>;
type YouTubePlayerConstructor = new (element: HTMLElement, options: {
  videoId: string;
  playerVars?: YouTubePlayerVars;
  events?: {
    onError?: (event: YouTubePlayerEvent) => void;
  };
}) => YouTubePlayer;

declare global {
  interface Window {
    YT?: { Player: YouTubePlayerConstructor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youTubeApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube API is only available in the browser"));
  if (window.YT?.Player) return Promise.resolve();
  if (youTubeApiPromise) return youTubeApiPromise;

  youTubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      existingScript.addEventListener("error", () => reject(new Error("Failed to load YouTube IFrame API")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load YouTube IFrame API"));
    document.head.appendChild(script);
  });

  return youTubeApiPromise;
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

function readYouTubeVideoId(trailerUrl: string): string | null {
  try {
    const url = new URL(trailerUrl, "https://www.youtube.com");
    const embedMatch = url.pathname.match(/\/embed\/([^/?#]+)/);
    return embedMatch?.[1] ?? url.searchParams.get("v");
  } catch {
    return null;
  }
}

function readPlayerVars(trailerUrl: string): YouTubePlayerVars {
  const vars: YouTubePlayerVars = { autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1 };
  try {
    const url = new URL(trailerUrl, "https://www.youtube.com");
    url.searchParams.forEach((value, key) => {
      if (key !== "enablejsapi" && key !== "origin") vars[key] = value;
    });
  } catch {
    // Keep safe defaults if the backend returns an unexpected URL format.
  }
  return vars;
}

function YouTubeTrailerPlayer({ trailerUrl, iframeKey, onEmbedError }: { trailerUrl: string; iframeKey: string; onEmbedError: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoId = useMemo(() => readYouTubeVideoId(trailerUrl), [trailerUrl]);
  const playerVars = useMemo(() => readPlayerVars(trailerUrl), [trailerUrl]);

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayer | null = null;

    if (!videoId) {
      onEmbedError();
      return undefined;
    }

    loadYouTubeIframeApi()
      .then(() => {
        if (cancelled || !containerRef.current || !window.YT?.Player) return;
        player = new window.YT.Player(containerRef.current, {
          videoId,
          playerVars,
          events: { onError: () => onEmbedError() },
        });
      })
      .catch(() => {
        if (!cancelled) onEmbedError();
      });

    return () => {
      cancelled = true;
      player?.destroy();
      player = null;
    };
  }, [iframeKey, onEmbedError, playerVars, videoId]);

  return <div ref={containerRef} className="h-full w-full" />;
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
}

export default function TrailerModal({ open, trailerUrl, watchUrl, loading, error = false, unavailable = false, externalOnly = false, onClose, currentLanguage }: TrailerModalProps) {
  const isMobile = useIsMobileTrailerModal(open);
  const [embedErrorKey, setEmbedErrorKey] = useState<string | null>(null);
  const iframeKey = useMemo(() => `${trailerUrl ?? "no-trailer"}-${isMobile ? "mobile" : "desktop"}`, [isMobile, trailerUrl]);
  const handleEmbedError = useCallback(() => setEmbedErrorKey(iframeKey), [iframeKey]);
  const embedError = embedErrorKey === iframeKey;
  const canRenderIframe = Boolean(open && trailerUrl && !loading && !error && !unavailable && !externalOnly && !embedError);

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
    : externalOnly || embedError
      ? t(currentLanguage, "trailerExternalOnly")
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
          {canRenderIframe && trailerUrl ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
              <YouTubeTrailerPlayer key={iframeKey} iframeKey={iframeKey} trailerUrl={trailerUrl} onEmbedError={handleEmbedError} />
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
