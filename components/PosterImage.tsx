"use client";

import { useMemo, useState } from "react";
import type { AppBranding } from "../lib/branding";
import { resolvePosterPlaceholderUrl } from "../lib/branding";

interface PosterImageProps {
  posterSrc?: string | null;
  title: string;
  branding?: AppBranding | null;
  className: string;
  placeholderClassName: string;
  loading?: "eager" | "lazy";
  decoding?: "async" | "auto" | "sync";
}

export default function PosterImage({ posterSrc, title, branding = null, className, placeholderClassName, loading = "lazy", decoding = "async" }: PosterImageProps) {
  const realPosterSrc = posterSrc?.trim() || null;
  const brandingPlaceholderSrc = resolvePosterPlaceholderUrl(branding);
  const fallbackPlaceholderSrc = "/brand/qnext-poster-placeholder.png";
  const sourceKey = `${realPosterSrc ?? ""}|${brandingPlaceholderSrc ?? ""}`;
  const sources = useMemo(() => {
    const orderedSources = [realPosterSrc, brandingPlaceholderSrc, fallbackPlaceholderSrc].filter((source): source is string => Boolean(source));
    return Array.from(new Set(orderedSources));
  }, [brandingPlaceholderSrc, realPosterSrc]);
  const [failedSourceState, setFailedSourceState] = useState({ key: sourceKey, index: 0 });
  const sourceIndex = failedSourceState.key === sourceKey ? failedSourceState.index : 0;
  const currentSrc = sources[Math.min(sourceIndex, sources.length - 1)] || fallbackPlaceholderSrc;
  const isRealPoster = Boolean(realPosterSrc && currentSrc === realPosterSrc);
  const isLocalFallback = currentSrc === fallbackPlaceholderSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={isRealPoster ? `Poster de ${title}` : `Poster no disponible para ${title}`}
      className={isRealPoster ? className : placeholderClassName}
      loading={loading}
      decoding={decoding}
      onError={() => {
        if (isLocalFallback) return;
        setFailedSourceState((currentState) => {
          const currentIndex = currentState.key === sourceKey ? currentState.index : 0;
          return { key: sourceKey, index: Math.min(currentIndex + 1, sources.length - 1) };
        });
      }}
    />
  );
}
