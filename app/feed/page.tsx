"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, ApiError, apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
import GenreChips from "../../components/GenreChips";
import MovieCard from "../../components/MovieCard";
import SearchBar from "../../components/SearchBar";
import { FEED_GENRE_OPTIONS } from "../../lib/genres";
import {
  Movie,
  MOVIES_FEED_ENDPOINT,
  WEEKLY_MOVIES_FEED_ENDPOINT,
  parseMovieList,
  parseMoviePagination,
} from "../../lib/movies";

function normalizeNextEndpoint(nextUrl: string): string {
  if (nextUrl.startsWith("http://") || nextUrl.startsWith("https://")) {
    const { pathname, search } = new URL(nextUrl);
    const normalizedPath = pathname.startsWith("/api/") ? pathname.replace(/^\/api/, "") : pathname;
    return `${normalizedPath}${search}`;
  }

  if (nextUrl.startsWith("/api/")) {
    return nextUrl.replace(/^\/api/, "");
  }

  if (nextUrl.startsWith("/")) {
    return nextUrl;
  }

  const basePath = new URL(API_BASE_URL).pathname.replace(/\/$/, "");
  return `${basePath ? `${basePath}/` : "/"}${nextUrl}`;
}

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

        const normalizedWeekly = weeklyResult.ok ? parseMovieList(weeklyResult.payload) : [];
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
      const payload = await apiFetch(normalizeNextEndpoint(personalizedNext));
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

  const highlightedWeekly = weeklyMovies.slice(0, 2);
  const compactWeekly = weeklyMovies.slice(2, 8);

  const toggleGenreSelection = (genre: string) => {
    setSelectedGenres((current) =>
      current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre],
    );
  };

  if (loading) {
    return <div className="p-6">Cargando feed principal...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-8">
      <header className="space-y-4">
        <h1 className="text-2xl font-bold">Feed principal</h1>
        <SearchBar />
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Recomendaciones de la semana</h2>
        {weeklyMovies.length === 0 ? (
          <p className="text-gray-600">No hay recomendaciones semanales disponibles.</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {highlightedWeekly.map((movie) => (
                <MovieCard key={movie.id} movie={movie} variant="large" />
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {compactWeekly.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Géneros</p>
          <GenreChips
            genres={FEED_GENRE_OPTIONS}
            selectedGenres={selectedGenres}
            onToggleGenre={toggleGenreSelection}
            onClearSelection={() => setSelectedGenres([])}
            showAllChip={selectedGenres.length > 0}
            actionLabel="Ver"
          />
        </div>

        <h2 className="text-xl font-semibold">Personalizado para ti</h2>
        {personalizedMovies.length === 0 ? (
          <p className="text-gray-600">No hay películas personalizadas disponibles.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {personalizedMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}
        {personalizedNext ? (
          <div ref={loadMoreTriggerRef} className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => void loadMorePersonalized()}
              disabled={isLoadingMorePersonalized}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {isLoadingMorePersonalized ? "Cargando..." : "Cargar más"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
