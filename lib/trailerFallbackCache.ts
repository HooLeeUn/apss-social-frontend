import { recordTrailerDebugEvent } from "./trailerDebug";

const externalOnlyFallbacks = new Set<string>();
const fallbackMetadata = new Map<string, { writtenAt: string; reason: string; stack: string }>();

function readYouTubeVideoId(url: string): string | null {
  try {
    const parsedUrl = new URL(url, "https://www.youtube.com");
    const pathnameParts = parsedUrl.pathname.split("/").filter(Boolean);

    if (parsedUrl.hostname.includes("youtu.be")) return pathnameParts[0] ?? null;
    if (pathnameParts[0] === "embed" || pathnameParts[0] === "shorts") return pathnameParts[1] ?? null;

    return parsedUrl.searchParams.get("v");
  } catch {
    return null;
  }
}

export function getTrailerFallbackCacheKeys(...urlsOrKeys: Array<string | null | undefined>): string[] {
  const keys = new Set<string>();

  urlsOrKeys.forEach((value) => {
    if (!value) return;

    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    keys.add(trimmedValue);

    const videoId = readYouTubeVideoId(trimmedValue);
    if (videoId) keys.add(videoId);
  });

  return Array.from(keys);
}

export function markTrailerExternalOnlyFallbackWithReason(reason: string, ...urlsOrKeys: Array<string | null | undefined>): void {
  getTrailerFallbackCacheKeys(...urlsOrKeys).forEach((key) => {
    const previousValue = externalOnlyFallbacks.has(key);
    const stack = new Error("CACHE WRITE").stack ?? "Stack unavailable";
    recordTrailerDebugEvent("CACHE WRITE", "trailerFallbackCache.ts · markTrailerExternalOnlyFallbackWithReason() (~line 39)", "fallback", {
      cacheType: "module-level Set<string>", key, previousValue, newValue: true, reason,
    }, stack);
    externalOnlyFallbacks.add(key);
    fallbackMetadata.set(key, { writtenAt: new Date().toISOString(), reason, stack });
  });
}

export function markTrailerExternalOnlyFallback(...urlsOrKeys: Array<string | null | undefined>): void {
  markTrailerExternalOnlyFallbackWithReason("markTrailerExternalOnlyFallback called without diagnostic reason", ...urlsOrKeys);
}

export function inspectTrailerExternalOnlyFallback(...urlsOrKeys: Array<string | null | undefined>) {
  const keys = getTrailerFallbackCacheKeys(...urlsOrKeys);
  const matchedKey = keys.find((key) => externalOnlyFallbacks.has(key)) ?? null;
  return {
    cacheType: "module-level Set<string>",
    keys,
    matchedKey,
    value: matchedKey !== null,
    metadata: matchedKey ? fallbackMetadata.get(matchedKey) ?? null : null,
  };
}

export function hasTrailerExternalOnlyFallback(...urlsOrKeys: Array<string | null | undefined>): boolean {
  return getTrailerFallbackCacheKeys(...urlsOrKeys).some((key) => externalOnlyFallbacks.has(key));
}
