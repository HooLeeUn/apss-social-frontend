import { t, type Locale } from "../lib/i18n";

export default function RecCoolRatingsCount({ count, locale }: { count?: number; locale: Locale }) {
  const total = typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return (
    <p data-reccool-rating-count className="text-xs leading-tight text-zinc-500">
      {total} {t(locale, total === 1 ? "movieDetailRatingCountSingular" : "movieDetailRatingCountPlural")}
    </p>
  );
}
