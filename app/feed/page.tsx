"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE_URL, ApiError, apiFetch } from "../../lib/api";
import { clearToken, getToken } from "../../lib/auth";
import GenreChips from "../../components/GenreChips";
import MovieCard, { MAIN_FEED_TRAILER_HOVER_DELAY_MS } from "../../components/MovieCard";
import SearchBar from "../../components/SearchBar";
import WeeklyRecommendationsSection from "../../components/WeeklyRecommendationsSection";
import DirectorBoardMenu from "../../components/DirectorBoardMenu";
import UserProfilePlaceholderButton from "../../components/UserProfilePlaceholderButton";
import StreamingCountrySelector from "../../components/StreamingCountrySelector";
import AppLogo from "../../components/AppLogo";
import VideoReactionViewer from "../../components/VideoReactionViewer";
import NotificationCommentViewer from "../../components/NotificationCommentViewer";
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
import { buildNotificationTargetRoute } from "../../lib/notification-navigation";
import { MyNotificationItem } from "../../lib/profile-feed/types";
import { useAppBranding } from "../../hooks/useAppBranding";
import { normalizeBackendMediaUrl } from "../../lib/branding";
import { type Country, countryToLocale, hasStoredCountryPreference, isSupportedCountry, normalizeCountry, resolveMovieTitles, setActiveLocaleScope, t as translate } from "../../lib/i18n";
import { useI18n } from "../../hooks/useI18n";
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
  buildMovieDetailEndpoint,
  MOVIE_DETAIL_ENDPOINT_TEMPLATE,
  normalizeMovie,
} from "../../lib/movies";
import { resolveVideoReactionComment, type VideoReactionComment, type VideoReactionKind } from "../../lib/video-reactions";
import { buildCommentDetailEndpoint, parseComments, type SocialComment } from "../../lib/social";
import { onboardingPrepareStepEventName } from "../../lib/onboarding/types";
import type { OnboardingPrepareAction } from "../../lib/onboarding/types";
import { useDesktopGuest } from "../../hooks/useDesktopGuest";
import GuestSignupRec from "../../components/GuestSignupRec";

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

function resolveBackendMediaUrl(mediaUrl: string | null | undefined): string | null {
  return normalizeBackendMediaUrl(mediaUrl);
}

const MOBILE_DEFAULT_LOGO_FIELDS = [
  "default_logo",
  "default_logo_url",
  "logo",
  "logo_url",
  "defaultLogo",
  "defaultLogoUrl",
] as const;

type MobileLogoBranding = (NonNullable<ReturnType<typeof useAppBranding>> & Partial<Record<(typeof MOBILE_DEFAULT_LOGO_FIELDS)[number], string | null>>) | null;

function getMobileDefaultLogoUrl(branding: MobileLogoBranding): string | null {
  if (!branding) return null;

  for (const field of MOBILE_DEFAULT_LOGO_FIELDS) {
    const resolvedLogoUrl = resolveBackendMediaUrl(branding[field]);
    if (resolvedLogoUrl) return resolvedLogoUrl;
  }

  return null;
}

function MobileFeedDefaultLogo({ branding, onClick }: { branding: MobileLogoBranding; onClick?: () => void }) {
  const defaultLogoUrl = getMobileDefaultLogoUrl(branding);
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    console.log("[Feed mobile logo branding]", {
      default_logo: branding?.default_logo,
      default_logo_url: branding?.default_logo_url,
      logo: branding?.logo,
      logo_url: branding?.logo_url,
      defaultLogo: branding?.defaultLogo,
      defaultLogoUrl: branding?.defaultLogoUrl,
      resolvedUrl: defaultLogoUrl,
    });
  }, [branding, defaultLogoUrl]);

  if (defaultLogoUrl && failedLogoUrl !== defaultLogoUrl) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Ir al inicio del feed"
        className="block cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 xl:hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={defaultLogoUrl}
          alt="QNext"
          className="h-14 w-auto max-w-[150px] object-contain object-left sm:h-16"
          loading="eager"
          decoding="sync"
          fetchPriority="high"
          onError={() => setFailedLogoUrl(defaultLogoUrl)}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ir al inicio del feed"
      className="cursor-pointer rounded-md bg-gradient-to-r from-sky-100 via-blue-300 to-slate-200 bg-clip-text text-xl font-bold uppercase tracking-[0.18em] text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 xl:hidden"
    >
      QNext
    </button>
  );
}

