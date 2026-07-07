const externalOnlyFallbacks = new Set<string>();

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

export function markTrailerExternalOnlyFallback(...urlsOrKeys: Array<string | null | undefined>): void {
  getTrailerFallbackCacheKeys(...urlsOrKeys).forEach((key) => externalOnlyFallbacks.add(key));
}

export function hasTrailerExternalOnlyFallback(...urlsOrKeys: Array<string | null | undefined>): boolean {
  return getTrailerFallbackCacheKeys(...urlsOrKeys).some((key) => externalOnlyFallbacks.has(key));
}
