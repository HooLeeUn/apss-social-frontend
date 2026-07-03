import { memo, useMemo } from "react";
import { Movie } from "../lib/movies";
import { useI18n } from "../hooks/useI18n";
import WeeklyHeroCard from "./WeeklyHeroCard";
import WeeklyMiniCard from "./WeeklyMiniCard";

interface WeeklyRecommendationsSectionProps {
  weeklyMovies: Movie[];
  currentUserId?: string | number | null;
  currentUsername?: string | null;
  onRated?: (movieId: Movie["id"], score: number, payload?: unknown) => void | Promise<void>;
  listedMovieIds?: Set<string>;
  onToggleMyList?: (movieId: Movie["id"], nextValue: boolean) => Promise<void> | void;
  recommendedMovieIds?: Set<string>;
  onToggleMyRecommendations?: (movieId: Movie["id"], nextValue: boolean) => Promise<void> | void;
}

function WeeklyRecommendationsSection({ weeklyMovies, currentUserId, currentUsername, onRated, listedMovieIds, onToggleMyList, recommendedMovieIds, onToggleMyRecommendations }: WeeklyRecommendationsSectionProps) {
  const { t } = useI18n({ userId: currentUserId, username: currentUsername });
  const heroMovies = useMemo(() => [weeklyMovies[0], weeklyMovies[1]], [weeklyMovies]);
  const miniMovies = useMemo(() => Array.from({ length: 6 }, (_, index) => weeklyMovies[index + 2]), [weeklyMovies]);

  const renderHeroCard = (movie: Movie | undefined, index: number) => (
    <WeeklyHeroCard
      movie={movie}
      fallbackLabel={`Recomendación destacada #${index + 1}`}
      currentUserId={currentUserId}
      onRated={onRated}
      isInMyList={Boolean(movie && listedMovieIds?.has(String(movie.id)))}
      onToggleMyList={onToggleMyList}
      isInMyRecommendations={Boolean(movie && recommendedMovieIds?.has(String(movie.id)))}
      onToggleMyRecommendations={onToggleMyRecommendations}
    />
  );

  const renderMiniCard = (movie: Movie | undefined, index: number) => (
    <WeeklyMiniCard
      movie={movie}
      fallbackLabel={`Top #${index + 3}`}
      currentUserId={currentUserId}
      onRated={onRated}
      isInMyList={Boolean(movie && listedMovieIds?.has(String(movie.id)))}
      onToggleMyList={onToggleMyList}
      isInMyRecommendations={Boolean(movie && recommendedMovieIds?.has(String(movie.id)))}
      onToggleMyRecommendations={onToggleMyRecommendations}
    />
  );

  return (
    <section className="space-y-4 pt-4 pb-8 lg:space-y-6 lg:pb-0">
      <h2 className="text-center text-2xl font-semibold text-zinc-100">{t("weeklyRecs")}</h2>

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
        <div className="min-h-[34.5rem] w-[min(84vw,22rem)] flex-none snap-center">
          {renderHeroCard(heroMovies[0], 0)}
        </div>
        <div className="min-h-[34.5rem] w-[min(84vw,22rem)] flex-none snap-center">
          {renderHeroCard(heroMovies[1], 1)}
        </div>
        {[0, 3].map((startIndex) => (
          <div key={`weekly-mini-slide-${startIndex}`} className="flex w-[min(88vw,24rem)] flex-none snap-center flex-col gap-3">
            {miniMovies.slice(startIndex, startIndex + 3).map((movie, index) => (
              <div key={movie?.id ?? `weekly-mobile-mini-${startIndex + index}`} className="h-[10.5rem]">
                {renderMiniCard(movie, startIndex + index)}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="hidden gap-5 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-stretch lg:gap-8">
        <div className="grid grid-cols-1 gap-4 lg:h-full lg:grid-cols-2 lg:auto-rows-fr">
          <div className="h-full">
            {renderHeroCard(heroMovies[0], 0)}
          </div>
          <div className="h-full">
            {renderHeroCard(heroMovies[1], 1)}
          </div>
        </div>

        <div className="h-full rounded-2xl border border-transparent bg-zinc-950/50 p-3 md:p-4 lg:w-[calc(100%+6rem)] lg:max-w-none lg:border-l-2 lg:pl-5 xl:w-[calc(100%+8rem)]">
          <div className="grid h-full grid-cols-2 gap-3 lg:grid-rows-3 lg:auto-rows-fr">
            {miniMovies.map((movie, index) => (
              <div key={movie?.id ?? `weekly-mini-${index}`} className="h-full">
                {renderMiniCard(movie, index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(WeeklyRecommendationsSection);
