"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GenreChips from "../../components/GenreChips";
import MovieCard from "../../components/MovieCard";
import SearchBar from "../../components/SearchBar";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { filterMoviesByGenre, Movie, parseMovieList, SEARCH_ENDPOINT } from "../../lib/movies";

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const query = searchParams.get("q")?.trim() || "";
  const [selectedGenre, setSelectedGenre] = useState("Todos");

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/");
      return;
    }

    if (!query) {
      setMovies([]);
      setError("");
      return;
    }

    const loadSearch = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ q: query });
        const payload = await apiFetch(`${SEARCH_ENDPOINT}?${params.toString()}`);
        setMovies(parseMovieList(payload));
      } catch (searchError) {
        console.error(searchError);
        setError("No se pudo completar la búsqueda.");
      } finally {
        setLoading(false);
      }
    };

    loadSearch();
  }, [query, router]);

  const genres = useMemo(
    () => Array.from(new Set(movies.flatMap((movie) => movie.genres))).sort((a, b) => a.localeCompare(b)),
    [movies],
  );

  const filteredMovies = useMemo(
    () => filterMoviesByGenre(movies, selectedGenre),
    [movies, selectedGenre],
  );

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">Resultados de búsqueda</h1>
        <SearchBar initialQuery={query} />
        <GenreChips
          genres={genres}
          selectedGenre={selectedGenre}
          onSelectGenre={(genre) => setSelectedGenre(genre)}
        />
      </header>

      {!query && <p className="text-gray-600">Escribe un término para buscar películas.</p>}
      {loading && <p>Cargando resultados...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && query && filteredMovies.length === 0 && (
        <p className="text-gray-600">No se encontraron resultados para &quot;{query}&quot;.</p>
      )}

      {!loading && !error && filteredMovies.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}
    </main>
  );
}
