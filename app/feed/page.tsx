"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, ApiError, apiFetch } from "../../lib/api";
import { clearToken, getToken } from "../../lib/auth";
import GenreChips from "../../components/GenreChips";
import MovieCard from "../../components/MovieCard";
import SearchBar from "../../components/SearchBar";
import WeeklyRecommendationsSection from "../../components/WeeklyRecommendationsSection";
import DirectorBoardMenu from "../../components/DirectorBoardMenu";
import UserProfilePlaceholderButton from "../../components/UserProfilePlaceholderButton";
import AppLogo from "../../components/AppLogo";
import { FEED_GENRE_OPTIONS, movieMatchesSelectedGenres } from "../../lib/genres";
import { getPersonalData } from "../../lib/personal-data";
import {
  getMyMessagesSummary,
  getMyNotificationsSummary,
  getMyProfile,
  isRealNotificationId,
  markAllNotificationsAsRead,
  markNotificationsAsReadBatch,
} from "../../lib/profile-feed/adapters";
import { MyNotificationItem } from "../../lib/profile-feed/types";
import { useAppBranding } from "../../hooks/useAppBranding";
import {
  addMovieToMyList,
  addMovieToMyRecommendations,
  getMyMovieList,
  getMyMovieRecommendations,
  Movie,
  MOVIES_FEED_ENDPOINT,
  removeMovieFromMyList,
  removeMovieFromMyRecommendations,
  WEEKLY_MOVIES_FEED_ENDPOINT,
  parseMovieList,
  parseMoviePagination,
  normalizeNextEndpoint,
} from "../../lib/movies";

const MY_LIST_IDS_STORAGE_KEY = "my_list_movie_ids";

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

function buildPersonalizedFeedEndpoint(selectedGenres: string[]): string {
  const params = new URLSearchParams();

  selectedGenres.forEach((genre) => {
    params.append("genres", genre);
  });

  const queryString = params.toString();
  return queryString ? `${MOVIES_FEED_ENDPOINT}?${queryString}` : MOVIES_FEED_ENDPOINT;
}

function withActiveGenreFilters(endpoint: string, selectedGenres: string[]): string {
  const [path, queryString = ""] = endpoint.split("?");
  const params = new URLSearchParams(queryString);

  params.delete("genres");
  selectedGenres.forEach((genre) => {
    params.append("genres", genre);
  });

  const nextQueryString = params.toString();
  return nextQueryString ? `${path}?${nextQueryString}` : path;
}

function buildGenresQueryKey(selectedGenres: string[]): string {
  return [...selectedGenres].sort().join("|");
}

function filterBySelectedGenres(movies: Movie[], selectedGenres: string[]): Movie[] {
  return movies.filter((movie) => movieMatchesSelectedGenres(movie.genres, selectedGenres));
}

function shouldExcludeFromPersonalized(movie: Movie, excludedRatedIds: Set<string>): boolean {
  return excludedRatedIds.has(String(movie.id)) || movie.myRating !== null;
}

function sanitizePersonalizedMovies(movies: Movie[], excludedRatedIds: Set<string>): Movie[] {
  return movies.filter((movie) => !shouldExcludeFromPersonalized(movie, excludedRatedIds));
}

type StreamingCountry = "CO" | "US";
const STREAMING_COUNTRY_OPTIONS: { value: StreamingCountry; flag: string }[] = [
  { value: "CO", flag: "🇨🇴" },
  { value: "US", flag: "🇺🇸" },
];

function normalizeStreamingCountry(value: unknown): StreamingCountry {
  return value === "US" ? "US" : "CO";
}

