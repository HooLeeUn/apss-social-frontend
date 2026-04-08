import { FavoriteMovie } from "../../lib/profile-feed/types";

interface FavoriteMoviesBlockProps {
  movies: FavoriteMovie[];
}

function FavoriteMovieItem({ movie }: { movie?: FavoriteMovie }) {
  const isPlaceholder = !movie;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/80 px-5 py-4 shadow-[0_16px_35px_rgba(0,0,0,0.3)]">
      <div className="absolute inset-0 origin-left -skew-x-12 bg-gradient-to-r from-white/5 via-transparent to-transparent" />
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Favorita</p>
          {isPlaceholder ? (
            <>
              <div className="mt-2 h-4 w-36 rounded-full bg-zinc-800" />
              <div className="mt-2 h-3 w-20 rounded-full bg-zinc-800/70" />
            </>
          ) : (
            <>
              <h3 className="mt-2 text-lg font-semibold text-zinc-100">{movie.title}</h3>
              <p className="text-sm text-zinc-400">{movie.year}</p>
            </>
          )}
        </div>
        <button
          type="button"
          aria-label="Agregar película favorita"
          className="relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-300/60 bg-zinc-900 text-blue-200 shadow-[0_8px_18px_rgba(56,189,248,0.22)] transition hover:border-blue-200 hover:text-blue-100"
        >
          <span className="text-xl leading-none">+</span>
        </button>
      </div>
    </article>
  );
}

export default function FavoriteMoviesBlock({ movies }: FavoriteMoviesBlockProps) {
  const slots = [movies[0], movies[1], movies[2]];

  return (
    <section className="rounded-3xl border border-white/15 bg-zinc-950/65 p-6 shadow-[0_24px_45px_rgba(0,0,0,0.38)]">
      <div className="space-y-4">
        {slots.map((movie, index) => (
          <FavoriteMovieItem key={movie?.id ?? `placeholder-${index}`} movie={movie} />
        ))}
      </div>
    </section>
  );
}
