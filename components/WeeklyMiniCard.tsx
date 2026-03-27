import { Movie } from "../lib/movies";

interface WeeklyMiniCardProps {
  movie?: Movie;
  fallbackLabel: string;
}

function renderRating(value: number | null | undefined): string {
  return value !== null && value !== undefined ? value.toFixed(1) : "-";
}

function getAvatarFallback(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return "★";

  const [first, second] = trimmed.split(/\s+/);
  const initials = `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase();
  return initials || "★";
}

export default function WeeklyMiniCard({ movie, fallbackLabel }: WeeklyMiniCardProps) {
  const title = movie?.title ?? fallbackLabel;
  const genre = movie?.genres?.[0] ?? "Sin género";
  const type = movie?.contentType ?? "Movie / Series";
  const topUserName = movie?.topUser?.name?.trim() || "Top user";

  const hasFollowingRating = movie?.followingAvgRating !== null && movie?.followingAvgRating !== undefined;
  const hasMyRating = movie?.myRating !== null && movie?.myRating !== undefined;

  return (
    <article className="relative h-full pl-4">
      <div className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-semibold text-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.45)]">
        {movie?.topUser?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={movie.topUser.avatarUrl} alt={`Top user: ${topUserName}`} className="h-full w-full object-cover" />
        ) : (
          <span>{getAvatarFallback(movie?.topUser?.name)}</span>
        )}
      </div>

      <div className="flex h-full overflow-hidden rounded-xl border border-white/25 bg-zinc-950 p-[2px] shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
        <div className="flex h-full w-full overflow-hidden rounded-[10px] border border-white/10 bg-zinc-900/90">
          <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5">
            <div className="min-w-0 space-y-1">
              <h4 className="line-clamp-1 text-sm font-semibold leading-tight text-zinc-50">{title}</h4>
              <p className="line-clamp-1 text-[11px] text-zinc-400">
                <span>{genre}</span>
                <span className="mx-1.5 text-zinc-600">•</span>
                <span>{type}</span>
              </p>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-200">
              <span className="rounded-md border border-white/10 bg-zinc-950/80 px-1.5 py-0.5">⭐ {renderRating(movie?.displayRating)}</span>
              {hasFollowingRating && (
                <span className="rounded-md border border-white/10 bg-zinc-950/80 px-1.5 py-0.5">👥 {renderRating(movie?.followingAvgRating)}</span>
              )}
              {hasMyRating && (
                <span className="rounded-md border border-white/10 bg-zinc-950/80 px-1.5 py-0.5">🙋 {renderRating(movie?.myRating)}</span>
              )}
            </div>
          </div>

          <div className="w-[34%] min-w-[72px] max-w-[92px] border-l border-white/10 bg-zinc-950">
            <div className="h-full w-full">
              {movie?.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={movie.posterUrl} alt={`Poster de ${title}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 px-2 text-center text-[10px] text-zinc-400">
                  Sin poster
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
