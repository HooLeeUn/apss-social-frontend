import type { Movie } from "./movies";

/** Temporary switch for trailer-flow diagnostics. Set to false to remove all instrumentation. */
export const TRAILER_DEBUG = true;

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