function translateNotificationText(locale: ReturnType<typeof countryToLocale>, text: string): string {
  if (locale !== "en") return text;

  const knownPatterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^Tienes un mensaje privado de (.+)$/i, (match) => `You have a private message from ${match[1]}`],
    [/^A (.+) le gustó tu mensaje$/i, (match) => `${match[1]} liked your message`],
    [/^A (.+) no le gustó tu mensaje$/i, (match) => `${match[1]} disliked your message`],
    [/^A (.+) le gustó tu comentario$/i, (match) => `${match[1]} liked your comment`],
    [/^A (.+) no le gustó tu comentario$/i, (match) => `${match[1]} disliked your comment`],
    [/^Te gustó el comentario de (.+)$/i, (match) => `You liked ${match[1]}’s comment`],
    [/^No te gustó el comentario de (.+)$/i, (match) => `You disliked ${match[1]}’s comment`],
  ];

  for (const [pattern, translatePattern] of knownPatterns) {
    const match = text.match(pattern);
    if (match) return translatePattern(match);
  }

  return text;
}

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

type StreamingCountry = Country;

function FeedDebugSearchParamsBridge({ onChange }: { onChange: (enabled: boolean) => void }) {
  const searchParams = useSearchParams();
  const debugNotificationTarget = searchParams.get("debugNotificationTarget") === "1";

  useEffect(() => {
    onChange(debugNotificationTarget);
  }, [debugNotificationTarget, onChange]);

  return null;
}

