import { FavoriteMovie } from "../../lib/profile-feed/types";

interface FavoriteMoviesBlockProps {
  movies: FavoriteMovie[];
}

function FavoriteMovieItem({ movie }: { movie?: FavoriteMovie }) {
  const isPlaceholder = !movie;
  const firstLetter = movie?.title?.charAt(0)?.toUpperCase() ?? "—";

  return (
    <article className="group relative isolate overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/85 px-4 py-4 shadow-[0_16px_35px_rgba(0,0,0,0.3)] [clip-path:polygon(9%_0%,100%_0%,91%_100%,0%_100%)]">
      <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-blue-300/10 opacity-80" />
      <div className="relative flex min-h-[130px] items-center gap-3">
        <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-zinc-900/80 text-xs font-semibold text-zinc-300 shadow-inner shadow-black/30">
          {isPlaceholder ? <span className="text-zinc-600">POSTER</span> : firstLetter}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Favorita</p>
          {isPlaceholder ? (
            <div className="mt-2 space-y-2">
              <div className="h-4 w-10/12 rounded-full bg-zinc-800/90" />
              <div className="h-3 w-7/12 rounded-full bg-zinc-800/70" />
              <div className="h-3 w-8/12 rounded-full bg-zinc-800/70" />
            </div>
          ) : (
            <div className="mt-2 space-y-1">
              <h3 className="truncate text-base font-semibold text-zinc-100">{movie.title}</h3>
              <p className="text-xs text-zinc-400">{movie.year} · Película</p>
              <p className="text-xs text-zinc-500">Espacio reservado para metadatos</p>
            </div>
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
      <div className="grid gap-3 xl:grid-cols-3">
        {slots.map((movie, index) => (
          <FavoriteMovieItem key={movie?.id ?? `placeholder-${index}`} movie={movie} />
        ))}
      </div>
    </section>
  );
}
