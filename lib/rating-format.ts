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

export function formatFollowingRating(value: number | null | undefined, count: number | null | undefined): string {
  const average = formatAverageRating(value);
  if (average === EMPTY_RATING_SYMBOL) return EMPTY_RATING_SYMBOL;

  const normalizedCount = typeof count === "number" && Number.isFinite(count) ? count : 0;
  if (normalizedCount <= 0) return average;

  return `${average} · ${normalizedCount} calif.`;
}
