import { memo, useMemo } from "react";
import { Movie } from "../lib/movies";
import WeeklyHeroCard from "./WeeklyHeroCard";
import WeeklyMiniCard from "./WeeklyMiniCard";

interface WeeklyRecommendationsSectionProps {
  weeklyMovies: Movie[];
  currentUserId?: string | number | null;
  onRated?: (movieId: Movie["id"], score: number, payload?: unknown) => void | Promise<void>;
  listedMovieIds?: Set<string>;
  onToggleMyList?: (movieId: Movie["id"], nextValue: boolean) => Promise<void> | void;
  recommendedMovieIds?: Set<string>;
  onToggleMyRecommendations?: (movieId: Movie["id"], nextValue: boolean) => Promise<void> | void;
}

function WeeklyRecommendationsSection({ weeklyMovies, currentUserId, onRated, listedMovieIds, onToggleMyList, recommendedMovieIds, onToggleMyRecommendations }: WeeklyRecommendationsSectionProps) {
  const heroMovies = useMemo(() => [weeklyMovies[0], weeklyMovies[1]], [weeklyMovies]);
  const miniMovies = useMemo(() => Array.from({ length: 6 }, (_, index) => weeklyMovies[index + 2]), [weeklyMovies]);

  return (
    <section className="space-y-6 pt-4">
      <h2 className="text-center text-2xl font-semibold text-zinc-100">Recomendaciones de la semana</h2>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-stretch lg:gap-8">
        <div className="grid grid-cols-1 gap-4 lg:h-full lg:grid-cols-2 lg:auto-rows-fr">
          <div className="h-full">
            <WeeklyHeroCard movie={heroMovies[0]} fallbackLabel="Recomendación destacada #1" currentUserId={currentUserId} onRated={onRated} isInMyList={Boolean(heroMovies[0] && listedMovieIds?.has(String(heroMovies[0].id)))} onToggleMyList={onToggleMyList} isInMyRecommendations={Boolean(heroMovies[0] && recommendedMovieIds?.has(String(heroMovies[0].id)))} onToggleMyRecommendations={onToggleMyRecommendations} />
          </div>
          <div className="h-full">
            <WeeklyHeroCard movie={heroMovies[1]} fallbackLabel="Recomendación destacada #2" currentUserId={currentUserId} onRated={onRated} isInMyList={Boolean(heroMovies[1] && listedMovieIds?.has(String(heroMovies[1].id)))} onToggleMyList={onToggleMyList} isInMyRecommendations={Boolean(heroMovies[1] && recommendedMovieIds?.has(String(heroMovies[1].id)))} onToggleMyRecommendations={onToggleMyRecommendations} />
          </div>
        </div>

        <div className="h-full rounded-2xl border border-transparent bg-zinc-950/50 p-3 md:p-4 lg:w-[calc(100%+6rem)] lg:max-w-none lg:border-l-2 lg:pl-5 xl:w-[calc(100%+8rem)]">
          <div className="grid h-full grid-cols-2 gap-3 lg:grid-rows-3 lg:auto-rows-fr">
            {miniMovies.map((movie, index) => (
              <div key={movie?.id ?? `weekly-mini-${index}`} className="h-full">
                <WeeklyMiniCard movie={movie} fallbackLabel={`Top #${index + 3}`} currentUserId={currentUserId} onRated={onRated} isInMyList={Boolean(movie && listedMovieIds?.has(String(movie.id)))} onToggleMyList={onToggleMyList} isInMyRecommendations={Boolean(movie && recommendedMovieIds?.has(String(movie.id)))} onToggleMyRecommendations={onToggleMyRecommendations} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(WeeklyRecommendationsSection);
