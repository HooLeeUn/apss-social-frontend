"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, ApiError, apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
import GenreChips from "../../components/GenreChips";
import MovieCard from "../../components/MovieCard";
import SearchBar from "../../components/SearchBar";
import WeeklyRecommendationsSection from "../../components/WeeklyRecommendationsSection";
import { FEED_GENRE_OPTIONS, movieMatchesSelectedGenres } from "../../lib/genres";
import {
  Movie,
  MOVIES_FEED_ENDPOINT,
  WEEKLY_MOVIES_FEED_ENDPOINT,
  parseMovieList,
  parseMoviePagination,
  normalizeNextEndpoint,
} from "../../lib/movies";

function mergeUniqueMovies(existing: Movie[], incoming: Movie[]): Movie[] {
  const merged = [...existing];
  const seenIds = new Set(existing.map((movie) => String(movie.id)));

  for (const movie of incoming) {
    const movieId = String(movie.id);
    if (!seenIds.has(movieId)) {
      seenIds.add(movieId);
      merged.push(movie);
    }
  }

  return merged;
}

const MAX_SELECTED_GENRES = 3;

export default function FeedPage() {
  const router = useRouter();

  const [weeklyMovies, setWeeklyMovies] = useState<Movie[]>([]);
  const [personalizedMovies, setPersonalizedMovies] = useState<Movie[]>([]);
  const [personalizedNext, setPersonalizedNext] = useState<string | null>(null);
  const [isLoadingMorePersonalized, setIsLoadingMorePersonalized] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const loadFeed = async () => {
      try {
        const [weeklyResult, personalizedResult] = await Promise.all([
          apiFetch(WEEKLY_MOVIES_FEED_ENDPOINT).then(
            (payload) => ({ ok: true as const, payload }),
            (error) => ({ ok: false as const, error }),
          ),
          apiFetch(MOVIES_FEED_ENDPOINT).then(
            (payload) => ({ ok: true as const, payload }),
            (error) => ({ ok: false as const, error }),
          ),
        ]);

        if (!weeklyResult.ok && weeklyResult.error instanceof ApiError && weeklyResult.error.status === 401) {
          router.replace("/login");
          return;
        }

        if (
          !personalizedResult.ok &&
          personalizedResult.error instanceof ApiError &&
          personalizedResult.error.status === 401
        ) {
          router.replace("/login");
          return;
        }

        if (
          !weeklyResult.ok &&
          !(weeklyResult.error instanceof ApiError && [404, 405].includes(weeklyResult.error.status))
        ) {
          throw weeklyResult.error;
        }

        if (
          !personalizedResult.ok &&
          !(personalizedResult.error instanceof ApiError && [404, 405].includes(personalizedResult.error.status))
        ) {
          throw personalizedResult.error;
        }

        const normalizedWeekly = weeklyResult.ok ? parseMovieList(weeklyResult.payload, { debugWeekly: true }) : [];
        const normalizedPersonalized = personalizedResult.ok ? parseMovieList(personalizedResult.payload) : [];
        const personalizedPagination = personalizedResult.ok
          ? parseMoviePagination(personalizedResult.payload)
          : { next: null };

        setWeeklyMovies(normalizedWeekly);
        setPersonalizedMovies(normalizedPersonalized);
        setPersonalizedNext(personalizedPagination.next);
      } catch (loadError) {
        console.error("Feed load error:", loadError);

        if (loadError instanceof ApiError && loadError.status === 401) {
          router.replace("/login");
          return;
        }

        setError("No se pudo cargar el feed de películas.");
      } finally {
        setLoading(false);
      }
    };

    loadFeed();
  }, [router]);

  const loadMorePersonalized = useCallback(async () => {
    if (!personalizedNext || isLoadingMorePersonalized) return;

    try {
      setIsLoadingMorePersonalized(true);
      const payload = await apiFetch(normalizeNextEndpoint(personalizedNext, API_BASE_URL));
      const nextPageMovies = parseMovieList(payload);
      const pagination = parseMoviePagination(payload);

      setPersonalizedMovies((current) => mergeUniqueMovies(current, nextPageMovies));
      setPersonalizedNext(pagination.next);
    } catch (loadMoreError) {
      console.error("Personalized pagination load error:", loadMoreError);
    } finally {
      setIsLoadingMorePersonalized(false);
    }
  }, [isLoadingMorePersonalized, personalizedNext]);

  useEffect(() => {
    const node = loadMoreTriggerRef.current;
    if (!node || !personalizedNext) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          void loadMorePersonalized();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [loadMorePersonalized, personalizedNext]);

  const toggleGenreSelection = (genre: string) => {
    setSelectedGenres((current) => {
      if (current.includes(genre)) {
        return current.filter((item) => item !== genre);
      }

      if (current.length >= MAX_SELECTED_GENRES) {
        return current;
      }

      return [...current, genre];
    });
  };

  const filteredPersonalizedMovies = useMemo(
    () =>
      personalizedMovies.filter((movie) => movieMatchesSelectedGenres(movie.genres, selectedGenres)),
    [personalizedMovies, selectedGenres],
  );

  const shouldDisableGenreChip = useCallback(
    (genre: string) => selectedGenres.length >= MAX_SELECTED_GENRES && !selectedGenres.includes(genre),
    [selectedGenres],
  );

  const updateWeeklyMovieRating = useCallback((movieId: Movie["id"], score: number) => {
    setWeeklyMovies((current) =>
      current.map((movie) => (String(movie.id) === String(movieId) ? { ...movie, myRating: score } : movie)),
    );
  }, []);

  const handlePersonalizedRated = useCallback((movieId: Movie["id"]) => {
    setPersonalizedMovies((current) => current.filter((movie) => String(movie.id) !== String(movieId)));
  }, []);

  if (loading) {
    return <div className="p-6 text-zinc-100">Cargando feed principal...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-400">{error}</div>;
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-[1400px] space-y-14 px-4 py-8 md:px-8">
        <section className="space-y-5">
          <div className="sticky top-0 z-30 -mx-2 space-y-5 rounded-3xl border border-white/10 bg-black/80 px-2 py-3 backdrop-blur-md md:mx-0 md:px-0">
          <SearchBar
            className="mx-auto w-full max-w-2xl gap-0 rounded-full border-2 border-white/70 bg-zinc-900/80 p-1.5"
            inputClassName="rounded-l-full rounded-r-none border-2 border-white/60 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
            buttonClassName="rounded-l-none rounded-r-full border-2 border-l-0 border-white/60 bg-zinc-100 px-6 text-zinc-900 hover:bg-zinc-300"
            showSearchIcon
          />

          <GenreChips
            genres={FEED_GENRE_OPTIONS}
            selectedGenres={selectedGenres}
            onToggleGenre={toggleGenreSelection}
            onClearSelection={() => setSelectedGenres([])}
            showAllChip={selectedGenres.length > 0}
            className="justify-center"
            chipsContainerClassName="w-auto flex-initial justify-center overflow-visible"
            chipClassName="border-2"
            selectedChipClassName="border-blue-300/90 bg-gradient-to-b from-blue-300/25 to-blue-600/40 text-blue-50 shadow-[0_4px_14px_rgba(56,189,248,0.35)]"
            unselectedChipClassName="border-white/70 bg-zinc-900 text-zinc-200 hover:border-white"
            disabledChipClassName="border-zinc-700 bg-zinc-900/80 text-zinc-500"
            isGenreDisabled={shouldDisableGenreChip}
          />
          </div>

          <WeeklyRecommendationsSection weeklyMovies={weeklyMovies} onRated={updateWeeklyMovieRating} />
        </section>

        <section className="space-y-5 bg-black pb-8">
          <div className="mx-auto w-full max-w-[860px] px-3 sm:px-4">
            <h2 className="text-xl font-semibold text-zinc-100">Tu Cartelera</h2>
          </div>
          {filteredPersonalizedMovies.length === 0 ? (
            <p className="pl-3 text-zinc-400 md:pl-6">No hay películas personalizadas disponibles.</p>
          ) : (
            <div className="mx-auto w-full max-w-[860px] rounded-2xl bg-zinc-950/45 px-3 py-3 sm:px-4 sm:py-4">
              <div className="grid gap-3 md:grid-cols-2">
              {filteredPersonalizedMovies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  variant="feed"
                  onRated={(movieId) => handlePersonalizedRated(movieId)}
                />
              ))}
              </div>
            </div>
          )}
          {personalizedNext ? (
            <div ref={loadMoreTriggerRef} className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void loadMorePersonalized()}
                disabled={isLoadingMorePersonalized}
                className="rounded-full border-2 border-white/70 px-5 py-2 text-sm font-medium text-zinc-100 disabled:opacity-50"
              >
                {isLoadingMorePersonalized ? "Cargando..." : "Cargar más"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
