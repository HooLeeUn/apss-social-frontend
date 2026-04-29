"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GenreChips from "../../components/GenreChips";
import MovieCard from "../../components/MovieCard";
import SearchBar from "../../components/SearchBar";
import { ApiError, apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { FEED_GENRE_OPTIONS } from "../../lib/genres";
import { Movie, normalizeMovie, PaginatedResponse, parseMoviePagination } from "../../lib/movies";

type SearchMoviePayload = Record<string, unknown>;

function hasSearchResults(payload: unknown): payload is PaginatedResponse<SearchMoviePayload> {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "results" in payload &&
    Array.isArray((payload as { results?: unknown }).results)
  );
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

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const query = searchParams.get("q")?.trim() || "";
  const genre = searchParams.get("genre")?.trim() || "";
  const pageFromUrl = Number(searchParams.get("page") ?? "1");
  const targetPage = Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1;

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const selectedGenres = useMemo(() => (genre ? [genre] : []), [genre]);

  const updateParams = (nextParams: Record<string, string | null>, replace = false) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(nextParams).forEach(([key, value]) => {
      if (value === null || value.trim() === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const nextRoute = params.toString() ? `/search?${params.toString()}` : "/search";

    if (replace) {
      router.replace(nextRoute);
      return;
    }

    router.push(nextRoute);
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!query) {
      setMovies([]);
      setHasMore(false);
      setError("");
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const loadSearch = async () => {
      setLoading(true);
      setError("");

      try {
        let currentPage = 1;
        let nextPageEndpoint: string | null = null;
        let accumulatedMovies: Movie[] = [];

        while (currentPage <= targetPage) {
          const endpoint = `/movies/?${new URLSearchParams({
            search: query,
            page: String(currentPage),
            ...(genre ? { genre } : {}),
          }).toString()}`;

          console.log("query:", query);
          const data: unknown = await apiFetch(endpoint);
          console.log("response:", data);

          const rawResults: SearchMoviePayload[] = hasSearchResults(data) ? data.results : [];

          const parsedMovies = rawResults
            .filter((movie: SearchMoviePayload): movie is SearchMoviePayload => typeof movie === "object" && movie !== null)
            .map((movie: SearchMoviePayload, index: number) => normalizeMovie(movie, index));

          const pagination = parseMoviePagination(data);
          accumulatedMovies = mergeUniqueMovies(accumulatedMovies, parsedMovies);
          nextPageEndpoint = pagination.next;

          if (!nextPageEndpoint) {
            break;
          }

          currentPage += 1;
        }

        setMovies(accumulatedMovies);
        setHasMore(Boolean(nextPageEndpoint));
      } catch (searchError) {
        console.error("Search load error:", searchError);

        if (searchError instanceof ApiError && searchError.status === 401) {
          router.replace("/login");
          return;
        }

        setMovies([]);
        setHasMore(false);
        setError("No se pudo completar la búsqueda. Inténtalo de nuevo.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };

    void loadSearch();
  }, [genre, query, router, targetPage]);

  const handleToggleGenre = (nextGenre: string) => {
    const isSameGenre = nextGenre === genre;

    updateParams({
      genre: isSameGenre ? null : nextGenre,
      page: "1",
    });
  };

  const handleClearGenre = () => {
    updateParams({ genre: null, page: "1" });
  };

  const handleLoadMore = () => {
    setLoadingMore(true);
    updateParams({ page: String(targetPage + 1) });
  };

  const hasResults = movies.length > 0;

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-8 md:px-8">
        <header className="space-y-4">
          <div className="flex justify-start">
            <Link
              href="/feed"
              className="inline-flex items-center rounded-full border-2 border-white/60 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-white"
            >
              Volver al feed
            </Link>
          </div>

          <SearchBar
            initialQuery={query}
            className="mx-auto w-full max-w-2xl gap-0 rounded-full border-2 border-white/70 bg-zinc-900/80 p-1.5"
            inputClassName="rounded-l-full rounded-r-none border-2 border-white/60 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
            buttonClassName="rounded-l-none rounded-r-full border-2 border-l-0 border-white/60 bg-zinc-100 px-6 text-zinc-900 hover:bg-zinc-300"
            showSearchIcon
          />

          <GenreChips
            genres={FEED_GENRE_OPTIONS}
            selectedGenres={selectedGenres}
            onToggleGenre={handleToggleGenre}
            onClearSelection={handleClearGenre}
            showAllChip={selectedGenres.length > 0}
            className="justify-center"
            chipsContainerClassName="w-auto flex-initial justify-center overflow-visible"
            chipClassName="border-2"
            selectedChipClassName="border-white bg-zinc-950 text-zinc-100"
            unselectedChipClassName="border-white/70 bg-zinc-900 text-zinc-200 hover:border-white"
          />

          {query ? (
            <p className="text-center text-sm text-zinc-300 sm:text-base">
              Resultados para: <span className="font-semibold text-zinc-100">&ldquo;{query}&rdquo;</span>
            </p>
          ) : null}
        </header>

        {!query ? (
          <section className="mx-auto w-full max-w-[860px] rounded-2xl border border-white/15 bg-zinc-950/45 p-6 text-center">
            <p className="text-zinc-200">Escribe un término para buscar películas en el catálogo.</p>
          </section>
        ) : null}

        {loading ? (
          <section className="mx-auto w-full max-w-[860px] rounded-2xl border border-white/15 bg-zinc-950/45 p-6 text-center text-zinc-200">
            Cargando resultados...
          </section>
        ) : null}

        {!loading && error ? (
          <section className="mx-auto w-full max-w-[860px] rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-200">{error}</p>
          </section>
        ) : null}

        {!loading && !error && query && !hasResults ? (
          <section className="mx-auto w-full max-w-[860px] space-y-4 rounded-2xl border border-white/15 bg-zinc-950/45 p-6 text-center">
            <p className="text-zinc-100">No encontramos resultados para tu búsqueda.</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => updateParams({ q: null, page: null, genre: null })}
                className="rounded-full border-2 border-white/60 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-white"
              >
                Limpiar búsqueda
              </button>
              <Link
                href="/feed"
                className="rounded-full border-2 border-white/60 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-white"
              >
                Volver al feed
              </Link>
            </div>
          </section>
        ) : null}

        {!loading && !error && hasResults ? (
          <section className="space-y-5 bg-black pb-8">
            <div className="mx-auto w-full max-w-[860px] rounded-2xl bg-zinc-950/45 px-3 py-3 sm:px-4 sm:py-4">
              <div className="grid gap-3 md:grid-cols-2">
                {movies.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} variant="feed" enlargeInteractionIcons />
                ))}
              </div>
            </div>

            {hasMore ? (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="rounded-full border-2 border-white/70 px-5 py-2 text-sm font-medium text-zinc-100 disabled:opacity-50"
                >
                  {loadingMore ? "Cargando..." : "Cargar más"}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
