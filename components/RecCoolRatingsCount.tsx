import { t, type Locale } from "../lib/i18n";
import ActionsTruncatedText from "./profile-feed/ActionsTruncatedText";

export default function RecCoolRatingsCount({ count, locale, truncatedPopover = false }: { count?: number; locale: Locale; truncatedPopover?: boolean }) {
  const total = typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (truncatedPopover) return <ActionsTruncatedText text={`${total} ${t(locale, total === 1 ? "movieDetailRatingCountSingular" : "movieDetailRatingCountPlural").replace("RecCool", "ReCCool")}`} className="truncate text-xs leading-tight text-zinc-500" />;
  return (
    <p data-reccool-rating-count className="text-xs leading-tight text-zinc-500">
      {total} {t(locale, total === 1 ? "movieDetailRatingCountSingular" : "movieDetailRatingCountPlural")}
    </p>
  );
}
