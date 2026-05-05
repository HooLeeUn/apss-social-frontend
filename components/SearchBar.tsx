"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { Movie, normalizeMovie, parseMoviePagination } from "../lib/movies";

interface SearchBarProps {
  initialQuery?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  showSearchIcon?: boolean;
  inlineAutocomplete?: boolean;
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

export default function SearchBar({
  initialQuery = "",
  className,
  inputClassName,
  buttonClassName,
  showSearchIcon = false,
  inlineAutocomplete = false,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Movie[]>([]);
  const [nextEndpoint, setNextEndpoint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!inlineAutocomplete) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [inlineAutocomplete]);

  useEffect(() => {
    if (!inlineAutocomplete) return;

    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
    }

    if (trimmedQuery.length < 2) {
      setResults([]);
      setNextEndpoint(null);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    debounceTimeoutRef.current = window.setTimeout(() => {
      const endpoint = `/movies/?${new URLSearchParams({ search: trimmedQuery, page: "1" }).toString()}`;

      void apiFetch(endpoint)
        .then((payload) => {
          if (requestIdRef.current !== currentRequestId) return;

          const rawResults =
            typeof payload === "object" && payload !== null && "results" in payload && Array.isArray((payload as { results?: unknown }).results)
              ? ((payload as { results: unknown[] }).results as Record<string, unknown>[])
              : [];

          const parsed = rawResults
            .filter((movie): movie is Record<string, unknown> => typeof movie === "object" && movie !== null)
            .map((movie, index) => normalizeMovie(movie, index));

          const pagination = parseMoviePagination(payload);
          setResults(parsed);
          setNextEndpoint(pagination.next);
          setIsOpen(true);
        })
        .catch(() => {
          if (requestIdRef.current !== currentRequestId) return;
          setResults([]);
          setNextEndpoint(null);
          setIsOpen(true);
        })
        .finally(() => {
          if (requestIdRef.current === currentRequestId) {
            setIsLoading(false);
          }
        });
    }, 350);

    return () => {
      if (debounceTimeoutRef.current) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [inlineAutocomplete, trimmedQuery]);

  useEffect(() => {
    if (!inlineAutocomplete || !isOpen || !nextEndpoint || !loadMoreRef.current) return;

    const node = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || isLoadingMore) return;

        setIsLoadingMore(true);
        void apiFetch(nextEndpoint)
          .then((payload) => {
            const rawResults =
              typeof payload === "object" && payload !== null && "results" in payload && Array.isArray((payload as { results?: unknown }).results)
                ? ((payload as { results: unknown[] }).results as Record<string, unknown>[])
                : [];

            const parsed = rawResults
              .filter((movie): movie is Record<string, unknown> => typeof movie === "object" && movie !== null)
              .map((movie, index) => normalizeMovie(movie, index));

            const pagination = parseMoviePagination(payload);
            setResults((current) => mergeUniqueMovies(current, parsed));
            setNextEndpoint(pagination.next);
          })
          .finally(() => setIsLoadingMore(false));
      },
      { rootMargin: "100px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [inlineAutocomplete, isOpen, nextEndpoint, isLoadingMore]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inlineAutocomplete) return;

    const trimmed = query.trim();

    if (!trimmed) {
      router.push("/search");
      return;
    }

    const params = new URLSearchParams({ q: trimmed });
    router.push(`/search?${params.toString()}`);
  };

  const handleMovieClick = (movieId: Movie["id"]) => {
    setIsOpen(false);
    router.push(`/movies/${movieId}`);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className={`flex w-full gap-2 ${className ?? ""}`.trim()}>
        <div className="relative flex-1">
          {showSearchIcon ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          ) : null}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (inlineAutocomplete && trimmedQuery.length >= 2) setIsOpen(true);
            }}
            placeholder="Buscar películas, género o año"
            className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ${
              showSearchIcon ? "pl-10" : ""
            } ${inputClassName ?? ""}`.trim()}
          />
        </div>
        {!inlineAutocomplete ? (
          <button
            type="submit"
            className={`rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 ${buttonClassName ?? ""}`.trim()}
          >
            Buscar
          </button>
        ) : null}
      </form>

      {inlineAutocomplete && isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-white/20 bg-zinc-950/95 shadow-2xl">
          <div className="max-h-[380px] overflow-y-auto">
            {results.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => handleMovieClick(movie.id)}
                className="grid w-full grid-cols-[52px_1.4fr_1fr_1fr] gap-3 border-b border-white/10 px-3 py-2 text-left transition hover:bg-zinc-800"
              >
                <div className="h-[72px] w-[52px] overflow-hidden rounded-md border border-white/15 bg-zinc-900">
                  {movie.posterUrl ? (
                    <img src={movie.posterUrl} alt={movie.displayTitle} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">Sin póster</div>
                  )}
                </div>
                <div className="min-w-0 text-xs text-zinc-200">
                  <p className="truncate font-semibold text-zinc-100">{movie.titleSpanish ?? "-"}</p>
                  <p className="truncate text-zinc-400">{movie.titleEnglish ?? "-"}</p>
                  <p className="text-zinc-500">{movie.year || "-"}</p>
                </div>
                <div className="min-w-0 text-xs text-zinc-300">
                  <p className="truncate">{movie.contentType || "-"}</p>
                  <p className="truncate text-zinc-500">{movie.genres.length ? movie.genres.join(", ") : "-"}</p>
                </div>
                <div className="min-w-0 text-xs text-zinc-300">
                  <p className="truncate">Dir: {movie.director ?? "-"}</p>
                  <p className="truncate text-zinc-500">Cast: {movie.castMembers.length ? movie.castMembers.join(", ") : "-"}</p>
                </div>
              </button>
            ))}
            {isLoading ? <p className="px-3 py-3 text-xs text-zinc-400">Buscando...</p> : null}
            {!isLoading && results.length === 0 ? <p className="px-3 py-3 text-xs text-zinc-400">Sin coincidencias.</p> : null}
            {nextEndpoint ? <div ref={loadMoreRef} className="h-6 w-full" /> : null}
            {isLoadingMore ? <p className="px-3 pb-3 text-xs text-zinc-500">Cargando más...</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