export default function FeedPage() {
  const router = useRouter();
  const { hydrated: authHydrated, isDesktopGuest } = useDesktopGuest();
  const branding = useAppBranding();
  const [debugNotificationTarget, setDebugNotificationTarget] = useState(false);
  const [notificationVideo, setNotificationVideo] = useState<{ video: VideoReactionComment; movie: Movie; reaction: VideoReactionKind } | null>(null);
  const [notificationComment, setNotificationComment] = useState<{
    comment: SocialComment;
    movie: Movie;
    allowReactions: boolean;
    canDirectReply: boolean;
    replyRecipient: { id: string | number; username: string } | null;
  } | null>(null);

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
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [notificationItems, setNotificationItems] = useState<MyNotificationItem[]>([]);
  const [listedMovieIds, setListedMovieIds] = useState<Set<string>>(new Set());
  const [recommendedMovieIds, setRecommendedMovieIds] = useState<Set<string>>(new Set());
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileBottomNavVisible, setIsMobileBottomNavVisible] = useState(true);
  const [isMobileOnboardingNavForced, setIsMobileOnboardingNavForced] = useState(false);
  const { country: streamingCountry, locale, setCountry: setStreamingCountry } = useI18n(null);
  const [isSavingStreamingCountry, setIsSavingStreamingCountry] = useState(false);
  const [streamingCountryError, setStreamingCountryError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const personalizedRequestIdRef = useRef(0);
  const personalizedQueryKeyRef = useRef("");
  const personalizedAbortControllerRef = useRef<AbortController | null>(null);
  const personalizedLoadMoreAbortControllerRef = useRef<AbortController | null>(null);
  const excludedRatedIdsRef = useRef<Set<string>>(new Set());
  const desktopNotificationContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileNotificationContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const isRefreshingNotificationsRef = useRef(false);
  const lastMobileScrollYRef = useRef(0);


  const handleMobileLogoClick = useCallback(() => {
    if (typeof window === "undefined") return;

    setIsMobileBottomNavVisible(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    lastMobileScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      if (!mediaQuery.matches) return;
      if (isMobileSearchOpen || isNotificationPanelOpen) {
        setIsMobileBottomNavVisible(true);
        lastMobileScrollYRef.current = window.scrollY;
        return;
      }

      const currentScrollY = Math.max(window.scrollY, 0);
      const scrollDelta = currentScrollY - lastMobileScrollYRef.current;

      if (currentScrollY < 24) {
        setIsMobileBottomNavVisible(true);
      } else if (scrollDelta > 8) {
        setIsMobileBottomNavVisible(false);
      } else if (scrollDelta < -8) {
        setIsMobileBottomNavVisible(true);
      }

      lastMobileScrollYRef.current = currentScrollY;
    };

    setIsMobileBottomNavVisible(true);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobileSearchOpen, isNotificationPanelOpen]);

  useEffect(() => {
    const prepareMobileFeedStep = (event: Event) => {
      if (!window.matchMedia("(max-width: 1279px)").matches) return;
      const action = (event as CustomEvent<{ action?: OnboardingPrepareAction }>).detail?.action;
      if (action === "feed-mobile-panel-show") setIsMobileOnboardingNavForced(true);
      if (action === "feed-mobile-panel-release") setIsMobileOnboardingNavForced(false);
    };
    window.addEventListener(onboardingPrepareStepEventName, prepareMobileFeedStep);
    return () => window.removeEventListener(onboardingPrepareStepEventName, prepareMobileFeedStep);
  }, []);

  useEffect(() => {
    if (!authHydrated) return;
    const token = getToken();
    if (!token && !isDesktopGuest) {
      router.replace("/login");
      return;
    }

    const loadFeed = async () => {
      try {
        const weeklyResult = await apiFetch(WEEKLY_MOVIES_FEED_ENDPOINT).then(
          (payload) => ({ ok: true as const, payload }),
          (error) => ({ ok: false as const, error }),
        );

        if (!isDesktopGuest && !weeklyResult.ok && weeklyResult.error instanceof ApiError && weeklyResult.error.status === 401) {
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
          isDesktopGuest ? Promise.resolve([]) : getMyMovieList().catch(() => []),
          isDesktopGuest ? Promise.resolve([]) : getMyMovieRecommendations().catch(() => []),
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

        if (!isDesktopGuest && loadError instanceof ApiError && loadError.status === 401) {
          router.replace("/login");
          return;
        }

        setError("No se pudo cargar el feed de películas.");
      } finally {
        setLoading(false);
      }
    };

    loadFeed();
  }, [authHydrated, isDesktopGuest, router]);

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
        const meRecord = me && typeof me === "object" ? (me as Record<string, unknown>) : null;
        const resolvedUserId = profile?.id ?? meRecord?.id ?? null;
        const resolvedUsername =
          typeof meRecord?.username === "string"
            ? meRecord.username
            : typeof meRecord?.user_name === "string"
              ? meRecord.user_name
              : null;

        const normalizedUserId = resolvedUserId !== null && resolvedUserId !== undefined ? String(resolvedUserId) : null;
        setCurrentUserId(normalizedUserId);
        setCurrentUsername(resolvedUsername);
        setActiveLocaleScope({ userId: normalizedUserId, username: resolvedUsername });
        const backendCountry = isSupportedCountry(meRecord?.streaming_country)
          ? normalizeCountry(meRecord?.streaming_country)
          : isSupportedCountry(meRecord?.country)
            ? normalizeCountry(meRecord?.country)
            : null;
        if (!hasStoredCountryPreference() && backendCountry) setStreamingCountry(backendCountry);
        setStreamingCountryError("");
        const storedVersion = typeof window !== "undefined" ? window.localStorage.getItem("profile_avatar_updated_at") : null;
        setProfileAvatarVersion(storedVersion);
        await refreshNotifications();
      } catch (avatarError) {
        console.warn("No se pudo cargar el avatar del perfil para feed:", avatarError);
        setProfileAvatarUrl(null);
        setCurrentUserId(null);
        setCurrentUsername(null);
        setUnreadNotificationsCount(0);
        setNotificationItems([]);
      }
    };

    void loadProfileContext();
  }, [refreshNotifications, setStreamingCountry]);

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

        if (!isDesktopGuest && loadPersonalizedError instanceof ApiError && loadPersonalizedError.status === 401) {
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
    [isDesktopGuest, router],
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
    setIsDirectorBoardOpen((current) => {
      const nextState = !current;
      if (nextState) {
        setIsMobileSearchOpen(false);
        setIsNotificationPanelOpen(false);
      }
      return nextState;
    });
  }, []);

  const handleDirectorBoardClose = useCallback(() => {
    setIsDirectorBoardOpen(false);
  }, []);

  const handleLogout = useCallback(() => {
    setActiveLocaleScope(null);
    clearToken();
    router.replace("/login");
  }, [router]);

  const handleBellClick = useCallback(() => {
    setIsNotificationPanelOpen((current) => {
      const nextState = !current;
      if (nextState) {
        setIsMobileSearchOpen(false);
        setIsDirectorBoardOpen(false);
        void refreshNotifications();
      }
      return nextState;
    });
  }, [refreshNotifications]);

  const handleMobileSearchToggle = useCallback(() => {
    setIsMobileSearchOpen((current) => {
      const nextState = !current;
      if (nextState) {
        setIsNotificationPanelOpen(false);
        setIsDirectorBoardOpen(false);
      }
      return nextState;
    });
  }, []);

  const handleStreamingCountryChange = useCallback(
    async (nextCountry: StreamingCountry) => {
      if (nextCountry === streamingCountry || isSavingStreamingCountry) return;

      setStreamingCountry(nextCountry);
      setStreamingCountryError("");
      setIsSavingStreamingCountry(true);

      try {
        if (isDesktopGuest) return;
        await apiFetch("/me/", {
          method: "PATCH",
          body: JSON.stringify({ streaming_country: nextCountry }),
        });
      } catch (streamingCountryPatchError) {
        console.warn("No se pudo actualizar streaming_country en el backend; se conservó la selección local.", streamingCountryPatchError);
      } finally {
        setIsSavingStreamingCountry(false);
      }
    },
    [isDesktopGuest, isSavingStreamingCountry, setStreamingCountry, streamingCountry],
  );

  const handleNotificationItemClick = useCallback(
    async (item: MyNotificationItem) => {
      setIsNotificationPanelOpen(false);
      if (debugNotificationTarget) {
        console.debug("[NotificationTarget][NORMALIZED ITEM]", {
          id: item.id,
          type: item.type,
          targetTab: item.targetTab,
          movieId: item.movieId,
          commentId: item.commentId,
          videoCommentId: item.videoCommentId,
          reactionType: item.reactionType,
        });
      }
      const targetRoute = buildNotificationTargetRoute(item);

      const isPublicCommentReaction = item.type === "public_comment_reaction" && item.commentId !== null;
      const isDirectedCommentReaction =
        (item.type === "private_comment_reaction" || item.type === "directed_comment_reaction") &&
        item.directedCommentId !== null;
      const isNewDirectedMessage = item.type === "private_message" && item.directedCommentId !== null;
      const isReceivedCommentReaction =
        (item.reactionType === "like" || item.reactionType === "dislike") &&
        item.movieId !== null &&
        (isPublicCommentReaction || isDirectedCommentReaction);
      const shouldOpenCommentModal = item.movieId !== null && (isReceivedCommentReaction || isNewDirectedMessage);

      if (shouldOpenCommentModal) {
        try {
          const movieId = String(item.movieId);
          const commentId = String(isPublicCommentReaction ? item.commentId : item.directedCommentId);
          const fallbackType = isPublicCommentReaction ? "public" : "directed";
          const [rawComment, rawMovie] = await Promise.all([
            apiFetch(buildCommentDetailEndpoint(commentId)),
            apiFetch(buildMovieDetailEndpoint(movieId, MOVIE_DETAIL_ENDPOINT_TEMPLATE)),
          ]);
          const rawCommentRecord = rawComment && typeof rawComment === "object" && !Array.isArray(rawComment)
            ? rawComment as Record<string, unknown>
            : null;
          const rawCommentData = rawCommentRecord?.data && typeof rawCommentRecord.data === "object" && !Array.isArray(rawCommentRecord.data)
            ? rawCommentRecord.data as Record<string, unknown>
            : null;
          const commentRecord = rawCommentData?.comment ?? rawCommentRecord?.comment ?? rawCommentData ?? rawComment;
          const comment = parseComments([commentRecord], fallbackType)[0];
          if (!comment || String(comment.id) !== commentId || !rawMovie || typeof rawMovie !== "object") throw new Error("notification-comment-not-found");
          setNotificationComment({
            comment,
            movie: normalizeMovie(rawMovie as Record<string, unknown>, 0),
            allowReactions: fallbackType === "directed" && comment.type === "directed" && item.directedCommentId !== null,
            canDirectReply: isNewDirectedMessage,
            replyRecipient: isNewDirectedMessage && item.actorId !== null && item.actorUsername
              ? { id: item.actorId, username: item.actorUsername }
              : null,
          });
          if (isRealNotificationId(item.id)) await markNotificationsAsReadBatch([item.id]);
          setNotificationItems((current) => current.filter((notificationItem) => notificationItem.id !== item.id));
          setUnreadNotificationsCount((current) => Math.max(0, current - 1));
          void refreshNotifications();
          return;
        } catch (error) {
          console.warn("No se pudo abrir el comentario de la notificación en el Feed.", error);
          return;
        }
      }

      const isReceivedVideoReaction =
        item.type === "video_comment_reaction" &&
        (item.reactionType === "like" || item.reactionType === "dislike") &&
        item.movieId !== null &&
        item.videoCommentId !== null;

      if (isReceivedVideoReaction) {
        try {
          const movieId = String(item.movieId);
          const [video, rawMovie] = await Promise.all([
            resolveVideoReactionComment(movieId, String(item.videoCommentId)),
            apiFetch(buildMovieDetailEndpoint(movieId, MOVIE_DETAIL_ENDPOINT_TEMPLATE)),
          ]);
          if (!video || !rawMovie || typeof rawMovie !== "object") throw new Error("notification-video-not-found");
          setNotificationVideo({ video, movie: normalizeMovie(rawMovie as Record<string, unknown>, 0), reaction: item.reactionType! });
          if (isRealNotificationId(item.id)) await markNotificationsAsReadBatch([item.id]);
          setNotificationItems((current) => current.filter((notificationItem) => notificationItem.id !== item.id));
          setUnreadNotificationsCount((current) => Math.max(0, current - 1));
          void refreshNotifications();
          return;
        } catch (error) {
          console.warn("No se pudo abrir el video de la notificación en el Feed.", error);
          return;
        }
      }
      if (item.type === "public_comment_reaction") {
        console.log("[PUBLIC COMMENT NOTIFICATION REAL]", {
          item,
          type: item.type,
          movieId: item.movieId,
          commentId: item.commentId,
          reactionType: item.reactionType,
          targetTab: item.targetTab,
          builtRoute: targetRoute,
        });
        if (process.env.NODE_ENV !== "production" && (item.commentId === null || item.commentId === "")) {
          console.error("[PUBLIC COMMENT ROUTING ERROR] Missing commentId", item);
        }
      }
      if (item.type === "video_comment_reaction") {
        console.log("[VIDEO COMMENT NOTIFICATION REAL]", {
          item,
          movieId: item.movieId,
          videoCommentId: item.videoCommentId,
          reactionType: item.reactionType,
          builtRoute: targetRoute,
        });
        if (
          process.env.NODE_ENV !== "production" &&
          (item.videoCommentId === null || item.videoCommentId === "")
        ) {
          console.error("[VIDEO COMMENT ROUTING ERROR] Missing videoCommentId", item);
        }
      }
      const destination = (() => {
        if (!debugNotificationTarget || !targetRoute.startsWith("/movies/")) return targetRoute;
        const url = new URL(targetRoute, window.location.origin);
        url.searchParams.set("debugNotificationTarget", "1");
        return `${url.pathname}${url.search}${url.hash}`;
      })();

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
        if (debugNotificationTarget) {
          const destinationUrl = new URL(destination, window.location.origin);
          console.debug("[NotificationTarget][FEED CLICK]", {
            notificationId: item.id,
            notificationType: item.type,
            notificationTargetTab: item.targetTab,
            notificationReactionType: item.reactionType,
            notificationObjectCommentId: item.commentId,
            notificationObjectVideoCommentId: item.videoCommentId,
            movieId: item.movieId,
            target: destinationUrl.searchParams.get("target"),
            targetId: destinationUrl.searchParams.get("targetId"),
            section: destinationUrl.searchParams.get("section"),
            commentId: destinationUrl.searchParams.get("commentId"),
            reaction: destinationUrl.searchParams.get("reaction"),
            destinationUrl: destination,
          });
        }
        router.push(destination);
      }
    },
    [debugNotificationTarget, refreshNotifications, router],
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
    if (!isMobileSearchOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!mobileSearchContainerRef.current) return;
      if (!(event.target instanceof Node)) return;
      if (mobileSearchContainerRef.current.contains(event.target) || mobileNavRef.current?.contains(event.target)) return;
      setIsMobileSearchOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isMobileSearchOpen]);

  useEffect(() => {
    if (!isNotificationPanelOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!(event.target instanceof Node)) return;
      if (
        desktopNotificationContainerRef.current?.contains(event.target) ||
        mobileNotificationContainerRef.current?.contains(event.target) ||
        mobileNavRef.current?.contains(event.target)
      ) return;
      setIsNotificationPanelOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
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



  if (loading) {
    return <div className="p-6 text-zinc-100">Cargando feed principal...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-400">{error}</div>;
  }

  return (
    <main className="feed-tablet-framing min-h-screen bg-black">
      <Suspense fallback={null}>
        <FeedDebugSearchParamsBridge onChange={setDebugNotificationTarget} />
      </Suspense>
      <div className="feed-shell mx-auto w-full max-w-[1400px] space-y-14 px-4 py-8 md:px-8">
        <div className="feed-header sticky top-0 z-40 -mx-2 space-y-3 rounded-3xl border border-white/10 bg-black/80 px-2 py-3 backdrop-blur-md md:mx-0 xl:space-y-3 xl:px-0 relative">
          <div className="flex items-center gap-3 xl:block">
            <div className="feed-header__brand relative z-30 flex min-w-0 flex-none items-start justify-start overflow-visible bg-transparent pl-1 xl:absolute xl:left-0 xl:top-2 xl:h-20 xl:w-[280px] xl:justify-center xl:pl-8">
              <MobileFeedDefaultLogo branding={branding} onClick={handleMobileLogoClick} />
              <AppLogo
                branding={branding}
                slot="feed_logo_url"
                alt="QNext"
                className="feed-header__logo hidden h-24 w-auto max-w-[260px] translate-y-1 object-contain object-left xl:block"
                textClassName="hidden bg-gradient-to-r from-sky-100 via-blue-300 to-slate-200 bg-clip-text font-bold uppercase tracking-[0.18em] text-transparent xl:block xl:text-xs"
                eager
                fallbackText="QNext"
              />
            </div>
            <div className="feed-mobile-only relative z-50 flex flex-1 justify-center xl:hidden [&>div]:w-[4.25rem]">
              <DirectorBoardMenu
                locale={locale}
                mobileIconOnly
                mobileTourTarget="feed-menu-mobile"
                isOpen={isDirectorBoardOpen}
                onToggle={handleDirectorBoardToggle}
                onClose={handleDirectorBoardClose}
                onCloseSession={handleLogout}
                onPersonalDataClick={() => router.push("/settings/personal-data")}
                onPrivacySecurityClick={() => router.push("/privacy-security")}
                onPoliciesClick={() => router.push("/policies")}
              />
            </div>
            <div className="feed-mobile-only relative z-50 flex flex-none justify-end xl:hidden">
              <StreamingCountrySelector
                country={streamingCountry}
                onCountryChange={handleStreamingCountryChange}
                disabled={isSavingStreamingCountry}
                error={streamingCountryError}
                compact
                iconOnly
              />
            </div>
            <div className={`feed-header__account feed-desktop-only pointer-events-auto relative z-[60] hidden shrink-0 pr-0 xl:pointer-events-none xl:absolute xl:right-4 xl:top-6 xl:block xl:pr-1 ${isNotificationPanelOpen ? "xl:z-[90]" : ""}`}>
              {isDesktopGuest ? <div className="pointer-events-auto mt-3 flex w-[246px] items-center justify-end gap-5 [&_svg]:h-9 [&_svg]:w-9"><GuestSignupRec /><div className="scale-105"><StreamingCountrySelector country={streamingCountry} onCountryChange={handleStreamingCountryChange} /></div></div> : (
              <div className="pointer-events-auto relative flex w-auto flex-col items-end xl:w-[198px] xl:items-center">
                <div className="flex items-center gap-2">
                <button
                  data-tour="feed-notifications"
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
                    ref={desktopNotificationContainerRef}
                    className="absolute right-14 top-0 z-[95] w-[310px] rounded-2xl border border-white/15 bg-zinc-950/95 p-3 shadow-[0_28px_40px_rgba(0,0,0,0.55)] backdrop-blur-md md:right-16"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">{translate(locale, "notificationsTitle")}</p>
                      {notificationItems.length > 0 ? (
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsAsRead}
                          className="text-[11px] font-semibold text-blue-300 transition hover:text-blue-200"
                        >
                          {translate(locale, "notificationsMarkAllRead")}
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
                            <p className="text-sm text-zinc-100">{translateNotificationText(locale, item.text)}</p>
                            <p className="mt-1 text-[11px] text-zinc-500">
                              {item.targetTab === "friend_requests_pending"
                                ? translate(locale, "notificationsGoToPending")
                                : item.targetTab === "activity"
                                  ? translate(locale, "notificationsGoToMyActivity")
                                  : translate(locale, "notificationsGoToPrivateInbox")}
                            </p>
                          </button>
                        ))
                      ) : (
                        <p className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
                          {translate(locale, "notificationsEmpty")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}

                <UserProfilePlaceholderButton
                  tourTarget="feed-profile"
                  onClick={() => router.push("/profile-feed")}
                  avatarUrl={profileAvatarUrl}
                  avatarAlt="Ir a perfil"
                  avatarVersion={profileAvatarVersion}
                />
                <StreamingCountrySelector
                  country={streamingCountry}
                  onCountryChange={handleStreamingCountryChange}
                  disabled={isSavingStreamingCountry}
                  error={streamingCountryError}
                />
              </div>
              </div>
              )}
            </div>
          </div>

          <div className="feed-header__search-row feed-desktop-only hidden items-center justify-between gap-3 xl:block">
            <SearchBar
              tourTarget="feed-search"
              locale={locale}
              className="feed-header__search mx-0 w-[52%] min-w-0 rounded-full border-2 border-white/70 bg-zinc-900/80 p-1.5 sm:w-[58%] xl:mx-auto xl:w-full xl:max-w-2xl"
              inputClassName="rounded-full border-2 border-white/60 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
              showSearchIcon
              inlineAutocomplete
            />
            {!isDesktopGuest ? <div data-tour="feed-menu" className="feed-header__menu relative z-50 shrink-0 [&>div]:w-[8.5rem] sm:[&>div]:w-[9.5rem] xl:absolute xl:right-4 xl:top-[5.75rem] xl:[&>div]:w-[198px]">
              <DirectorBoardMenu
                locale={locale}
                isOpen={isDirectorBoardOpen}
                onToggle={handleDirectorBoardToggle}
                onClose={handleDirectorBoardClose}
                onCloseSession={handleLogout}
                onPersonalDataClick={() => router.push("/settings/personal-data")}
                onPrivacySecurityClick={() => router.push("/privacy-security")}
                onPoliciesClick={() => router.push("/policies")}
              />
            </div> : null}
          </div>

          <GenreChips
            tourTarget="feed-genres"
            locale={locale}
            genres={FEED_GENRE_OPTIONS}
            selectedGenres={selectedGenres}
            onToggleGenre={toggleGenreSelection}
            onClearSelection={() => setSelectedGenres([])}
            showAllChip={selectedGenres.length > 0}
            className="feed-header__genres w-full justify-start overflow-hidden xl:justify-center"
            chipsContainerClassName="w-full flex-none justify-start overflow-x-auto overflow-y-hidden pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:w-auto xl:flex-initial xl:justify-center xl:overflow-visible"
            chipClassName="border-2"
            selectedChipClassName="border-blue-300/90 bg-gradient-to-b from-blue-300/25 to-blue-600/40 text-blue-50 shadow-[0_4px_14px_rgba(56,189,248,0.35)]"
            unselectedChipClassName="border-white/70 bg-zinc-900 text-zinc-200 hover:border-white"
            disabledChipClassName="border-zinc-700 bg-zinc-900/80 text-zinc-500"
            isGenreDisabled={shouldDisableGenreChip}
          />

          <p className="feed-header__genre-note text-center text-xs text-zinc-500">{translate(locale, "chooseGenres")}</p>
        </div>

        <section className="space-y-5">
          <WeeklyRecommendationsSection desktopGuest={isDesktopGuest} weeklyMovies={weeklyMovies} branding={branding} currentUserId={currentUserId} currentUsername={currentUsername} onRated={updateWeeklyMovieRating} listedMovieIds={listedMovieIds} onToggleMyList={handleToggleMyList} recommendedMovieIds={recommendedMovieIds} onToggleMyRecommendations={handleToggleMyRecommendations} trailerHoverDelayMs={MAIN_FEED_TRAILER_HOVER_DELAY_MS} />
        </section>

        <section className="space-y-5 bg-black pb-8">
          <div className="mx-auto w-full max-w-[860px] px-3 sm:px-4">
            <h2 className="text-xl font-semibold text-zinc-100">{translate(locale, "yourWatchlist")}</h2>
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
                  guestActions={isDesktopGuest}
                  ratingReadOnly={isDesktopGuest}
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
                  trailerHoverDelayMs={MAIN_FEED_TRAILER_HOVER_DELAY_MS}
                  branding={branding}
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

      {isMobileSearchOpen ? (
        <div ref={mobileSearchContainerRef} className="feed-mobile-search-modal fixed inset-x-4 bottom-24 z-[65] rounded-3xl border border-white/15 bg-zinc-950/95 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl xl:hidden">
          <SearchBar
            locale={locale}
            className="w-full rounded-full border-2 border-white/60 bg-zinc-900/90 p-1.5"
            inputClassName="rounded-full border-2 border-white/50 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
            showSearchIcon
            inlineAutocomplete
            autocompletePlacement="above"
          />
        </div>
      ) : null}

      <nav ref={mobileNavRef} className={`feed-mobile-only fixed inset-x-4 bottom-4 z-[60] flex items-center justify-around rounded-full border border-white/10 bg-zinc-900/85 px-5 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all duration-300 ease-out xl:hidden ${isMobileBottomNavVisible || isMobileOnboardingNavForced ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[calc(100%+1.5rem)] opacity-0"}`} aria-label="Acciones principales del feed">
        <button
          data-tour-mobile="feed-search-mobile"
          type="button"
          aria-label="Buscar películas"
          onClick={handleMobileSearchToggle}
          className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
            <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            <circle cx="11" cy="11" r="7" />
          </svg>
        </button>
        <UserProfilePlaceholderButton
          mobileTourTarget="feed-profile-mobile"
          onClick={() => router.push("/profile-feed")}
          avatarUrl={profileAvatarUrl}
          avatarAlt="Ir a perfil"
          avatarVersion={profileAvatarVersion}
        />
        <div className="relative">
          <button
            data-tour-mobile="feed-notifications-mobile"
            type="button"
            aria-label="Ver notificaciones"
            onClick={handleBellClick}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-zinc-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6">
              <path d="M15 18H4a1 1 0 0 1-.77-1.64L6 13V8a6 6 0 1 1 12 0v5l2.77 3.36A1 1 0 0 1 20 18h-1" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 21a3 3 0 0 0 6 0" strokeLinecap="round" />
            </svg>
            {unreadNotificationsCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-400 px-1 text-[10px] font-semibold leading-none text-zinc-950">
                {unreadNotificationsCount}
              </span>
            ) : null}
          </button>
        </div>
      </nav>

      {isNotificationPanelOpen ? (
        <div ref={mobileNotificationContainerRef} className="feed-mobile-search-modal fixed inset-x-4 bottom-24 z-[70] rounded-2xl border border-white/15 bg-zinc-950/95 p-3 shadow-[0_28px_40px_rgba(0,0,0,0.55)] backdrop-blur-md xl:hidden">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">{translate(locale, "notificationsTitle")}</p>
            {notificationItems.length > 0 ? (
              <button type="button" onClick={handleMarkAllNotificationsAsRead} className="text-[11px] font-semibold text-blue-300 transition hover:text-blue-200">
                {translate(locale, "notificationsMarkAllRead")}
              </button>
            ) : null}
          </div>
          <div className="activity-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {notificationItems.length > 0 ? (
              notificationItems.map((item) => (
                <button key={String(item.id)} type="button" onClick={() => handleNotificationItemClick(item)} className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-left transition hover:border-blue-300/50 hover:bg-zinc-800">
                  <p className="text-sm text-zinc-100">{translateNotificationText(locale, item.text)}</p>
                </button>
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">{translate(locale, "notificationsEmpty")}</p>
            )}
          </div>
        </div>
      ) : null}
      {notificationVideo ? (
        <VideoReactionViewer
          video={notificationVideo.video}
          reaction={notificationVideo.reaction}
          moviePoster={notificationVideo.movie.posterUrl}
          movieTitle={resolveMovieTitles(locale, notificationVideo.movie.titleSpanish, notificationVideo.movie.titleEnglish, notificationVideo.movie.displayTitle).primary}
          onClose={() => setNotificationVideo(null)}
          onMovieOpen={() => {
            const movieId = String(notificationVideo.movie.id);
            setNotificationVideo(null);
            router.push(`/movies/${encodeURIComponent(movieId)}`);
          }}
        />
      ) : null}
      {notificationComment ? (
        <NotificationCommentViewer
          comment={notificationComment.comment}
          movie={notificationComment.movie}
          movieTitle={resolveMovieTitles(locale, notificationComment.movie.titleSpanish, notificationComment.movie.titleEnglish, notificationComment.movie.displayTitle).primary}
          locale={locale}
          allowReactions={notificationComment.allowReactions}
          canDirectReply={notificationComment.canDirectReply}
          replyRecipient={notificationComment.replyRecipient}
          authenticatedUserId={currentUserId}
          onClose={() => setNotificationComment(null)}
          onMovieOpen={() => {
            const movieId = String(notificationComment.movie.id);
            setNotificationComment(null);
            router.push(`/movies/${encodeURIComponent(movieId)}`);
          }}
        />
      ) : null}
    </main>
  );
}
