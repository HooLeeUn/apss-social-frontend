import { Movie } from "../lib/movies";
import WeeklyHeroCard from "./WeeklyHeroCard";
import WeeklyMiniCard from "./WeeklyMiniCard";

interface WeeklyRecommendationsSectionProps {
  weeklyMovies: Movie[];
}

export default function WeeklyRecommendationsSection({ weeklyMovies }: WeeklyRecommendationsSectionProps) {
  const heroMovies = [weeklyMovies[0], weeklyMovies[1]];
  const miniMovies = Array.from({ length: 6 }, (_, index) => weeklyMovies[index + 2]);

  return (
    <section className="space-y-6 pt-4">
      <h2 className="text-center text-2xl font-semibold text-zinc-100">Recomendaciones de la semana</h2>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.1fr]">
        <WeeklyHeroCard movie={heroMovies[0]} fallbackLabel="Recomendación destacada #1" />
        <WeeklyHeroCard movie={heroMovies[1]} fallbackLabel="Recomendación destacada #2" />

        <div className="grid grid-cols-2 gap-3">
          {miniMovies.map((movie, index) => (
            <WeeklyMiniCard key={movie?.id ?? `weekly-mini-${index}`} movie={movie} fallbackLabel={`Top #${index + 3}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
