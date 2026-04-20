"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../lib/api";
import RatingPopover from "../RatingPopover";
import {
  getFavoriteMovies,
  getFavoriteMoviesByUsername,
  rateFavoriteMovie,
  searchFavoriteMovieCandidates,
  setFavoriteMovie,
} from "../../lib/profile-feed/adapters";
import { FavoriteMovie, FavoriteMovieSearchResult } from "../../lib/profile-feed/types";
import { formatAverageRating, formatFollowingRating, formatFollowingRatingsCount } from "../../lib/rating-format";

interface FavoriteMovieItemProps {
  movie?: FavoriteMovie;
  slot: number;
  readOnly: boolean;
  viewedUsername?: string;
  onOpenSearch: (slot: number) => void;
  onUpdateMovieRating: (movieId: string, score: number | null) => void;
}

interface FavoriteSearchModalProps {
  slot: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

interface FavoriteMoviesBlockProps {
  title?: string;
  readOnly?: boolean;
  viewedUsername?: string;
}

function FavoriteMovieItem({ movie, slot, readOnly, viewedUsername, onOpenSearch, onUpdateMovieRating }: FavoriteMovieItemProps) {
  const displayTitle = movie?.title || "";
  const displaySecondaryTitle = movie?.displaySecondaryTitle ?? null;
  const firstLetter = displayTitle.charAt(0)?.toUpperCase() ?? "—";
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
    <div className="group relative isolate h-[180px] overflow-visible">
      <article className="relative h-full overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/85 px-5 py-3.5 shadow-[0_16px_35px_rgba(0,0,0,0.3)] [clip-path:polygon(9%_0%,100%_0%,91%_100%,0%_100%)]">
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-blue-300/10 opacity-80" />
        <div className="relative flex h-full min-w-0 pr-10">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            {movie ? (
              <>
                <div className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)] items-center gap-3">
                  <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-zinc-900/80 text-xs font-semibold text-zinc-300 shadow-inner shadow-black/30">
                    <span className="text-lg">{firstLetter}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate whitespace-nowrap text-sm font-semibold leading-tight text-zinc-100">{displayTitle}</h3>
                    {displaySecondaryTitle ? (
                      <p className="truncate text-[11px] leading-tight text-blue-200/80">{displaySecondaryTitle}</p>
                    ) : null}
                    <div className="mt-1 flex min-w-0 flex-col justify-center gap-0.5 pr-1">
                      <p className="truncate text-sm leading-tight text-zinc-300">{movie.year}</p>
                      <p className="truncate text-sm leading-tight text-zinc-300">{movie.genre}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex items-end justify-between gap-1.5 pb-0.5">
                  <div className="inline-flex h-10 items-center gap-1 rounded-md border border-white/10 bg-zinc-900/70 px-2 py-1 text-sm font-semibold text-zinc-200" aria-label="General">
                    <span aria-hidden="true">⭐</span>
                    <span>{formatAverageRating(movie.generalRating)}</span>
                  </div>
                  <div className="inline-flex h-10 rounded-md border border-white/10 bg-zinc-900/70 px-2 py-1" aria-label="Seguidos">
                    <div className="flex flex-col justify-center leading-tight text-zinc-200">
                      <span className="whitespace-nowrap text-sm font-semibold">👥 {formatFollowingRating(movie.followingRating)}</span>
                      {formatFollowingRatingsCount(movie.followingRatingsCount) ? (
                        <span className="text-[9px] font-normal text-zinc-500/90">{formatFollowingRatingsCount(movie.followingRatingsCount)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="ml-1">
                    {readOnly ? (
                      <div
                        className="inline-flex h-10 items-center gap-1 rounded-md border border-white/10 bg-zinc-900/70 px-2 py-1 text-sm font-semibold text-zinc-200"
                        aria-label={viewedUsername ? `Calificación visible de ${viewedUsername}` : "Calificación visible"}
                      >
                        <span aria-hidden="true">🧑</span>
                        <span>{movie.myRating === null ? "—" : formatAverageRating(movie.myRating)}</span>
                      </div>
                    ) : (
                      <RatingPopover
                        movieId={movie.id}
                        currentRating={movie.myRating}
                        onOptimisticRate={handleOptimisticRate}
                        onRateError={handleRateError}
                        onRated={(score) => handleRated(score)}
                        submitRatingRequest={(score) => rateFavoriteMovie(movie.id, score)}
                        icon="🧑"
                        nullLabel="—"
                        ariaLabel="Mi calificación"
                        className="shrink-0"
                      />
                    )}
                  </div>
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

      {!readOnly ? (
        <button
          type="button"
          onClick={() => onOpenSearch(slot)}
          aria-label={`Asignar película favorita al slot ${slot}`}
          className="absolute right-0 top-1/2 z-10 inline-flex h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-blue-300/60 bg-zinc-900 text-blue-200 shadow-[0_8px_18px_rgba(56,189,248,0.22)] transition hover:border-blue-200 hover:text-blue-100"
        >
          <span className="text-xl leading-none">+</span>
        </button>
      ) : null}
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
                    <p className="truncate text-sm font-medium">{movie.displayTitle || movie.title}</p>
                    {movie.displaySecondaryTitle ? (
                      <p className="truncate text-[11px] text-blue-200/80">{movie.displaySecondaryTitle}</p>
                    ) : null}
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

export default function FavoriteMoviesBlock({
  title,
  readOnly = false,
  viewedUsername,
}: FavoriteMoviesBlockProps = {}) {
  const [favorites, setFavorites] = useState<FavoriteMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const normalizedViewedUsername = viewedUsername?.trim() || "";

  const loadFavorites = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      if (readOnly) {
        if (!normalizedViewedUsername) {
          setFavorites([]);
          setError("No se pudo resolver el usuario del perfil.");
          return;
        }

        const payload = await getFavoriteMoviesByUsername(normalizedViewedUsername);
        setFavorites(payload);
        return;
      }

      const payload = await getFavoriteMovies();
      setFavorites(payload);
    } catch {
      setError(readOnly ? "No se pudieron cargar sus favoritas." : "No se pudieron cargar tus favoritas.");
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, [normalizedViewedUsername, readOnly]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  const slots = [1, 2, 3].map((slot) => favorites.find((movie) => movie.slot === slot));

  const handleUpdateMovieRating = (movieId: string, score: number | null) => {
    setFavorites((current) =>
      current.map((favorite) => (String(favorite.id) === String(movieId) ? { ...favorite, myRating: score } : favorite)),
    );
  };

  return (
    <section className="rounded-3xl border border-white/15 bg-zinc-950/65 p-6 shadow-[0_24px_45px_rgba(0,0,0,0.38)]">
      {title ? <h2 className="mb-4 text-lg font-semibold text-zinc-100 md:text-left">{title}</h2> : null}
      {loading ? <p className="text-sm text-zinc-400">Cargando favoritas...</p> : null}
      {!loading && error ? <p className="mb-3 text-xs text-zinc-400">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {slots.map((movie, index) => (
          <FavoriteMovieItem
            key={movie?.id ?? `placeholder-${index}`}
            slot={index + 1}
            movie={movie}
            readOnly={readOnly}
            viewedUsername={viewedUsername}
            onOpenSearch={setActiveSlot}
            onUpdateMovieRating={handleUpdateMovieRating}
          />
        ))}
      </div>

      {!readOnly ? (
        <FavoriteSearchModal
          slot={activeSlot ?? 1}
          open={activeSlot !== null}
          onClose={() => setActiveSlot(null)}
          onSaved={loadFavorites}
        />
      ) : null}
    </section>
  );
}
