import type { Movie } from "./movies";

/** Temporary switch for trailer-flow diagnostics. Set to false to remove all instrumentation. */
export const TRAILER_DEBUG = true;

export type TrailerDebugLevel = "normal" | "positive" | "warning" | "error" | "fallback";
export type TrailerDebugEvent = {
  id: number;
  elapsedMs: number;
  label: string;
  source: string;
  level: TrailerDebugLevel;
  details?: Record<string, unknown>;
  stack?: string;
};

export type TrailerFallbackWrite = {
  elapsedMs: number;
  previousState: unknown;
  requestedState: unknown;
  reason: string;
  movieId: unknown;
  videoId: unknown;
  available: unknown;
  externalOnly: boolean;
  currentError: unknown;
  errorCode: unknown;
  cachedFallbackValue: unknown;
  cacheKey: unknown;
  playerReady: boolean;
  playerCreated: boolean;
  iframeMounted: boolean;
  interaction: unknown;
  device: unknown;
  sourceFile: string;
  sourceFunction: string;
  sourceLine: string;
  stack: string;
};

const TIMELINE_LIMIT = 60;
let timelineStartedAt = 0;
let nextEventId = 1;
let timeline: TrailerDebugEvent[] = [];
let fallbackReason: string | null = null;
let firstFallbackWrite: TrailerFallbackWrite | null = null;
const timelineListeners = new Set<() => void>();
let playerDiagnosticsInstalled = false;
let playerReadyHookInstalled = false;

const PLAYER_STATE_NAMES: Record<number, string> = {
  [-1]: "UNSTARTED", 0: "ENDED", 1: "PLAYING", 2: "PAUSED", 3: "BUFFERING", 5: "CUED",
};

/** Wraps only the temporary debug surface; every original player method/callback is still called unchanged. */
export function prepareTrailerPlayerDiagnostics(): void {
  if (!TRAILER_DEBUG || typeof window === "undefined") return;
  const install = () => {
    if (playerDiagnosticsInstalled || !window.YT?.Player) return;
    const OriginalPlayer = window.YT.Player;
    window.YT.Player = (function DebugYouTubePlayer(
      element: ConstructorParameters<typeof OriginalPlayer>[0],
      options: ConstructorParameters<typeof OriginalPlayer>[1],
    ) {
      const events = options.events ?? {};
      let readyTimerActive = true;
      recordTrailerDebugEvent("YouTube player created", "TrailerModal.tsx · createPlayer() (~line 51)", "positive");
      recordTrailerDebugEvent("Timeout started (20000 ms)", "TrailerModal.tsx · player effect (~line 42)", "warning");
      const wrappedOptions = {
        ...options,
        events: {
          ...events,
          onReady: (event: YouTubePlayerEvent) => {
            if (readyTimerActive) recordTrailerDebugEvent("Timeout cancelled", "TrailerModal.tsx · onReady() (~line 59)", "normal");
            readyTimerActive = false;
            recordTrailerDebugEvent("onReady", "TrailerModal.tsx · onReady() (~line 56)", "positive");
            wrapPlayerMethods(event.target);
            events.onReady?.(event);
          },
          onStateChange: (event: YouTubePlayerStateChangeEvent) => {
            const translated = PLAYER_STATE_NAMES[event.data];
            recordTrailerDebugEvent(`onStateChange ${event.data}${translated ? ` ${translated}` : " UNKNOWN"}`, "TrailerModal.tsx · onStateChange() (~line 66)", event.data === 1 ? "positive" : "normal");
            events.onStateChange?.(event);
          },
          onError: (event: YouTubePlayerErrorEvent) => {
            if (readyTimerActive) recordTrailerDebugEvent("Timeout cancelled", "TrailerModal.tsx · onError() (~line 72)", "normal");
            readyTimerActive = false;
            recordTrailerDebugEvent(`onError code=${event.data}`, "TrailerModal.tsx · onError() (~line 70)", "error");
            if ([2, 100, 101, 150].includes(event.data)) {
              recordTrailerDebugEvent(`Fallback because onError(${event.data})`, "TrailerModal.tsx · handleTerminalEmbedError() (~line 49)", "fallback");
            }
            events.onError?.(event);
          },
        },
      };
      const player = new OriginalPlayer(element, wrappedOptions);
      wrapPlayerMethods(player);
      return player;
    } as unknown) as typeof OriginalPlayer;
    playerDiagnosticsInstalled = true;
  };
  install();
  if (!playerDiagnosticsInstalled && !playerReadyHookInstalled) {
    playerReadyHookInstalled = true;
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      install();
      previousReady?.();
    };
  }
}

const wrappedPlayers = new WeakSet<YouTubePlayer>();
function wrapPlayerMethods(player: YouTubePlayer): void {
  if (wrappedPlayers.has(player)) return;
  wrappedPlayers.add(player);
  for (const method of ["playVideo", "mute", "stopVideo", "destroy"] as const) {
    const original = player[method].bind(player);
    player[method] = () => {
      if (method === "destroy") recordTrailerDebugEvent("Cleanup started", "TrailerModal.tsx · player effect cleanup() (~line 101)", "warning");
      recordTrailerDebugEvent(`${method}()`, `TrailerModal.tsx · player.${method}()`, method === "playVideo" ? "positive" : "normal");
      original();
      if (method === "destroy") {
        recordTrailerDebugEvent("YouTube player destroyed", "TrailerModal.tsx · cleanup() (~line 105)", "normal");
        recordTrailerDebugEvent("Cleanup finished", "TrailerModal.tsx · player effect cleanup() (~line 107)", "normal");
      }
    };
  }
}

