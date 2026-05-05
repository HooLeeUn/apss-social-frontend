"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { Movie, normalizeMovie } from "../lib/movies";

interface SearchBarProps {
  initialQuery?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  showSearchIcon?: boolean;
  inlineAutocomplete?: boolean;
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
  const [isOpen, setIsOpen] = useState(false);

  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
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

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    if (trimmedQuery.length < 2) {
      requestIdRef.current += 1;
      setResults([]);
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
      const endpoint = `/movies/?${new URLSearchParams({ search: trimmedQuery, page: "1", page_size: "10" }).toString()}`;

      void apiFetch(endpoint, { signal: requestController.signal })
        .then((payload) => {
          if (requestIdRef.current !== currentRequestId || requestController?.signal.aborted) return;

          const rawResults =
            typeof payload === "object" && payload !== null && "results" in payload && Array.isArray((payload as { results?: unknown }).results)
              ? ((payload as { results: unknown[] }).results as Record<string, unknown>[])
              : [];

          const parsed = rawResults
            .filter((movie): movie is Record<string, unknown> => typeof movie === "object" && movie !== null)
            .map((movie, index) => normalizeMovie(movie, index))
            .slice(0, 10);

          setResults(parsed);
          setIsOpen(true);
        })
        .catch((error) => {
          if (requestIdRef.current !== currentRequestId || requestController?.signal.aborted) return;
          if (error instanceof DOMException && error.name === "AbortError") return;

          setResults([]);
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
          <div className="max-h-[336px] overflow-y-auto overscroll-contain py-1">
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
                    <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] text-zinc-500">Sin póster</div>
                  )}
                </div>
                <div className="min-w-0 text-xs text-zinc-200">
                  <p className="line-clamp-2 min-w-0 break-words font-semibold leading-snug text-zinc-100">{movie.titleSpanish ?? "-"}</p>
                  <p className="line-clamp-2 min-w-0 break-words leading-snug text-zinc-400">{movie.titleEnglish ?? "-"}</p>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">{movie.year || "-"}</p>
                </div>
                <div className="min-w-0 text-[11px] leading-snug text-zinc-300">
                  <p className="truncate font-medium text-zinc-200">{movie.contentType || "-"}</p>
                  <p className="truncate text-zinc-500">{movie.genres.length ? movie.genres.join(", ") : "-"}</p>
                </div>
                <div className="min-w-0 text-[11px] leading-snug text-zinc-300">
                  <p className="truncate">Dir: {movie.director ?? "-"}</p>
                  <p className="truncate text-zinc-500">Cast: {movie.castMembers.length ? movie.castMembers.join(", ") : "-"}</p>
                </div>
              </button>
            ))}
            {isLoading ? <p className="px-3 py-3 text-xs text-zinc-400">Buscando...</p> : null}
            {!isLoading && results.length === 0 ? <p className="px-3 py-3 text-xs text-zinc-400">Sin coincidencias.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
