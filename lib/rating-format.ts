export const EMPTY_RATING_SYMBOL = "—";

function toFiniteNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number.isFinite(value) ? value : null;
}

export function formatAverageRating(value: number | null | undefined): string {
  const normalized = toFiniteNumber(value);
  if (normalized === null) return EMPTY_RATING_SYMBOL;
  return normalized.toFixed(1);
}

export function formatMyRating(value: number | null | undefined): string {
  const normalized = toFiniteNumber(value);
  if (normalized === null) return EMPTY_RATING_SYMBOL;
  return Math.round(normalized).toString();
}

export function formatFollowingRating(value: number | null | undefined): string {
  return formatAverageRating(value);
}

export function formatFollowingRatingsCount(count: number | null | undefined): string | null {
  const normalizedCount = typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (normalizedCount <= 0) return null;
  return `${normalizedCount} calif.`;
}