export function startTrailerDebugTimeline(label = "Modal opened", source = "DebugTrailerModal.tsx · modal lifecycle"): void {
  if (!TRAILER_DEBUG) return;
  timelineStartedAt = performance.now();
  timeline = [];
  fallbackReason = null;
  firstFallbackWrite = null;
  recordTrailerDebugEvent(label, source, "normal");
}

export function recordTrailerDebugEvent(label: string, source: string, level: TrailerDebugLevel = "normal", details?: Record<string, unknown>, stack?: string): void {
  if (!TRAILER_DEBUG || typeof performance === "undefined") return;
  if (!timelineStartedAt) timelineStartedAt = performance.now();
  if (level === "fallback") fallbackReason = label;
  timeline = [...timeline, { id: nextEventId++, elapsedMs: Math.round(performance.now() - timelineStartedAt), label, source, level, details, stack }].slice(-TIMELINE_LIMIT);
  trailerDebugLog(label, { source, elapsedMs: timeline.at(-1)?.elapsedMs });
  timelineListeners.forEach((listener) => listener());
}

export function traceFallbackWriteAttempt(write: Omit<TrailerFallbackWrite, "elapsedMs" | "stack"> & { stack?: string }): void {
  if (!TRAILER_DEBUG || typeof performance === "undefined") return;
  const stack = write.stack ?? new Error("FALLBACK WRITE ATTEMPT").stack ?? "Stack unavailable";
  const entry: TrailerFallbackWrite = { ...write, elapsedMs: Math.round(performance.now() - timelineStartedAt), stack };
  if (!firstFallbackWrite) firstFallbackWrite = entry;
  console.trace("[TRAILER DEBUG] FALLBACK WRITE ATTEMPT", entry);
  recordTrailerDebugEvent("FALLBACK WRITE ATTEMPT", `${write.sourceFile} · ${write.sourceFunction} (${write.sourceLine})`, "fallback", { ...entry }, stack);
}

export function getFirstTrailerFallbackWrite(): TrailerFallbackWrite | null {
  return firstFallbackWrite;
}

export function recordTrailerStateInitialization(details: Record<string, unknown>): void {
  recordTrailerDebugEvent("STATE INITIALIZATION", "TrailerModal.tsx · TrailerModal() (~line 30)", "normal", details, new Error("STATE INITIALIZATION").stack);
}

export function buildTrailerDebugReport(general: Record<string, unknown>): string {
  const serialize = (value: unknown) => JSON.stringify(value, null, 2);
  const initializations = timeline.filter((event) => event.label === "STATE INITIALIZATION");
  const cacheLookups = timeline.filter((event) => event.label === "CACHE LOOKUP");
  return [
    "TRAILER DEBUG REPORT",
    "\nGENERAL\n" + serialize(general),
    "\nFIRST FALLBACK WRITE\n" + serialize(firstFallbackWrite),
    "\nSTATE INITIALIZATION\n" + serialize(initializations),
    "\nCACHE LOOKUP\n" + serialize(cacheLookups),
    "\nEVENT TIMELINE\n" + serialize(timeline),
    "\nSTACK TRACE\n" + (firstFallbackWrite?.stack ?? "No fallback write captured"),
  ].join("\n");
}

export function getTrailerDebugTimeline(): TrailerDebugEvent[] {
  return timeline;
}

export function getTrailerDebugFallbackReason(): string | null {
  return fallbackReason;
}

export function subscribeTrailerDebugTimeline(listener: () => void): () => void {
  timelineListeners.add(listener);
  return () => timelineListeners.delete(listener);
}

export type TrailerDebugSnapshot = {
  movieId: Movie["id"];
  title: string | null;
  tmdbId: unknown;
  videoId: unknown;
  trailerKey: unknown;
  trailer_url: unknown;
  watchUrl: unknown;
  available: unknown;
  external_only: unknown;
  source: unknown;
  language: unknown;
  normalizedResponse: unknown;
};

const snapshots = new Map<string, TrailerDebugSnapshot>();

export function trailerDebugLog(step: string, details: Record<string, unknown>): void {
  if (!TRAILER_DEBUG) return;
  console.log(`[TRAILER DEBUG] ${step}`, details);
}

export function saveTrailerDebugSnapshot(snapshot: TrailerDebugSnapshot): void {
  if (!TRAILER_DEBUG) return;
  snapshots.set(String(snapshot.movieId), snapshot);
}

export function getTrailerDebugSnapshot(movieId: Movie["id"] | null | undefined): TrailerDebugSnapshot | null {
  if (!TRAILER_DEBUG || movieId === null || movieId === undefined) return null;
  return snapshots.get(String(movieId)) ?? null;
}
