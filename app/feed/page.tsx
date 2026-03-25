"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
import GenreChips from "../../components/GenreChips";
import MovieCard from "../../components/MovieCard";
import SearchBar from "../../components/SearchBar";
import {
  filterMoviesByGenre,
  GENRES_ENDPOINT,
  Movie,
  MOVIES_FEED_ENDPOINT,
  parseGenres,
  parseMovieList,
} from "../../lib/movies";

export default function FeedPage() {
  const router = useRouter();

  const [weeklyMovies, setWeeklyMovies] = useState<Movie[]>([]);
  const [personalizedMovies, setPersonalizedMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<string[]>([]);

  const [selectedGenre, setSelectedGenre] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const loadFeed = async () => {
      try {
        const [feedPayload, genresPayload] = await Promise.all([
          apiFetch(MOVIES_FEED_ENDPOINT),
          apiFetch(GENRES_ENDPOINT).catch(() => []),
        ]);

        const normalizedFeed = parseMovieList(feedPayload);
        setWeeklyMovies(normalizedFeed.slice(0, 8));
        setPersonalizedMovies(normalizedFeed.slice(8));

        const genresFromEndpoint = parseGenres(genresPayload);

        if (genresFromEndpoint.length > 0) {
          setGenres(genresFromEndpoint);
          return;
        }

        const discoveredGenres = Array.from(new Set(normalizedFeed.flatMap((movie) => movie.genres)));
        setGenres(discoveredGenres);
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

  const filteredWeekly = useMemo(
    () => filterMoviesByGenre(weeklyMovies, selectedGenre),
    [weeklyMovies, selectedGenre],
  );
  const filteredPersonalized = useMemo(
    () => filterMoviesByGenre(personalizedMovies, selectedGenre),
    [personalizedMovies, selectedGenre],
  );

  const highlightedWeekly = filteredWeekly.slice(0, 2);
  const compactWeekly = filteredWeekly.slice(2, 8);

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
        <GenreChips
          genres={genres}
          selectedGenre={selectedGenre}
          onSelectGenre={(genre) => setSelectedGenre(genre)}
        />
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Recomendaciones de la semana</h2>
        {filteredWeekly.length === 0 ? (
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
        <h2 className="text-xl font-semibold">Personalizado para ti</h2>
        {filteredPersonalized.length === 0 ? (
          <p className="text-gray-600">No hay películas personalizadas disponibles.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPersonalized.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
