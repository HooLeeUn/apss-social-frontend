"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../lib/api";
import RatingPopover from "../RatingPopover";
import { getFavoriteMovies, rateFavoriteMovie, searchFavoriteMovieCandidates, setFavoriteMovie } from "../../lib/profile-feed/adapters";
import { FavoriteMovie, FavoriteMovieSearchResult } from "../../lib/profile-feed/types";

interface FavoriteMovieItemProps {
  movie?: FavoriteMovie;
  slot: number;
  onOpenSearch: (slot: number) => void;
  onUpdateMovieRating: (movieId: string, score: number | null) => void;
}

interface FavoriteSearchModalProps {
  slot: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function formatRating(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}`;
}

interface CompactRatingItemProps {
  icon: string;
  label: string;
  value: number | null;
  emphasize?: boolean;
}

function CompactRatingItem({ icon, label, value, emphasize = false }: CompactRatingItemProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-semibold ${
        emphasize ? "border-blue-300/40 bg-blue-900/20 text-blue-100" : "border-white/10 bg-zinc-900/70 text-zinc-200"
      }`}
      aria-label={label}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{formatRating(value)}</span>
    </div>
  );
}

function FavoriteMovieItem({ movie, slot, onOpenSearch, onUpdateMovieRating }: FavoriteMovieItemProps) {
  const firstLetter = (movie?.titleSpanish || movie?.titleEnglish || movie?.title)?.charAt(0)?.toUpperCase() ?? "—";
  const displayTitle = movie?.titleSpanish || movie?.titleEnglish || movie?.title || "";
  const titleClassName = displayTitle.length > 30 ? "text-base lg:text-[17px]" : "text-[17px] lg:text-lg";
  const lastCommittedRatingRef = useRef<number | null>(movie?.myRating ?? null);

  const handleOptimisticRate = (score: number) => {
    if (!movie) return;
    lastCommittedRatingRef.current = movie.myRating;
    onUpdateMovieRating(movie.id, score);
  };

  const handleRateError = () => {
    if (!movie) return;
    onUpdateMovieRating(movie.id, lastCommittedRatingRef.current);
  };

  const handleRated = (score: number) => {
    if (!movie) return;
    lastCommittedRatingRef.current = score;
    onUpdateMovieRating(movie.id, score);
  };

  return (
    <div className="group relative isolate overflow-visible">
      <article className="relative overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/85 px-5 py-3.5 shadow-[0_16px_35px_rgba(0,0,0,0.3)] [clip-path:polygon(9%_0%,100%_0%,91%_100%,0%_100%)]">
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-blue-300/10 opacity-80" />
        <div className="relative flex min-h-[118px] min-w-0 pr-10">
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-y-2 py-0.5">
            {movie ? (
              <>
                <h3 className={`line-clamp-2 leading-tight font-semibold text-zinc-100 ${titleClassName}`}>{displayTitle}</h3>
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-zinc-900/80 text-xs font-semibold text-zinc-300 shadow-inner shadow-black/30">
                    <span className="text-lg">{firstLetter}</span>
                  </div>
                  <div className="flex min-w-0 flex-col justify-center gap-1 pr-1">
                    <p className="text-sm leading-tight text-zinc-300">{movie.year}</p>
                    <p className="text-sm leading-tight text-zinc-300">{movie.genre}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pb-0.5">
                  <CompactRatingItem icon="⭐" label="Puntaje general" value={movie.generalRating} />
                  <CompactRatingItem icon="👥" label="Puntaje de seguidos" value={movie.followingRating} />
                  <RatingPopover
                    movieId={movie.id}
                    currentRating={movie.myRating}
                    onOptimisticRate={handleOptimisticRate}
                    onRateError={handleRateError}
                    onRated={(score) => handleRated(score)}
                    submitRatingRequest={(score) => rateFavoriteMovie(movie.id, score)}
                    icon="🧑"
                    nullLabel="—"
                    ariaLabel="Mi puntaje"
                    className="shrink-0"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-zinc-900/80 text-xs font-semibold text-zinc-300 shadow-inner shadow-black/30">
                  <span className="text-zinc-600">VACÍO</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Favorita {slot}</p>
                  <p className="text-sm text-zinc-500">Selecciona una película para este espacio.</p>
                </div>
              </>
            )}
          </div>
        </div>
      </article>

      <button
        type="button"
        onClick={() => onOpenSearch(slot)}
        aria-label={`Asignar película favorita al slot ${slot}`}
        className="absolute right-0 top-1/2 z-10 inline-flex h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-blue-300/60 bg-zinc-900 text-blue-200 shadow-[0_8px_18px_rgba(56,189,248,0.22)] transition hover:border-blue-200 hover:text-blue-100"
      >
        <span className="text-xl leading-none">+</span>
      </button>
    </div>
  );
}

