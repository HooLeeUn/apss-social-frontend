import { Movie } from "../lib/movies";
import WeeklyHeroCard from "./WeeklyHeroCard";
import WeeklyMiniCard from "./WeeklyMiniCard";

interface WeeklyRecommendationsSectionProps {
  weeklyMovies: Movie[];
}

export default function WeeklyRecommendationsSection({ weeklyMovies }: WeeklyRecommendationsSectionProps) {
  if (weeklyMovies.length === 0) {
    return (
      <section className="space-y-3 pt-4">
        <h2 className="text-center text-2xl font-semibold text-zinc-100">Recomendaciones de la semana</h2>
        <div className="rounded-2xl border border-white/20 bg-zinc-950/45 p-5 text-center text-sm text-zinc-300">
          Aún no hay calificaciones recientes para mostrar recomendaciones de la semana.
        </div>
      </section>
    );
  }

  const heroMovies = weeklyMovies.slice(0, 2);
  const miniMovies = weeklyMovies.slice(2, 8);

  return (
    <section className="space-y-6 pt-4">
      <h2 className="text-center text-2xl font-semibold text-zinc-100">Recomendaciones de la semana</h2>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-stretch lg:gap-8">
        <div className="grid grid-cols-1 gap-4 lg:h-full lg:grid-cols-2 lg:auto-rows-fr">
          {heroMovies.map((movie, index) => (
            <div key={movie.id} className="h-full">
              <WeeklyHeroCard movie={movie} fallbackLabel={`Recomendación destacada #${index + 1}`} />
            </div>
          ))}
        </div>

        <div className="h-full rounded-2xl border border-white/35 bg-zinc-950/50 p-3 md:p-4 lg:border-l-2 lg:pl-5">
          <div className="grid h-full grid-cols-2 gap-3 lg:grid-rows-3 lg:auto-rows-fr">
            {miniMovies.map((movie, index) => (
              <div key={movie.id} className="h-full">
                <WeeklyMiniCard movie={movie} fallbackLabel={`Top #${index + 3}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
