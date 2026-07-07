"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
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
  const [embedErrorUrl, setEmbedErrorUrl] = useState<string | null>(null);
  const embedError = Boolean(trailerUrl && embedErrorUrl === trailerUrl);
  const canRenderIframe = Boolean(open && trailerUrl && !loading && !error && !unavailable && !externalOnly && !embedError);

  useEffect(() => {
    if (!canRenderIframe || !iframeRef.current) return;

    let cancelled = false;
    const iframe = iframeRef.current;
    const handleEmbedError = () => {
      if (!cancelled) setEmbedErrorUrl(trailerUrl);
    };
    const createPlayer = () => {
      if (cancelled || !window.YT?.Player || !iframe.isConnected) return;
      new window.YT.Player(iframe, {
        events: {
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
    };
  }, [canRenderIframe, trailerUrl]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const isYouTubeFallback = Boolean((externalOnly || embedError) && watchUrl);
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
          {canRenderIframe ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
              {isMobile ? (
                <iframe
                  ref={iframeRef}
                  src={trailerUrl ?? undefined}
                  title="Trailer"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <iframe
                  ref={iframeRef}
                  src={trailerUrl ?? undefined}
                  title="Trailer"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
              )}
            </div>
          ) : (
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-center text-sm font-medium text-zinc-300 sm:text-base">
              {isYouTubeFallback && posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55 blur-[1px]" />
              ) : null}
              <div className="absolute inset-0 bg-black/45" />
              <span className="relative z-10 rounded-full border border-[#86ADE0]/35 bg-black/65 px-4 py-2 text-base font-semibold text-white shadow-[0_0_22px_rgba(47,155,255,0.2)]">{statusText}</span>
            </div>
          )}
          {watchUrl ? (
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