function FavoriteSearchModal({ slot, open, onClose, onSaved }: FavoriteSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FavoriteMovieSearchResult[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const selectedMovie = useMemo(() => results.find((item) => item.id === selectedMovieId) ?? null, [results, selectedMovieId]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedMovieId("");
      setLoading(false);
      setSaving(false);
      setFeedback("");
    }
  }, [open]);

  const handleSearch = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!query.trim()) {
      setResults([]);
      setSelectedMovieId("");
      setFeedback("Escribe un término para buscar.");
      return;
    }

    try {
      setLoading(true);
      setFeedback("");
      const found = await searchFavoriteMovieCandidates(query);
      setResults(found);
      setSelectedMovieId(found[0]?.id ?? "");
      if (found.length === 0) {
        setFeedback("No encontramos coincidencias.");
      }
    } catch {
      setResults([]);
      setSelectedMovieId("");
      setFeedback("No se pudo completar la búsqueda.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedMovie) {
      setFeedback("Selecciona una película antes de confirmar.");
      return;
    }

    try {
      setSaving(true);
      setFeedback("");
      await setFavoriteMovie(slot, selectedMovie.id);
      await onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setFeedback("Esta película ya está ocupando otro slot.");
      } else {
        setFeedback("No se pudo guardar la favorita. Inténtalo de nuevo.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-zinc-950/95 p-4 shadow-[0_28px_55px_rgba(0,0,0,0.6)]">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-zinc-100">¿Cuál es tu Película Favorita {slot}?</h3>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, director o cast"
            className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-300/70 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm text-zinc-100 transition hover:border-white/45 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>

        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/10 bg-zinc-900/60 p-2">
          {loading ? <p className="p-2 text-sm text-zinc-400">Cargando resultados…</p> : null}
          {!loading && results.length > 0
            ? results.map((movie) => {
                const isSelected = movie.id === selectedMovieId;

                return (
                  <button
                    key={movie.id}
                    type="button"
                    onClick={() => setSelectedMovieId(movie.id)}
                    className={`mb-2 w-full rounded-lg border px-3 py-2 text-left transition last:mb-0 ${
                      isSelected
                        ? "border-blue-300/60 bg-blue-400/10 text-zinc-100"
                        : "border-white/10 bg-zinc-900 text-zinc-300 hover:border-white/30"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">{movie.title}</p>
                    <p className="text-xs text-zinc-500">
                      {movie.year} · {movie.genre} · {movie.type}
                    </p>
                  </button>
                );
              })
            : null}
          {!loading && results.length === 0 && !feedback ? <p className="p-2 text-sm text-zinc-500">Busca para ver resultados.</p> : null}
        </div>

        {feedback ? <p className="mt-2 text-xs text-zinc-400">{feedback}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/40 hover:text-zinc-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !selectedMovie}
            className="rounded-xl border border-blue-300/50 bg-blue-500/10 px-4 py-2 text-sm text-blue-100 transition hover:border-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Aceptar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FavoriteMoviesBlock() {
  const [favorites, setFavorites] = useState<FavoriteMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const loadFavorites = async () => {
    try {
      setError("");
      const payload = await getFavoriteMovies();
      setFavorites(payload);
    } catch {
      setError("No se pudieron cargar tus favoritas.");
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFavorites();
  }, []);

  const slots = [1, 2, 3].map((slot) => favorites.find((movie) => movie.slot === slot));

  const handleUpdateMovieRating = (movieId: string, score: number | null) => {
    setFavorites((current) =>
      current.map((favorite) => (String(favorite.id) === String(movieId) ? { ...favorite, myRating: score } : favorite)),
    );
  };

  return (
    <section className="rounded-3xl border border-white/15 bg-zinc-950/65 p-6 shadow-[0_24px_45px_rgba(0,0,0,0.38)]">
      {loading ? <p className="text-sm text-zinc-400">Cargando favoritas...</p> : null}
      {!loading && error ? <p className="mb-3 text-xs text-zinc-400">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {slots.map((movie, index) => (
          <FavoriteMovieItem
            key={movie?.id ?? `placeholder-${index}`}
            slot={index + 1}
            movie={movie}
            onOpenSearch={setActiveSlot}
            onUpdateMovieRating={handleUpdateMovieRating}
          />
        ))}
      </div>

      <FavoriteSearchModal
        slot={activeSlot ?? 1}
        open={activeSlot !== null}
        onClose={() => setActiveSlot(null)}
        onSaved={loadFavorites}
      />
    </section>
  );
}
