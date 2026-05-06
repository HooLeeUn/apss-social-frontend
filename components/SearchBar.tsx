"use client";

import { FormEvent, UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, apiFetch } from "../lib/api";
import { Movie, normalizeNextEndpoint, parseMovieList, parseMoviePagination } from "../lib/movies";

const AUTOCOMPLETE_LIMIT = 10;
const AUTOCOMPLETE_SCROLL_THRESHOLD_PX = 96;

interface SearchBarProps {
  initialQuery?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  showSearchIcon?: boolean;
  inlineAutocomplete?: boolean;
}

function buildAutocompleteEndpoint(query: string, page: number): string {
  return `/movies/?${new URLSearchParams({
    autocomplete: "true",
    q: query,
    limit: String(AUTOCOMPLETE_LIMIT),
    page: String(page),
  }).toString()}`;
}

function collectUniqueMovies(movies: Movie[], seenIds: Set<string>): Movie[] {
  return movies.filter((movie) => {
    const id = String(movie.id);
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
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
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [nextEndpoint, setNextEndpoint] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [canLoadMore, setCanLoadMore] = useState(false);

  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadMoreAbortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const resultIdsRef = useRef<Set<string>>(new Set());

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

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    loadMoreAbortControllerRef.current?.abort();
    loadMoreAbortControllerRef.current = null;
    resultIdsRef.current = new Set();
    setResults([]);
    setNextEndpoint(null);
    setCurrentPage(1);
    setCanLoadMore(false);
    setIsLoadingMore(false);

    if (trimmedQuery.length < 2) {
      requestIdRef.current += 1;
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    let requestController: AbortController | null = null;

    debounceTimeoutRef.current = window.setTimeout(() => {
      requestController = new AbortController();
      abortControllerRef.current = requestController;
      const endpoint = buildAutocompleteEndpoint(trimmedQuery, 1);

      void apiFetch(endpoint, { signal: requestController.signal })
        .then((payload) => {
          if (requestIdRef.current !== currentRequestId || requestController?.signal.aborted) return;

          const parsed = parseMovieList(payload);
          const pagination = parseMoviePagination(payload);

          resultIdsRef.current = new Set(parsed.map((movie) => String(movie.id)));
          setResults(parsed);
          setNextEndpoint(pagination.next);
          setCurrentPage(1);
          setCanLoadMore(Boolean(pagination.next) || parsed.length >= AUTOCOMPLETE_LIMIT);
          setIsOpen(true);
        })
        .catch((error) => {
          if (requestIdRef.current !== currentRequestId || requestController?.signal.aborted) return;
          if (error instanceof DOMException && error.name === "AbortError") return;

          resultIdsRef.current = new Set();
          setResults([]);
          setNextEndpoint(null);
          setCanLoadMore(false);
          setIsOpen(true);
        })
        .finally(() => {
          if (requestIdRef.current === currentRequestId && abortControllerRef.current === requestController) {
            abortControllerRef.current = null;
            setIsLoading(false);
          }
        });
    }, 250);

    return () => {
      if (debounceTimeoutRef.current) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
      requestController?.abort();
    };
  }, [inlineAutocomplete, trimmedQuery]);


  const loadMoreResults = useCallback(() => {
    if (!inlineAutocomplete || !canLoadMore || isLoading || isLoadingMore || trimmedQuery.length < 2) return;

    const requestId = requestIdRef.current;
    const requestQuery = trimmedQuery;
    const nextPage = currentPage + 1;
    const endpoint = nextEndpoint ? normalizeNextEndpoint(nextEndpoint, API_BASE_URL) : buildAutocompleteEndpoint(requestQuery, nextPage);
    const requestController = new AbortController();

    loadMoreAbortControllerRef.current?.abort();
    loadMoreAbortControllerRef.current = requestController;
    setIsLoadingMore(true);

    void apiFetch(endpoint, { signal: requestController.signal })
      .then((payload) => {
        if (requestIdRef.current !== requestId || trimmedQuery !== requestQuery || requestController.signal.aborted) return;

        const parsed = parseMovieList(payload);
        const pagination = parseMoviePagination(payload);

        const uniqueMovies = collectUniqueMovies(parsed, resultIdsRef.current);

        setResults((currentResults) => (uniqueMovies.length ? [...currentResults, ...uniqueMovies] : currentResults));
        setNextEndpoint(pagination.next);
        setCurrentPage(nextPage);
        setCanLoadMore(Boolean(pagination.next) || (uniqueMovies.length > 0 && parsed.length >= AUTOCOMPLETE_LIMIT));
      })
      .catch((error) => {
        if (requestIdRef.current !== requestId || trimmedQuery !== requestQuery || requestController.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;

        setCanLoadMore(false);
      })
      .finally(() => {
        if (loadMoreAbortControllerRef.current === requestController) {
          loadMoreAbortControllerRef.current = null;
        }

        if (requestIdRef.current === requestId && trimmedQuery === requestQuery) {
          setIsLoadingMore(false);
        }
      });
  }, [canLoadMore, currentPage, inlineAutocomplete, isLoading, isLoadingMore, nextEndpoint, trimmedQuery]);

  const handleResultsScroll = (event: UIEvent<HTMLDivElement>) => {
    const listbox = event.currentTarget;
    const distanceToBottom = listbox.scrollHeight - listbox.scrollTop - listbox.clientHeight;

    if (distanceToBottom <= AUTOCOMPLETE_SCROLL_THRESHOLD_PX) {
      loadMoreResults();
    }
  };

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

  const rootClassName = inlineAutocomplete ? `relative ${className ?? "w-full"}`.trim() : "relative w-full";
  const formClassName = inlineAutocomplete ? "flex w-full" : `flex w-full gap-2 ${className ?? ""}`.trim();

  return (
    <div ref={containerRef} className={rootClassName}>
      <form onSubmit={handleSubmit} className={formClassName}>
        <div className="relative min-w-0 flex-1">
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
            className={`w-full rounded-[999px] border border-gray-300 bg-white px-3 py-2 text-sm ${
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
        <div className="absolute left-0 right-0 top-full z-40 mt-2 w-full overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur">
          <div className="search-dropdown-scrollbar max-h-[336px] overflow-y-auto overscroll-contain py-1" onScroll={handleResultsScroll}>
            {results.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => handleMovieClick(movie.id)}
                className="grid w-full grid-cols-[44px_minmax(0,1.25fr)_minmax(0,0.78fr)_minmax(0,1fr)] items-start gap-2 border-b border-white/10 px-2.5 py-2 text-left transition last:border-b-0 hover:bg-white/10 focus:bg-white/10 focus:outline-none"
              >
                <div className="h-[62px] w-[44px] overflow-hidden rounded-md border border-white/15 bg-zinc-900">
                  {movie.posterUrl ? (
                    <img src={movie.posterUrl} alt={movie.displayTitle} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] leading-tight text-zinc-500">Sin póster</div>
                  )}
                </div>
                <div className="min-w-0 text-xs text-zinc-200">
                  <p className="line-clamp-2 min-w-0 break-words bg-gradient-to-r from-sky-100 via-blue-300 to-slate-300 bg-clip-text font-semibold leading-snug text-transparent">
                    {movie.titleSpanish ?? "-"}
                  </p>
                  <p className="truncate text-[11px] leading-snug text-zinc-400">{movie.titleEnglish ?? "-"}</p>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">{movie.year || "-"}</p>
                </div>
                <div className="min-w-0 text-[11px] leading-snug text-zinc-300">
                  <p className="truncate font-medium text-zinc-200">{movie.contentType || "-"}</p>
                  <p className="truncate text-zinc-500">{movie.genres.length ? movie.genres.join(", ") : "-"}</p>
                </div>
                <div className="min-w-0 text-[11px] leading-snug text-zinc-300">
                  <p className="truncate text-zinc-400">
                    <span className="font-medium text-blue-300">Dir:</span> {movie.director ?? "-"}
                  </p>
                  <p className="line-clamp-3 break-words text-zinc-500">
                    <span className="font-medium text-blue-300">Cast:</span> {movie.castMembers.length ? movie.castMembers.join(", ") : "-"}
                  </p>
                </div>
              </button>
            ))}
            {isLoading && results.length === 0 ? <p className="px-3 py-3 text-xs text-zinc-400">Buscando...</p> : null}
            {isLoadingMore ? <p className="px-3 py-2 text-center text-[11px] text-zinc-500">Cargando más...</p> : null}
            {!isLoading && results.length === 0 ? <p className="px-3 py-3 text-xs text-zinc-400">Sin coincidencias.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