export default function FeedPage() {
  const router = useRouter();
  const branding = useAppBranding();

  const [weeklyMovies, setWeeklyMovies] = useState<Movie[]>([]);
  const [personalizedMovies, setPersonalizedMovies] = useState<Movie[]>([]);
  const [personalizedNext, setPersonalizedNext] = useState<string | null>(null);
  const [isLoadingPersonalized, setIsLoadingPersonalized] = useState(false);
  const [isLoadingMorePersonalized, setIsLoadingMorePersonalized] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isDirectorBoardOpen, setIsDirectorBoardOpen] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileAvatarVersion, setProfileAvatarVersion] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [notificationItems, setNotificationItems] = useState<MyNotificationItem[]>([]);
  const [listedMovieIds, setListedMovieIds] = useState<Set<string>>(new Set());
  const [recommendedMovieIds, setRecommendedMovieIds] = useState<Set<string>>(new Set());
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [streamingCountry, setStreamingCountry] = useState<StreamingCountry>("CO");
  const [isSavingStreamingCountry, setIsSavingStreamingCountry] = useState(false);
  const [streamingCountryError, setStreamingCountryError] = useState("");
  const [isStreamingCountryMenuOpen, setIsStreamingCountryMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const personalizedRequestIdRef = useRef(0);
  const personalizedQueryKeyRef = useRef("");
  const personalizedAbortControllerRef = useRef<AbortController | null>(null);
  const personalizedLoadMoreAbortControllerRef = useRef<AbortController | null>(null);
  const excludedRatedIdsRef = useRef<Set<string>>(new Set());
  const notificationContainerRef = useRef<HTMLDivElement | null>(null);
  const streamingCountryContainerRef = useRef<HTMLDivElement | null>(null);
  const isRefreshingNotificationsRef = useRef(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const loadFeed = async () => {
      try {
        const weeklyResult = await apiFetch(WEEKLY_MOVIES_FEED_ENDPOINT).then(
          (payload) => ({ ok: true as const, payload }),
          (error) => ({ ok: false as const, error }),
        );

        if (!weeklyResult.ok && weeklyResult.error instanceof ApiError && weeklyResult.error.status === 401) {
          router.replace("/login");
          return;
        }

        if (
          !weeklyResult.ok &&
          !(weeklyResult.error instanceof ApiError && [404, 405].includes(weeklyResult.error.status))
        ) {
          throw weeklyResult.error;
        }

        const [normalizedWeekly, myListMovies, myRecommendedMovies] = await Promise.all([
          Promise.resolve(weeklyResult.ok ? parseMovieList(weeklyResult.payload) : []),
          getMyMovieList().catch(() => []),
          getMyMovieRecommendations().catch(() => []),
        ]);
        const backendListSet = new Set(myListMovies.map((movie) => String(movie.id)));
        const backendRecommendationsSet = new Set(myRecommendedMovies.map((movie) => String(movie.id)));

        setWeeklyMovies(normalizedWeekly);
        setListedMovieIds(backendListSet);
        setRecommendedMovieIds(backendRecommendationsSet);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(MY_LIST_IDS_STORAGE_KEY, JSON.stringify(Array.from(backendListSet)));
        }
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

  const syncMyListIds = useCallback(async () => {
    try {
      const myListMovies = await getMyMovieList();
      const syncedIds = new Set(myListMovies.map((movie) => String(movie.id)));
      setListedMovieIds(syncedIds);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(MY_LIST_IDS_STORAGE_KEY, JSON.stringify(Array.from(syncedIds)));
      }
    } catch (syncError) {
      console.warn("No se pudo sincronizar Mi Lista en feed.", syncError);
    }
  }, []);

  const handleToggleMyRecommendations = useCallback(async (movieId: Movie["id"], nextValue: boolean) => {
    const movieIdKey = String(movieId);
    setRecommendedMovieIds((current) => {
      const next = new Set(current);
      if (nextValue) next.add(movieIdKey);
      else next.delete(movieIdKey);
      return next;
    });

    try {
      if (nextValue) await addMovieToMyRecommendations(movieId);
      else await removeMovieFromMyRecommendations(movieId);
    } catch (error) {
      console.warn("No se pudo actualizar Mis recomendadas.", error);
      setRecommendedMovieIds((current) => {
        const rollback = new Set(current);
        if (nextValue) rollback.delete(movieIdKey);
        else rollback.add(movieIdKey);
        return rollback;
      });
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (isRefreshingNotificationsRef.current) return;
    isRefreshingNotificationsRef.current = true;

    try {
      const notificationsSummary = await getMyNotificationsSummary().catch(async () => {
        const fallbackMessagesSummary = await getMyMessagesSummary();
        return {
          totalUnread: fallbackMessagesSummary.unreadCount,
          items: [] as MyNotificationItem[],
        };
      });
      setUnreadNotificationsCount(notificationsSummary.totalUnread);
      setNotificationItems(notificationsSummary.items);
    } catch (notificationError) {
      console.warn("No se pudo refrescar notificaciones.", notificationError);
    } finally {
      isRefreshingNotificationsRef.current = false;
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const loadProfileContext = async () => {
      try {
        const [personalData, profile, me] = await Promise.all([getPersonalData(), getMyProfile(), apiFetch("/me/", { cache: "no-store" })]);
        setProfileAvatarUrl(personalData.avatar);
        setCurrentUserId(profile?.id ?? null);
        const normalizedCountry = normalizeStreamingCountry(
          me && typeof me === "object" ? (me as Record<string, unknown>).streaming_country : null,
        );
        setStreamingCountry(normalizedCountry);
        setStreamingCountryError("");
        const storedVersion = typeof window !== "undefined" ? window.localStorage.getItem("profile_avatar_updated_at") : null;
        setProfileAvatarVersion(storedVersion);
        await refreshNotifications();
      } catch (avatarError) {
        console.warn("No se pudo cargar el avatar del perfil para feed:", avatarError);
        setProfileAvatarUrl(null);
        setCurrentUserId(null);
        setUnreadNotificationsCount(0);
        setNotificationItems([]);
      }
    };

    void loadProfileContext();
  }, [refreshNotifications]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const intervalId = window.setInterval(() => {
      void refreshNotifications();
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshNotifications]);

  const fetchPersonalizedMovies = useCallback(
    async (genres: string[]) => {
      personalizedAbortControllerRef.current?.abort();
      personalizedLoadMoreAbortControllerRef.current?.abort();

      const abortController = new AbortController();
      personalizedAbortControllerRef.current = abortController;

      const requestId = personalizedRequestIdRef.current + 1;
      personalizedRequestIdRef.current = requestId;
      const queryKey = buildGenresQueryKey(genres);
      personalizedQueryKeyRef.current = queryKey;

      setIsLoadingPersonalized(true);
      setIsLoadingMorePersonalized(false);
      setPersonalizedMovies([]);
      setPersonalizedNext(null);

      try {
        const payload = await apiFetch(buildPersonalizedFeedEndpoint(genres), { signal: abortController.signal });
        if (personalizedRequestIdRef.current !== requestId || personalizedQueryKeyRef.current !== queryKey) return;

        const nextMovies = sanitizePersonalizedMovies(
          filterBySelectedGenres(parseMovieList(payload), genres),
          excludedRatedIdsRef.current,
        );
        const pagination = parseMoviePagination(payload);

        setPersonalizedMovies(nextMovies);
        setPersonalizedNext(pagination.next);
      } catch (loadPersonalizedError) {
        if ((loadPersonalizedError as Error).name === "AbortError") return;
        console.error("Filtered personalized load error:", loadPersonalizedError);

        if (loadPersonalizedError instanceof ApiError && loadPersonalizedError.status === 401) {
          router.replace("/login");
          return;
        }

        if (personalizedRequestIdRef.current !== requestId || personalizedQueryKeyRef.current !== queryKey) return;
        setPersonalizedMovies([]);
        setPersonalizedNext(null);
      } finally {
        if (personalizedRequestIdRef.current === requestId && personalizedQueryKeyRef.current === queryKey) {
          setIsLoadingPersonalized(false);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    if (loading) return;
    void fetchPersonalizedMovies(selectedGenres);
  }, [fetchPersonalizedMovies, loading, selectedGenres]);

  const loadMorePersonalized = useCallback(async () => {
    if (!personalizedNext || isLoadingMorePersonalized) return;
    const queryKey = buildGenresQueryKey(selectedGenres);
    const requestId = personalizedRequestIdRef.current;
    const abortController = new AbortController();
    personalizedLoadMoreAbortControllerRef.current?.abort();
    personalizedLoadMoreAbortControllerRef.current = abortController;

    try {
      setIsLoadingMorePersonalized(true);
      const normalizedNextEndpoint = normalizeNextEndpoint(personalizedNext, API_BASE_URL);
      const endpointWithFilters = withActiveGenreFilters(normalizedNextEndpoint, selectedGenres);
      const payload = await apiFetch(endpointWithFilters, { signal: abortController.signal });
      if (requestId !== personalizedRequestIdRef.current || queryKey !== personalizedQueryKeyRef.current) return;

      const nextPageMovies = sanitizePersonalizedMovies(
        filterBySelectedGenres(parseMovieList(payload), selectedGenres),
        excludedRatedIdsRef.current,
      );
      const pagination = parseMoviePagination(payload);

      setPersonalizedMovies((current) =>
        sanitizePersonalizedMovies(mergeUniqueMovies(current, nextPageMovies), excludedRatedIdsRef.current),
      );
      setPersonalizedNext(pagination.next);
    } catch (loadMoreError) {
      if ((loadMoreError as Error).name === "AbortError") return;
      console.error("Personalized pagination load error:", loadMoreError);
    } finally {
      if (requestId === personalizedRequestIdRef.current && queryKey === personalizedQueryKeyRef.current) {
        setIsLoadingMorePersonalized(false);
      }
    }
  }, [isLoadingMorePersonalized, personalizedNext, selectedGenres]);

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

  const shouldDisableGenreChip = useCallback(
    (genre: string) => selectedGenres.length >= MAX_SELECTED_GENRES && !selectedGenres.includes(genre),
    [selectedGenres],
  );

  const handleDirectorBoardToggle = useCallback(() => {
    setIsDirectorBoardOpen((current) => !current);
  }, []);

  const handleDirectorBoardClose = useCallback(() => {
    setIsDirectorBoardOpen(false);
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    router.replace("/login");
  }, [router]);

  const handleBellClick = useCallback(() => {
    setIsNotificationPanelOpen((current) => {
      const nextState = !current;
      if (nextState) {
        void refreshNotifications();
      }
      return nextState;
    });
  }, [refreshNotifications]);

  const handleStreamingCountryChange = useCallback(
    async (nextCountry: StreamingCountry) => {
      const previousCountry = streamingCountry;
      if (nextCountry === previousCountry || isSavingStreamingCountry) return;

      setStreamingCountry(nextCountry);
      setStreamingCountryError("");
      setIsSavingStreamingCountry(true);

      try {
        await apiFetch("/me/", {
          method: "PATCH",
          body: JSON.stringify({ streaming_country: nextCountry }),
        });
      } catch (streamingCountryPatchError) {
        console.warn("No se pudo actualizar streaming_country.", streamingCountryPatchError);
        setStreamingCountry(previousCountry);
        setStreamingCountryError("No se guardó el país");
      } finally {
        setIsSavingStreamingCountry(false);
      }
    },
    [isSavingStreamingCountry, streamingCountry],
  );

  const handleNotificationItemClick = useCallback(
    async (item: MyNotificationItem) => {
      setIsNotificationPanelOpen(false);
      const targetRoute =
        item.targetTab === "friend_requests_pending"
          ? "/profile-feed?friendsTab=pending"
          : item.movieId !== null && item.movieId !== ""
            ? `/movies/${item.movieId}`
            : item.targetTab === "private_inbox"
              ? "/profile-feed?tab=private_inbox"
              : "/profile-feed?tab=activity";

      try {
        if (isRealNotificationId(item.id)) {
          await markNotificationsAsReadBatch([item.id]);
        } else {
          console.warn("Notification without real id, skipping mark-read");
        }

        setNotificationItems((current) => current.filter((notificationItem) => notificationItem.id !== item.id));
        setUnreadNotificationsCount((current) => Math.max(0, current - 1));
        await refreshNotifications();
      } catch (error) {
        console.warn("No se pudo marcar la notificación como leída.", error);
      } finally {
        router.push(targetRoute);
      }
    },
    [refreshNotifications, router],
  );

  const handleMarkAllNotificationsAsRead = useCallback(async () => {
    const visibleNotificationIds = notificationItems.map((item) => item.id).filter((id) => isRealNotificationId(id));
    setNotificationItems([]);
    setUnreadNotificationsCount(0);

    try {
      await markAllNotificationsAsRead();
    } catch (markAllError) {
      if (visibleNotificationIds.length > 0) {
        try {
          await markNotificationsAsReadBatch(visibleNotificationIds);
        } catch (batchError) {
          console.warn("No se pudo marcar notificaciones en lote.", batchError);
          await refreshNotifications();
          return;
        }
      } else {
        console.warn("No se pudo marcar todas las notificaciones como leídas.", markAllError);
        await refreshNotifications();
        return;
      }
    }
  }, [notificationItems, refreshNotifications]);

  const updateWeeklyMovieRating = useCallback((movieId: Movie["id"], score: number, _payload?: unknown) => {
    void _payload;
    setWeeklyMovies((current) =>
      current.map((movie) => (String(movie.id) === String(movieId) ? { ...movie, myRating: score } : movie)),
    );
  }, []);

  const handlePersonalizedRated = useCallback((movieId: Movie["id"], _score: number, _payload?: unknown) => {
    void _score;
    void _payload;
    excludedRatedIdsRef.current.add(String(movieId));
    setPersonalizedMovies((current) => sanitizePersonalizedMovies(current, excludedRatedIdsRef.current));
  }, []);

  const handleToggleMyList = useCallback(async (movieId: Movie["id"], nextValue: boolean) => {
    const movieIdKey = String(movieId);
    setListedMovieIds((current) => {
      const next = new Set(current);
      if (nextValue) next.add(movieIdKey);
      else next.delete(movieIdKey);
      return next;
    });

    try {
      if (nextValue) await addMovieToMyList(movieId);
      else await removeMovieFromMyList(movieId);
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(MY_LIST_IDS_STORAGE_KEY);
        const ids = new Set<string>(stored ? JSON.parse(stored) : []);
        if (nextValue) ids.add(movieIdKey);
        else ids.delete(movieIdKey);
        window.localStorage.setItem(MY_LIST_IDS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
      }
    } catch (error) {
      setListedMovieIds((current) => {
        const rollback = new Set(current);
        if (nextValue) rollback.delete(movieIdKey);
        else rollback.add(movieIdKey);
        return rollback;
      });
      throw error;
    }
  }, []);

  const visiblePersonalizedMovies = useMemo(
    () => sanitizePersonalizedMovies(filterBySelectedGenres(personalizedMovies, selectedGenres), excludedRatedIdsRef.current),
    [personalizedMovies, selectedGenres],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = window.localStorage.getItem(MY_LIST_IDS_STORAGE_KEY);
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        setListedMovieIds(new Set(parsed.map((id) => String(id))));
      }
    } catch {
      window.localStorage.removeItem(MY_LIST_IDS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const onMyListChanged = () => {
      void syncMyListIds();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncMyListIds();
      }
    };
    window.addEventListener("my-list:changed", onMyListChanged);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onMyListChanged);
    return () => {
      window.removeEventListener("my-list:changed", onMyListChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onMyListChanged);
    };
  }, [syncMyListIds]);

  useEffect(
    () => () => {
      personalizedAbortControllerRef.current?.abort();
      personalizedLoadMoreAbortControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!isNotificationPanelOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!notificationContainerRef.current) return;
      if (event.target instanceof Node && !notificationContainerRef.current.contains(event.target)) {
        setIsNotificationPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotificationPanelOpen]);

  useEffect(() => {
    const onNotificationsRefreshRequested = () => {
      void refreshNotifications();
    };

    window.addEventListener("notifications:refresh-requested", onNotificationsRefreshRequested);
    return () => {
      window.removeEventListener("notifications:refresh-requested", onNotificationsRefreshRequested);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!streamingCountryContainerRef.current) return;
      if (event.target instanceof Node && !streamingCountryContainerRef.current.contains(event.target)) {
        setIsStreamingCountryMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedStreamingCountryOption = useMemo(
    () => STREAMING_COUNTRY_OPTIONS.find((option) => option.value === streamingCountry) ?? STREAMING_COUNTRY_OPTIONS[0],
    [streamingCountry],
  );

  if (loading) {
    return <div className="p-6 text-zinc-100">Cargando feed principal...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-400">{error}</div>;
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-[1400px] space-y-14 px-4 py-8 md:px-8">
        <div className="sticky top-0 z-40 -mx-2 space-y-5 rounded-3xl border border-white/10 bg-black/80 px-2 py-3 backdrop-blur-md md:mx-0 md:px-0 relative">
          <div className="absolute left-0 top-2 z-30 hidden h-20 w-[280px] items-start justify-center overflow-visible bg-transparent pl-6 sm:flex md:pl-8">
            <AppLogo
              branding={branding}
              slot="feed_logo_url"
              alt="Branding del feed"
              className="block h-16 w-auto max-w-[260px] translate-y-1 object-contain object-left sm:h-20 md:h-24"
              textClassName="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200"
            />
          </div>
          <div className="pointer-events-none absolute right-0 top-5 z-50 pr-1 md:right-4 md:top-6">
            <div className="pointer-events-auto relative flex w-[198px] flex-col items-center">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Ver notificaciones"
                  onClick={handleBellClick}
                  className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-zinc-900/90 text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-white/60 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 md:h-12 md:w-12"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
                    <path d="M15 18H4a1 1 0 0 1-.77-1.64L6 13V8a6 6 0 1 1 12 0v5l2.77 3.36A1 1 0 0 1 20 18h-1" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 21a3 3 0 0 0 6 0" strokeLinecap="round" />
                  </svg>
                  {unreadNotificationsCount > 0 ? (
                    <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-400 px-1 text-[10px] font-semibold leading-none text-zinc-950">
                      {unreadNotificationsCount}
                    </span>
                  ) : null}
                </button>

                {isNotificationPanelOpen ? (
                  <div
                    ref={notificationContainerRef}
                    className="absolute right-14 top-0 z-[70] w-[310px] rounded-2xl border border-white/15 bg-zinc-950/95 p-3 shadow-[0_28px_40px_rgba(0,0,0,0.55)] backdrop-blur-md md:right-16"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">Notificaciones</p>
                      {notificationItems.length > 0 ? (
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsAsRead}
                          className="text-[11px] font-semibold text-blue-300 transition hover:text-blue-200"
                        >
                          Marcar todo como leído
                        </button>
                      ) : null}
                    </div>
                    <div className="activity-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
                      {notificationItems.length > 0 ? (
                        notificationItems.map((item) => (
                          <button
                            key={String(item.id)}
                            type="button"
                            onClick={() => handleNotificationItemClick(item)}
                            className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-left transition hover:border-blue-300/50 hover:bg-zinc-800"
                          >
                            <p className="text-sm text-zinc-100">{item.text}</p>
                            <p className="mt-1 text-[11px] text-zinc-500">
                              {item.targetTab === "friend_requests_pending"
                                ? "Ir a Pendientes"
                                : item.targetTab === "activity"
                                  ? "Ir a Mi actividad"
                                  : "Ir a Buzón Privado"}
                            </p>
                          </button>
                        ))
                      ) : (
                        <p className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
                          No tienes notificaciones pendientes.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}

                <UserProfilePlaceholderButton
                  onClick={() => router.push("/profile-feed")}
                  avatarUrl={profileAvatarUrl}
                  avatarAlt="Ir a perfil"
                  avatarVersion={profileAvatarVersion}
                />
                <div ref={streamingCountryContainerRef} className="relative flex max-w-[88px] flex-col items-start gap-1">
                  <label htmlFor="streaming-country-button" className="sr-only">
                    País de streaming
                  </label>
                  <button
                    id="streaming-country-button"
                    type="button"
                    disabled={isSavingStreamingCountry}
                    onClick={() => setIsStreamingCountryMenuOpen((current) => !current)}
                    className="flex h-9 w-full items-center justify-between gap-1 rounded-xl border border-white/20 bg-zinc-900/95 px-2 py-1 text-xs font-semibold text-zinc-100 shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:border-white/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-300/35 disabled:cursor-not-allowed disabled:opacity-70"
                    aria-haspopup="listbox"
                    aria-expanded={isStreamingCountryMenuOpen}
                  >
                    <span>{`${selectedStreamingCountryOption.flag} ${selectedStreamingCountryOption.value}`}</span>
                    <span className="text-[10px] text-zinc-400">▾</span>
                  </button>
                  {isStreamingCountryMenuOpen ? (
                    <ul
                      role="listbox"
                      aria-label="País de streaming"
                      className="absolute top-10 z-40 w-full overflow-hidden rounded-xl border border-white/20 bg-zinc-900/98 p-1 shadow-[0_14px_26px_rgba(0,0,0,0.5)]"
                    >
                      {STREAMING_COUNTRY_OPTIONS.map((option) => (
                        <li key={option.value} role="option" aria-selected={streamingCountry === option.value}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsStreamingCountryMenuOpen(false);
                              void handleStreamingCountryChange(option.value);
                            }}
                            className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-300/35 ${
                              streamingCountry === option.value
                                ? "bg-slate-500/25 text-slate-100"
                                : "text-zinc-100 hover:bg-slate-600/25"
                            }`}
                          >
                            {`${option.flag} ${option.value}`}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {streamingCountryError ? <p className="text-[10px] text-red-300">{streamingCountryError}</p> : null}
                </div>
              </div>
              <div className="mt-3">
                <DirectorBoardMenu
                  isOpen={isDirectorBoardOpen}
                  onToggle={handleDirectorBoardToggle}
                  onClose={handleDirectorBoardClose}
                  onCloseSession={handleLogout}
                  onPersonalDataClick={() => router.push("/settings/personal-data")}
                  onPrivacySecurityClick={() => router.push("/privacy-security")}
                />
              </div>
            </div>
          </div>

          <SearchBar
            className="mx-auto w-full max-w-2xl rounded-full border-2 border-white/70 bg-zinc-900/80 p-1.5"
            inputClassName="rounded-full border-2 border-white/60 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
            showSearchIcon
            inlineAutocomplete
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

          <p className="text-center text-xs text-zinc-500">*Escoge hasta 3 géneros</p>
        </div>

        <section className="space-y-5">
          <WeeklyRecommendationsSection weeklyMovies={weeklyMovies} currentUserId={currentUserId} onRated={updateWeeklyMovieRating} listedMovieIds={listedMovieIds} onToggleMyList={handleToggleMyList} recommendedMovieIds={recommendedMovieIds} onToggleMyRecommendations={handleToggleMyRecommendations} />
        </section>

        <section className="space-y-5 bg-black pb-8">
          <div className="mx-auto w-full max-w-[860px] px-3 sm:px-4">
            <h2 className="text-xl font-semibold text-zinc-100">Tu Cartelera</h2>
          </div>
          {isLoadingPersonalized ? (
            <p className="pl-3 text-zinc-400 md:pl-6">Cargando...</p>
          ) : visiblePersonalizedMovies.length === 0 ? (
            <p className="pl-3 text-zinc-400 md:pl-6">No hay películas personalizadas disponibles.</p>
          ) : (
            <div className="mx-auto w-full max-w-[860px] rounded-2xl bg-zinc-950/45 px-3 py-3 sm:px-4 sm:py-4">
              <div className="grid gap-3 md:grid-cols-2">
              {visiblePersonalizedMovies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  variant="feed"
                  enlargeInteractionIcons
                  highlightMyRatingSlot
                  showBottomInteractionIcons={false}
                  compactRatingsRow
                  onRated={handlePersonalizedRated}
                  isInMyListOverride={listedMovieIds.has(String(movie.id))}
                  onToggleMyList={handleToggleMyList}
                  isInMyRecommendationsOverride={recommendedMovieIds.has(String(movie.id))}
                  onToggleMyRecommendations={handleToggleMyRecommendations}
                  stretchPosterColumn
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
