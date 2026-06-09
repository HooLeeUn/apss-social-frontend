"use client";

import Link from "next/link";
import { memo, UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL, apiFetch } from "../../lib/api";
import RatingPopover from "../RatingPopover";
import {
  getFavoriteMovies,
  getFavoriteMoviesByUsername,
  rateFavoriteMovie,
  setFavoriteMovie,
} from "../../lib/profile-feed/adapters";
import { FavoriteMovie } from "../../lib/profile-feed/types";
import { Movie, normalizeNextEndpoint, parseMovieList, parseMoviePagination } from "../../lib/movies";
import { formatAverageRating, formatFollowingRating } from "../../lib/rating-format";
import { useI18n } from "../../hooks/useI18n";
import { formatProfileFeedRatingsCount, interpolate, resolveMovieTitles, translateVisibleGenre } from "../../lib/i18n";

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
  const { locale, t } = useI18n();
  const resolvedTitles = readOnly && movie ? resolveMovieTitles(locale, movie.titleSpanish, movie.titleEnglish, movie.title) : null;
  const displayTitle = resolvedTitles?.primary || movie?.title || "";
  const displaySecondaryTitle = resolvedTitles?.secondary ?? movie?.displaySecondaryTitle ?? null;
  const displayGenre = readOnly ? translateVisibleGenre(locale, movie?.genre) : movie?.genre;
  const firstLetter = displayTitle.charAt(0)?.toUpperCase() ?? "—";
  const lastCommittedRatingRef = useRef<number | null>(movie?.myRating ?? null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const movieImage = movie?.image || movie?.posterUrl || null;

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
  const detailHref = movie ? `/movies/${encodeURIComponent(String(movie.id))}` : null;
  const readOnlyFollowingRating = readOnly ? (movie?.visitedFollowingAvgRating ?? movie?.followingRating ?? null) : movie?.followingRating ?? null;
  const readOnlyFollowingRatingsCount = readOnly
    ? (movie?.visitedFollowingRatingsCount ?? movie?.followingRatingsCount ?? 0)
    : movie?.followingRatingsCount ?? 0;
  const readOnlyOwnerRating = readOnly ? (movie?.visitedOwnerRating ?? movie?.myRating ?? null) : movie?.myRating ?? null;

  return (
    <div className="group relative isolate h-[180px] overflow-visible">
      <article className="relative h-full overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/85 px-5.5 py-3.5 shadow-[0_16px_35px_rgba(0,0,0,0.3)] [clip-path:polygon(7%_0%,100%_0%,93%_100%,0%_100%)]">
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-blue-300/10 opacity-80" />
        <div className="relative flex h-full min-w-0 pr-8">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            {movie ? (
              <>
                <div className="grid min-w-0 grid-cols-[60px_minmax(0,1fr)] items-center gap-3.5">
                  {movieImage && movieImage !== failedImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={movieImage}
                      alt={`Poster de ${displayTitle}`}
                      className="h-[84px] w-[60px] shrink-0 rounded-xl border border-white/15 object-cover shadow-inner shadow-black/30"
                      loading="lazy"
                      decoding="async"
                      onError={() => setFailedImageUrl(movieImage)}
                    />
                  ) : (
                    <div className="flex h-[84px] w-[60px] shrink-0 items-center justify-center rounded-xl border border-white/15 bg-zinc-900/80 text-xs font-semibold text-zinc-300 shadow-inner shadow-black/30">
                      <span className="text-lg">{firstLetter}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate whitespace-nowrap text-sm font-semibold leading-tight text-zinc-100">
                      {detailHref ? (
                        <Link
                          href={detailHref}
                          aria-label={`Ver detalle de ${displayTitle}`}
                          className="inline-block max-w-full cursor-pointer truncate transition-colors duration-150 hover:text-blue-100 focus-visible:text-blue-100 focus-visible:outline-none"
                        >
                          {displayTitle}
                        </Link>
                      ) : (
                        displayTitle
                      )}
                    </h3>
                    {displaySecondaryTitle ? (
                      <p className="truncate text-[11px] leading-tight text-blue-200/80">
                        {detailHref ? (
                          <Link
                            href={detailHref}
                            aria-label={`Ver detalle de ${displayTitle} (${displaySecondaryTitle})`}
                            className="inline-block max-w-full cursor-pointer truncate transition-colors duration-150 hover:text-blue-100 focus-visible:text-blue-100 focus-visible:outline-none"
                          >
                            {displaySecondaryTitle}
                          </Link>
                        ) : (
                          displaySecondaryTitle
                        )}
                      </p>
                    ) : null}
                    <div className="mt-1 flex min-w-0 flex-col justify-center gap-0.5 pr-1">
                      <p className="truncate text-sm leading-tight text-zinc-300">{movie.year}</p>
                      <p className="truncate text-sm leading-tight text-zinc-300">{displayGenre}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex items-end justify-between gap-2 pb-0.5">
                  <div className="inline-flex h-10 items-center gap-1 rounded-md border border-white/10 bg-zinc-900/70 px-2 py-1 text-sm font-semibold text-zinc-200" aria-label="General">
                    <span aria-hidden="true">⭐</span>
                    <span>{formatAverageRating(movie.generalRating)}</span>
                  </div>
                  <div className="inline-flex h-10 rounded-md border border-white/10 bg-zinc-900/70 px-2 py-1" aria-label={t("profileFeedFollowing")}>
                    <div className="flex flex-col justify-center leading-tight text-zinc-200">
                      <span className="whitespace-nowrap text-sm font-semibold">👥 {formatFollowingRating(readOnlyFollowingRating)}</span>
                      {formatProfileFeedRatingsCount(locale, readOnlyFollowingRatingsCount) ? (
                        <span className="text-[9px] font-normal text-zinc-500/90">{formatProfileFeedRatingsCount(locale, readOnlyFollowingRatingsCount)}</span>
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
                        <span>{readOnlyOwnerRating === null ? "—" : formatAverageRating(readOnlyOwnerRating)}</span>
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
                        ariaLabel={t("myRating")}
                        className="shrink-0"
                      />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-[84px] w-[60px] shrink-0 items-center justify-center rounded-xl border border-white/15 bg-zinc-900/80 text-xs font-semibold text-zinc-300 shadow-inner shadow-black/30">
                  <span className="text-zinc-600">{t("profileFeedNoItems")}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{`${locale === "en" ? "Favorite" : "Favorita"} ${slot}`}</p>
                  <p className="text-sm text-zinc-500">{locale === "en" ? "Select a movie for this slot." : "Selecciona una película para este espacio."}</p>
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
          className="absolute right-2 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-blue-300/60 bg-zinc-900 text-blue-200 shadow-[0_8px_18px_rgba(56,189,248,0.22)] transition hover:border-blue-200 hover:text-blue-100"
        >
          <span className="text-lg leading-none">+</span>
        </button>
      ) : null}
    </div>
  );
}

const FAVORITE_AUTOCOMPLETE_LIMIT = 10;
const FAVORITE_AUTOCOMPLETE_SCROLL_THRESHOLD_PX = 96;
const FAVORITE_AUTOCOMPLETE_DEBOUNCE_MS = 400;
const NUMERIC_QUERY_PATTERN = /^\d+$/;

function shouldRunAutocomplete(query: string): boolean {
  return query.length >= 3 || NUMERIC_QUERY_PATTERN.test(query);
}

function haveSameMovieIds(left: Movie[], right: Movie[]): boolean {
  return left.length === right.length && left.every((movie, index) => String(movie.id) === String(right[index]?.id));
}

function updateResultIds(movies: Movie[], targetRef: { current: Set<string> }) {
  targetRef.current = new Set(movies.map((movie) => String(movie.id)));
}

function buildFavoriteAutocompleteEndpoint(query: string, page: number): string {
  return `/movies/?${new URLSearchParams({
    autocomplete: "true",
    q: query,
    limit: String(FAVORITE_AUTOCOMPLETE_LIMIT),
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

function compactMetadataValue(value: string | null | undefined, fallback = "—") {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}


interface FavoriteSearchResultRowProps {
  movie: Movie;
  savingMovieId: string | null;
  onSelect: (movie: Movie) => void;
}

const FavoriteSearchResultRow = memo(function FavoriteSearchResultRow({ movie, savingMovieId, onSelect }: FavoriteSearchResultRowProps) {
  const { t } = useI18n();
  const movieId = String(movie.id);
  const castPreview = movie.castMembers.join(", ");
  const posterSrc = movie.posterUrl || movie.image || null;
  const isSaving = savingMovieId === movieId;

  return (
    <button
      key={movieId}
      type="button"
      role="option"
      aria-selected="false"
      onClick={() => onSelect(movie)}
      disabled={Boolean(savingMovieId)}
      className="grid w-full grid-cols-[44px_minmax(0,1.25fr)_minmax(0,0.78fr)_minmax(0,1fr)] items-start gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-xs text-zinc-300 transition hover:border-blue-300/35 hover:bg-white/10 focus:border-blue-300/50 focus:bg-white/10 focus:outline-none disabled:cursor-wait disabled:opacity-70"
    >
      <div className="h-[62px] w-[44px] overflow-hidden rounded-md border border-white/15 bg-zinc-900">
        {posterSrc ? (
          <img src={posterSrc} alt={movie.displayTitle} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] leading-tight text-zinc-500">{t("profileFeedNoPoster")}</div>
        )}
      </div>
      <div className="min-w-0 text-xs text-zinc-200">
        <p className="line-clamp-2 min-w-0 break-words bg-gradient-to-r from-sky-100 via-blue-300 to-slate-300 bg-clip-text font-semibold leading-snug text-transparent">
          {compactMetadataValue(movie.titleSpanish ?? movie.displayTitle)}
        </p>
        <p className="truncate text-[11px] leading-snug text-zinc-400">
          {compactMetadataValue(movie.titleEnglish ?? movie.displaySecondaryTitle)}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-zinc-500">{compactMetadataValue(movie.year)}</p>
      </div>
      <div className="min-w-0 text-[11px] leading-snug">
        <p className="truncate font-medium text-zinc-200">{compactMetadataValue(movie.contentType)}</p>
        <p className="truncate text-zinc-500">{movie.genres.length ? movie.genres.join(", ") : "—"}</p>
      </div>
      <div className="min-w-0 text-[11px] leading-snug text-zinc-300">
        <p className="truncate text-zinc-400">
          <span className="font-medium text-blue-300">{t("profileFeedDirector")}</span> {compactMetadataValue(movie.director)}
        </p>
        <p className="line-clamp-3 break-words text-zinc-500">
          <span className="font-medium text-blue-300">{t("profileFeedCast")}</span> {isSaving ? "Guardando…" : castPreview || "—"}
        </p>
      </div>
    </button>
  );
});

function FavoriteSearchModal({ slot, open, onClose, onSaved }: FavoriteSearchModalProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingMovieId, setSavingMovieId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [nextEndpoint, setNextEndpoint] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [canLoadMore, setCanLoadMore] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadMoreAbortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const resultIdsRef = useRef<Set<string>>(new Set());
  const trimmedQuery = useMemo(() => query.trim(), [query]);

  const resetSearchState = useCallback(() => {
    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    loadMoreAbortControllerRef.current?.abort();
    loadMoreAbortControllerRef.current = null;
    requestIdRef.current += 1;
    resultIdsRef.current = new Set();
    setQuery("");
    setResults([]);
    setLoading(false);
    setLoadingMore(false);
    setSavingMovieId(null);
    setFeedback("");
    setNextEndpoint(null);
    setCurrentPage(1);
    setCanLoadMore(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetSearchState();
      return;
    }

    const focusTimeout = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimeout);
  }, [open, resetSearchState]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    const handleOutsideClick = (event: MouseEvent) => {
      if (!modalRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    loadMoreAbortControllerRef.current?.abort();
    loadMoreAbortControllerRef.current = null;
    setNextEndpoint(null);
    setCurrentPage(1);
    setCanLoadMore(false);
    setLoadingMore(false);
    setFeedback("");

    if (!shouldRunAutocomplete(trimmedQuery)) {
      requestIdRef.current += 1;
      resultIdsRef.current = new Set();
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    debounceTimeoutRef.current = window.setTimeout(() => {
      const requestController = new AbortController();
      abortControllerRef.current = requestController;
      const endpoint = buildFavoriteAutocompleteEndpoint(trimmedQuery, 1);

      void apiFetch(endpoint, { signal: requestController.signal })
        .then((payload) => {
          if (requestIdRef.current !== currentRequestId || requestController.signal.aborted) return;

          const parsed = parseMovieList(payload);
          const pagination = parseMoviePagination(payload);

          updateResultIds(parsed, resultIdsRef);
          setResults((currentResults) => (haveSameMovieIds(currentResults, parsed) ? currentResults : parsed));
          setNextEndpoint((currentNextEndpoint) => (currentNextEndpoint === pagination.next ? currentNextEndpoint : pagination.next));
          setCurrentPage((currentPageValue) => (currentPageValue === 1 ? currentPageValue : 1));
          const nextCanLoadMore = Boolean(pagination.next) || parsed.length >= FAVORITE_AUTOCOMPLETE_LIMIT;
          setCanLoadMore((currentCanLoadMore) => (currentCanLoadMore === nextCanLoadMore ? currentCanLoadMore : nextCanLoadMore));
          const nextFeedback = parsed.length === 0 ? t("profileFeedNoResults") : "";
          setFeedback((currentFeedback) => (currentFeedback === nextFeedback ? currentFeedback : nextFeedback));
        })
        .catch((error) => {
          if (requestIdRef.current !== currentRequestId || requestController.signal.aborted) return;
          if (error instanceof DOMException && error.name === "AbortError") return;

          setNextEndpoint(null);
          setCanLoadMore((currentCanLoadMore) => (currentCanLoadMore ? false : currentCanLoadMore));
          setFeedback((currentFeedback) => (currentFeedback === t("profileFeedNoResults") ? currentFeedback : t("profileFeedNoResults")));
        })
        .finally(() => {
          if (requestIdRef.current === currentRequestId && abortControllerRef.current === requestController) {
            abortControllerRef.current = null;
            if (!requestController.signal.aborted) {
              setLoading(false);
            }
          }
        });
    }, FAVORITE_AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      if (debounceTimeoutRef.current) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, [open, t, trimmedQuery]);

  const loadMoreResults = useCallback(() => {
    if (!open || !canLoadMore || loading || loadingMore || loadMoreAbortControllerRef.current || !shouldRunAutocomplete(trimmedQuery)) return;

    const requestId = requestIdRef.current;
    const requestQuery = trimmedQuery;
    const nextPage = currentPage + 1;
    const endpoint = nextEndpoint ? normalizeNextEndpoint(nextEndpoint, API_BASE_URL) : buildFavoriteAutocompleteEndpoint(requestQuery, nextPage);
    const requestController = new AbortController();

    loadMoreAbortControllerRef.current = requestController;
    setLoadingMore(true);

    void apiFetch(endpoint, { signal: requestController.signal })
      .then((payload) => {
        if (requestIdRef.current !== requestId || trimmedQuery !== requestQuery || requestController.signal.aborted) return;

        const parsed = parseMovieList(payload);
        const pagination = parseMoviePagination(payload);
        const uniqueMovies = collectUniqueMovies(parsed, resultIdsRef.current);

        setResults((currentResults) => (uniqueMovies.length ? [...currentResults, ...uniqueMovies] : currentResults));
        setNextEndpoint((currentNextEndpoint) => (currentNextEndpoint === pagination.next ? currentNextEndpoint : pagination.next));
        setCurrentPage((currentPageValue) => (currentPageValue === nextPage ? currentPageValue : nextPage));
        const nextCanLoadMore = Boolean(pagination.next) || (uniqueMovies.length > 0 && parsed.length >= FAVORITE_AUTOCOMPLETE_LIMIT);
        setCanLoadMore((currentCanLoadMore) => (currentCanLoadMore === nextCanLoadMore ? currentCanLoadMore : nextCanLoadMore));
      })
      .catch((error) => {
        if (requestIdRef.current !== requestId || trimmedQuery !== requestQuery || requestController.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;

        setCanLoadMore((currentCanLoadMore) => (currentCanLoadMore ? false : currentCanLoadMore));
      })
      .finally(() => {
        if (loadMoreAbortControllerRef.current === requestController) {
          loadMoreAbortControllerRef.current = null;
        }

        if (requestIdRef.current === requestId && trimmedQuery === requestQuery && !requestController.signal.aborted) {
          setLoadingMore(false);
        }
      });
  }, [canLoadMore, currentPage, loading, loadingMore, nextEndpoint, open, trimmedQuery]);

  const handleResultsScroll = (event: UIEvent<HTMLDivElement>) => {
    const listbox = event.currentTarget;
    const distanceToBottom = listbox.scrollHeight - listbox.scrollTop - listbox.clientHeight;

    if (distanceToBottom <= FAVORITE_AUTOCOMPLETE_SCROLL_THRESHOLD_PX) {
      loadMoreResults();
    }
  };

  const handleMovieSelect = useCallback(async (movie: Movie) => {
    const movieId = String(movie.id);
    if (savingMovieId) return;

    try {
      setSavingMovieId(movieId);
      setFeedback("");
      await setFavoriteMovie(slot, movieId);
      await onSaved();
      onClose();
    } catch {
      setFeedback(t("profileFeedNoResults"));
    } finally {
      setSavingMovieId(null);
    }
  }, [onClose, onSaved, savingMovieId, slot, t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 p-4 pt-[14vh]" role="dialog" aria-modal="true">
      <div ref={modalRef} className="w-full max-w-3xl rounded-2xl border border-white/20 bg-zinc-950/95 p-3 shadow-[0_28px_55px_rgba(0,0,0,0.6)] backdrop-blur">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={interpolate(t("profileFeedSearchFavoriteMoviePlaceholder"), { slot })}
          aria-label={interpolate(t("profileFeedSearchFavoriteMoviePlaceholder"), { slot })}
          className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-400/15"
        />

        <div
          role="listbox"
          aria-label={t("profileFeedNoResults")}
          className="search-dropdown-scrollbar mt-3 max-h-[360px] overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-zinc-900/60 p-1"
          onScroll={handleResultsScroll}
        >
          {results.map((movie) => (
            <FavoriteSearchResultRow key={movie.id} movie={movie} savingMovieId={savingMovieId} onSelect={handleMovieSelect} />
          ))}
          {loadingMore ? <p className="px-3 py-2 text-center text-[11px] text-zinc-500">{t("profileFeedLoadingMore")}</p> : null}
          {loading ? (
            <div className="flex justify-center px-3 py-2" aria-label={t("profileFeedLoading")}>
              <span className="h-3 w-3 animate-spin rounded-full border border-blue-200/30 border-t-blue-200" />
            </div>
          ) : null}
          {!loading && !shouldRunAutocomplete(trimmedQuery) ? <p className="px-3 py-3 text-xs text-zinc-500">{t("profileFeedTypeAtLeast3Characters")}</p> : null}
          {!loading && feedback ? <p className="px-3 py-3 text-xs text-zinc-400">{feedback}</p> : null}
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
  const { t } = useI18n();
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
    <section className="rounded-3xl bg-zinc-950/65 p-6 shadow-[0_24px_45px_rgba(0,0,0,0.38)]">
      {title ? <h2 className="mb-4 text-lg font-semibold text-zinc-100 md:text-left">{title}</h2> : null}
      {loading ? <p className="text-sm text-zinc-400">{t("profileFeedLoading")}</p> : null}
      {!loading && error ? <p className="mb-3 text-xs text-zinc-400">{error}</p> : null}

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3 xl:gap-2.5">
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
