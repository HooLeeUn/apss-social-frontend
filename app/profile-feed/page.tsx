"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UIEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import FavoriteMoviesBlock from "../../components/profile-feed/FavoriteMoviesBlock";
import MyActivityColumn from "../../components/profile-feed/MyActivityColumn";
import ProfileIdentityCard from "../../components/profile-feed/ProfileIdentityCard";
import SocialActivityTabsBlock from "../../components/profile-feed/SocialActivityTabsBlock";
import TopUsersSection from "../../components/profile-feed/TopUsersSection";
import EmptyStatePanel from "../../components/profile-feed/EmptyStatePanel";
import MobileDarkSelect from "../../components/MobileDarkSelect";
import MyListIcon from "../../components/MyListIcon";
import ProfileQuickNavigation, { profileQuickNavigationIcons } from "../../components/profile-feed/ProfileQuickNavigation";
import {
  acceptFriendship,
  cancelFriendRequest,
  getMyFriendRequests,
  getMyProfile,
  getTopFollowing,
  getTopFriends,
  markNotificationsContextRead,
  rejectFriendship,
  searchUsers,
} from "../../lib/profile-feed/adapters";
import { FriendRequest, SocialUser } from "../../lib/profile-feed/types";
import { getPersonalData } from "../../lib/personal-data";
import { getProfilePrivacySettings } from "../../lib/privacy";
import { useAppBranding } from "../../hooks/useAppBranding";
import { useI18n } from "../../hooks/useI18n";
import { onboardingPrepareStepEventName, type OnboardingPrepareAction } from "../../lib/onboarding/types";
import { interpolate, resolveMovieTitles } from "../../lib/i18n";
import { getMyMovieList, getMyMovieRecommendations, Movie, removeMovieFromMyList, removeMovieFromMyRecommendations } from "../../lib/movies";

const MY_LIST_IDS_STORAGE_KEY = "my_list_movie_ids";
type QuickTarget = "following" | "friends" | "activity" | "my-list" | "recommended" | "following-activity";
const debugFriendRequestNavigation = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";

function logFriendRequestNavigation(event: string, details: Record<string, unknown> = {}) {
  if (!debugFriendRequestNavigation) return;
  console.debug("[friend-request-navigation]", { event, ...details });
}

function normalizeUsername(username: string | null | undefined): string {
  return (username || "").trim().toLocaleLowerCase();
}

function mergeRelationState(
  user: SocialUser,
  friendsByUsername: Map<string, SocialUser>,
  followingByUsername: Map<string, SocialUser>,
  pendingByUsername: Map<string, FriendRequest>,
): SocialUser {
  const key = normalizeUsername(user.username);
  const friend = friendsByUsername.get(key);
  const followed = followingByUsername.get(key);
  const pending = pendingByUsername.get(key);

  return {
    ...user,
    followersCount: user.followersCount ?? friend?.followersCount ?? followed?.followersCount ?? pending?.user.followersCount ?? null,
    firstName: user.firstName ?? friend?.firstName ?? followed?.firstName ?? pending?.user.firstName ?? null,
    lastName: user.lastName ?? friend?.lastName ?? followed?.lastName ?? pending?.user.lastName ?? null,
    avatarUrl: user.avatarUrl ?? friend?.avatarUrl ?? followed?.avatarUrl ?? pending?.user.avatarUrl ?? null,
    isFollowing: followed ? true : user.isFollowing,
    friendshipStatus: friend ? "friends" : pending?.direction === "sent" ? "sent_pending" : pending?.direction === "received" ? "received_pending" : user.friendshipStatus,
  };
}

function hasPriorityRelation(user: SocialUser): boolean {
  return user.friendshipStatus === "friends" || user.isFollowing === true;
}

function prioritizeRelatedUsers(users: SocialUser[]): SocialUser[] {
  return [...users].sort((left, right) => {
    const leftPriority = hasPriorityRelation(left) ? 0 : 1;
    const rightPriority = hasPriorityRelation(right) ? 0 : 1;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return (right.followersCount ?? 0) - (left.followersCount ?? 0);
  });
}

function UserSearchResultRow({ user }: { user: SocialUser }) {
  const { t } = useI18n();
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const displayName = fullName || (user.displayName && user.displayName !== user.username ? user.displayName : "");
  const followersCopy =
    typeof user.followersCount === "number"
      ? user.followersCount === 0
        ? t("profileFeedNoFollowers")
        : user.followersCount === 1
          ? t("profileFeedFollowedByOne")
          : interpolate(t("profileFeedFollowedByMany"), { count: user.followersCount })
      : t("profileFeedNoFollowers");
  const initials = user.username.slice(0, 2).toUpperCase();

  const statusBadges = [
    user.friendshipStatus === "friends" ? { label: t("profileFeedFriends"), className: "border-violet-300/40 bg-violet-600/25 text-violet-100" } : null,
    user.isFollowing ? { label: t("profileFeedFollowing"), className: "border-violet-300/40 bg-violet-600/25 text-violet-100" } : null,
    user.friendshipStatus === "sent_pending" ? { label: t("profileFeedRequestSent"), className: "border-blue-300/40 bg-blue-600/25 text-blue-100" } : null,
    user.friendshipStatus === "received_pending" ? { label: t("profileFeedRequestReceived"), className: "border-blue-300/40 bg-blue-600/25 text-blue-100" } : null,
  ].filter((badge): badge is { label: string; className: string } => Boolean(badge));

  return (
    <Link
      href={`/users/${encodeURIComponent(user.username)}`}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-zinc-950/70 px-4 py-3 transition hover:border-blue-300/30 hover:bg-zinc-900/90 focus-visible:border-blue-300/50 focus-visible:outline-none"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={`Avatar de ${user.username}`} className="h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-zinc-900 text-xs font-semibold text-zinc-200">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-4">
            <p className="shrink-0 truncate text-sm font-semibold text-zinc-100 group-hover:text-blue-100">@{user.username}</p>
            {displayName ? <p className="min-w-0 truncate text-xs font-medium text-[#8fb6d9] group-hover:text-[#a9cbe6]">{displayName}</p> : null}
          </div>
          <p className="text-xs text-zinc-500">{followersCopy}</p>
        </div>
      </div>
      {statusBadges.length > 0 ? (
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {statusBadges.map((badge) => (
            <span key={badge.label} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}


function ProfileFeedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branding = useAppBranding();
  const { locale, t } = useI18n();
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<SocialUser[]>([]);
  const [userSearchNext, setUserSearchNext] = useState<string | null>(null);
  const [loadingUserSearch, setLoadingUserSearch] = useState(false);
  const [loadingMoreUserSearch, setLoadingMoreUserSearch] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);
  const [isUserSearchPanelOpen, setIsUserSearchPanelOpen] = useState(false);
  const latestUserSearchRequest = useRef(0);
  const userSearchContainerRef = useRef<HTMLElement | null>(null);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const [pendingRequestsError, setPendingRequestsError] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<SocialUser | null>(null);
  const [loadingProfileUser, setLoadingProfileUser] = useState(true);
  const requestedTab = searchParams.get("tab");
  const requestedFriendsTab = searchParams.get("friendsTab");
  const [myListMovies, setMyListMovies] = useState<Movie[]>([]);
  const [loadingMyList, setLoadingMyList] = useState(true);
  const [recommendedMovies, setRecommendedMovies] = useState<Movie[]>([]);
  const [loadingRecommendedMovies, setLoadingRecommendedMovies] = useState(true);
  const [activeListView, setActiveListView] = useState<"my-list" | "recommended">("my-list");
  const [activeMobileProfileFeedSlide, setActiveMobileProfileFeedSlide] = useState(0);
  const mobileProfileFeedCarouselRef = useRef<HTMLDivElement | null>(null);
  const connectionsSearchSectionRef = useRef<HTMLElement | null>(null);
  const activityAndListsPanelRef = useRef<HTMLDivElement | null>(null);
  const followingActivityPanelRef = useRef<HTMLDivElement | null>(null);
  const [pendingNavigationTarget, setPendingNavigationTarget] = useState<QuickTarget | null>(null);
  const [connectionBlockRequest, setConnectionBlockRequest] = useState<{ block: 0 | 1; id: number } | null>(null);
  const [connectionViewRequest, setConnectionViewRequest] = useState<{ view: "friends" | "pending"; id: number } | null>(null);
  const [pendingFriendRequestNavigation, setPendingFriendRequestNavigation] = useState(false);
  const friendRequestNavigationStarted = useRef(false);
  const friendRequestNavigationCompleted = useRef(false);
  const [activeConnectionBlock, setActiveConnectionBlock] = useState<0 | 1>(0);
  const [activeFriendsView, setActiveFriendsView] = useState<"friends" | "pending">("friends");
  const navigationRequestId = useRef(0);
  const observedFriendsTab = useRef<string | null>(null);
  const [activityTabRequest, setActivityTabRequest] = useState<{ tab: "activity" | "messages" | "rated"; id: number } | null>(null);
  const [forceMobileQuickNavigation, setForceMobileQuickNavigation] = useState(false);
  const mobileOnboardingSnapshotRef = useRef<{ listView: "my-list" | "recommended"; slide: number } | null>(null);
  const requestedPrivateInboxTab = requestedTab === "private_inbox" || requestedTab === "messages";
  const initialConnectionView = "friends";
  const canRenderPrivateInbox = profileUser?.friendRequestsRestricted === false;
  const initialActivityTab = requestedPrivateInboxTab && canRenderPrivateInbox ? "messages" : "activity";
  const shouldShowRestrictedFriendsEmptyState =
    profileUser?.friendRequestsRestricted === true && profileUser.profileVisibility === "public";
  const receivedPendingRequestsCount = useMemo(
    () => pendingRequests.filter((request) => request.direction === "received").length,
    [pendingRequests],
  );

  useEffect(() => {
    const prepareOnboardingStep = (event: Event) => {
      if (window.matchMedia("(max-width: 1279px)").matches) return;
      const action = (event as CustomEvent<{ action?: OnboardingPrepareAction }>).detail?.action;
      const requestId = ++navigationRequestId.current;
      if (action === "profile-activity") setActivityTabRequest({ tab: "activity", id: requestId });
      if (action === "profile-inbox") setActivityTabRequest({ tab: "messages", id: requestId });
      if (action === "profile-ratings") setActivityTabRequest({ tab: "rated", id: requestId });
      if (action === "profile-list") setActiveListView("my-list");
      if (action === "profile-recommendations") setActiveListView("recommended");
    };
    window.addEventListener(onboardingPrepareStepEventName, prepareOnboardingStep);
    return () => window.removeEventListener(onboardingPrepareStepEventName, prepareOnboardingStep);
  }, []);

  useEffect(() => {
    if (requestedFriendsTab === "pending" && observedFriendsTab.current !== requestedFriendsTab) {
      observedFriendsTab.current = requestedFriendsTab;
      friendRequestNavigationStarted.current = false;
      friendRequestNavigationCompleted.current = false;
      setPendingFriendRequestNavigation(true);
      logFriendRequestNavigation("parameter-detected", { friendsTabParam: requestedFriendsTab });
    } else if (requestedFriendsTab !== "pending") {
      observedFriendsTab.current = requestedFriendsTab;
    }
  }, [requestedFriendsTab]);

  const friendsByUsername = useMemo(
    () => new Map(friends.map((user) => [normalizeUsername(user.username), user])),
    [friends],
  );
  const followingByUsername = useMemo(
    () => new Map(following.map((user) => [normalizeUsername(user.username), user])),
    [following],
  );
  const pendingByUsername = useMemo(
    () => new Map(pendingRequests.map((request) => [normalizeUsername(request.user.username), request])),
    [pendingRequests],
  );

  const mergeUserSearchResults = useCallback(
    (users: SocialUser[]) =>
      prioritizeRelatedUsers(
        users.map((user) => mergeRelationState(user, friendsByUsername, followingByUsername, pendingByUsername)),
      ),
    [friendsByUsername, followingByUsername, pendingByUsername],
  );

  const loadFollowing = useCallback(async () => {
    setLoadingFollowing(true);
    setFollowingError(null);
    try {
      const topFollowing = await getTopFollowing();
      setFollowing(topFollowing);
    } catch {
      setFollowing([]);
      setFollowingError("No se pudieron cargar tus seguidos.");
    } finally {
      setLoadingFollowing(false);
    }
  }, []);

  const loadFriends = useCallback(async () => {
    setLoadingFriends(true);
    setFriendsError(null);
    try {
      const topFriends = await getTopFriends();
      setFriends(topFriends);
    } catch {
      setFriends([]);
      setFriendsError("No se pudieron cargar tus amigos.");
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  const loadPendingRequests = useCallback(async () => {
    setLoadingPendingRequests(true);
    setPendingRequestsError(null);
    try {
      const requests = await getMyFriendRequests();
      setPendingRequests(requests);
    } catch {
      setPendingRequests([]);
      setPendingRequestsError("No se pudieron cargar tus solicitudes pendientes.");
    } finally {
      setLoadingPendingRequests(false);
    }
  }, []);

  useEffect(() => {
    void loadFollowing();
    void loadFriends();
    void loadPendingRequests();
  }, [loadFollowing, loadFriends, loadPendingRequests]);

  useEffect(() => {
    let isCurrent = true;

    const loadOwnProfileData = async () => {
      try {
        const [myProfile, personalData, privacySettings] = await Promise.all([
          getMyProfile(),
          getPersonalData(),
          getProfilePrivacySettings(),
        ]);
        if (!isCurrent) return;
        setProfileUser({
          id: myProfile?.id ?? "me",
          username: myProfile?.username ?? "usuario",
          displayName: myProfile?.displayName ?? null,
          avatarUrl: personalData.avatar ?? myProfile?.avatarUrl ?? null,
          followersCount: myProfile?.followersCount ?? null,
          firstName: personalData.first_name || myProfile?.firstName || null,
          lastName: personalData.last_name || myProfile?.lastName || null,
          age: personalData.age ?? myProfile?.age ?? null,
          ageVisible: personalData.birth_date_visible,
          genderIdentity: personalData.gender_identity ?? myProfile?.genderIdentity ?? null,
          genderIdentityVisible: personalData.gender_identity_visible,
          profileVisibility: privacySettings.visibility ?? myProfile?.profileVisibility ?? null,
          friendRequestsRestricted: privacySettings.friendRequestsRestricted ?? myProfile?.friendRequestsRestricted ?? null,
        });
      } catch {
        const [myProfile, privacySettings] = await Promise.all([
          getMyProfile().catch(() => null),
          getProfilePrivacySettings().catch(() => null),
        ]);
        if (!isCurrent) return;
        setProfileUser(
          myProfile || privacySettings
            ? {
                ...(myProfile ?? {
                  id: "me",
                  username: "usuario",
                  displayName: null,
                  avatarUrl: null,
                  followersCount: null,
                }),
                profileVisibility: privacySettings?.visibility ?? myProfile?.profileVisibility ?? null,
                friendRequestsRestricted: privacySettings?.friendRequestsRestricted ?? myProfile?.friendRequestsRestricted ?? null,
              }
            : null,
        );
      } finally {
        if (isCurrent) setLoadingProfileUser(false);
      }
    };

    void loadOwnProfileData();
    return () => {
      isCurrent = false;
    };
  }, []);

  const handleAcceptFriendRequest = useCallback(async (request: FriendRequest) => {
    setPendingRequests((current) => current.filter((item) => item.id !== request.id));
    setFriends((current) => [request.user, ...current.filter((user) => user.username !== request.user.username)]);
    try {
      await acceptFriendship(request.id);
    } catch {
      setFriends((current) => current.filter((user) => user.username !== request.user.username));
      setPendingRequests((current) => [request, ...current]);
    }
  }, []);

  const handleRejectFriendRequest = useCallback(async (request: FriendRequest) => {
    setPendingRequests((current) => current.filter((item) => item.id !== request.id));
    try {
      await rejectFriendship(request.id);
    } catch {
      setPendingRequests((current) => [request, ...current]);
    }
  }, []);

  const handleCancelFriendRequest = useCallback(async (request: FriendRequest) => {
    setPendingRequests((current) => current.filter((item) => item.id !== request.id));
    try {
      await cancelFriendRequest(request.user.username);
    } catch {
      setPendingRequests((current) => [request, ...current]);
    }
  }, []);

  const handleRemoveFromMyList = useCallback(async (movieId: Movie["id"]) => {
    const previousMovies = myListMovies;
    setMyListMovies((current) => current.filter((movie) => String(movie.id) !== String(movieId)));

    try {
      await removeMovieFromMyList(movieId);
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(MY_LIST_IDS_STORAGE_KEY);
        const ids = new Set<string>(stored ? JSON.parse(stored) : []);
        ids.delete(String(movieId));
        window.localStorage.setItem(MY_LIST_IDS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
        window.dispatchEvent(new CustomEvent("my-list:changed", { detail: { movieId: String(movieId), isInMyList: false } }));
      }
    } catch (error) {
      console.warn("No se pudo quitar la película de Mi Lista.", error);
      setMyListMovies(previousMovies);
    }
  }, [myListMovies]);

  const handleRemoveFromRecommended = useCallback(async (movieId: Movie["id"]) => {
    const previousMovies = recommendedMovies;
    setRecommendedMovies((current) => current.filter((movie) => String(movie.id) !== String(movieId)));

    try {
      await removeMovieFromMyRecommendations(movieId);
      window.dispatchEvent(new CustomEvent("my-recommendations:changed", { detail: { movieId: String(movieId), isInMyRecommendations: false } }));
    } catch (error) {
      console.warn("No se pudo quitar la película de Mis recomendadas.", error);
      setRecommendedMovies(previousMovies);
    }
  }, [recommendedMovies]);

  useEffect(() => {
    const normalizedTab = requestedPrivateInboxTab && canRenderPrivateInbox ? "private_inbox" : requestedTab === "activity" ? "activity" : null;
    if (!normalizedTab) return;

    const markContextAsRead = async () => {
      try {
        await markNotificationsContextRead(normalizedTab);
        window.dispatchEvent(new CustomEvent("notifications:refresh-requested"));
      } catch (error) {
        console.warn("No se pudo marcar el contexto de notificaciones como leído.", error);
      }
    };

    void markContextAsRead();
  }, [canRenderPrivateInbox, requestedPrivateInboxTab, requestedTab]);

  useEffect(() => {
    const loadMyList = async () => {
      setLoadingMyList(true);
      try {
        const movies = await getMyMovieList();
        setMyListMovies(movies);
      } catch {
        setMyListMovies([]);
      } finally {
        setLoadingMyList(false);
      }
    };

    const loadRecommendations = async () => {
      setLoadingRecommendedMovies(true);
      try {
        const movies = await getMyMovieRecommendations();
        setRecommendedMovies(movies);
      } catch {
        setRecommendedMovies([]);
      } finally {
        setLoadingRecommendedMovies(false);
      }
    };

    void loadMyList();
    void loadRecommendations();
  }, []);

  useEffect(() => {
    const trimmedQuery = userSearchQuery.trim();
    const requestId = latestUserSearchRequest.current + 1;
    latestUserSearchRequest.current = requestId;

    if (!trimmedQuery) {
      setUserSearchResults([]);
      setUserSearchNext(null);
      setLoadingUserSearch(false);
      setLoadingMoreUserSearch(false);
      setUserSearchError(null);
      return;
    }

    const controller = new AbortController();
    const debounce = window.setTimeout(() => {
      setLoadingUserSearch(true);
      setUserSearchError(null);
      void searchUsers(trimmedQuery, null, controller.signal)
        .then((payload) => {
          if (latestUserSearchRequest.current !== requestId) return;
          setUserSearchResults(mergeUserSearchResults(payload.items));
          setUserSearchNext(payload.next);
        })
        .catch((error) => {
          if (controller.signal.aborted || latestUserSearchRequest.current !== requestId) return;
          console.warn("No se pudo buscar usuarios.", error);
          setUserSearchResults([]);
          setUserSearchNext(null);
          setUserSearchError("No pudimos buscar usuarios. Intenta de nuevo.");
        })
        .finally(() => {
          if (latestUserSearchRequest.current === requestId) setLoadingUserSearch(false);
        });
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(debounce);
    };
  }, [mergeUserSearchResults, userSearchQuery]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!userSearchContainerRef.current?.contains(event.target as Node)) {
        setIsUserSearchPanelOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (userSearchResults.length === 0) return;
    setUserSearchResults((current) => mergeUserSearchResults(current));
  }, [friendsByUsername, followingByUsername, mergeUserSearchResults, pendingByUsername, userSearchResults.length]);

  const handleLoadMoreUserSearch = useCallback(async () => {
    const trimmedQuery = userSearchQuery.trim();
    if (!trimmedQuery || !userSearchNext || loadingMoreUserSearch || loadingUserSearch) return;

    setLoadingMoreUserSearch(true);
    setUserSearchError(null);
    try {
      const payload = await searchUsers(trimmedQuery, userSearchNext);
      setUserSearchResults((current) => {
        const merged = new Map(current.map((user) => [normalizeUsername(user.username), user]));
        payload.items.forEach((user) => merged.set(normalizeUsername(user.username), user));
        return mergeUserSearchResults(Array.from(merged.values()));
      });
      setUserSearchNext(payload.next);
    } catch (error) {
      console.warn("No se pudieron cargar más usuarios.", error);
      setUserSearchError("No pudimos cargar más resultados.");
    } finally {
      setLoadingMoreUserSearch(false);
    }
  }, [loadingMoreUserSearch, loadingUserSearch, mergeUserSearchResults, userSearchNext, userSearchQuery]);

  const handleUserSearchScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (distanceToBottom < 72) {
        void handleLoadMoreUserSearch();
      }
    },
    [handleLoadMoreUserSearch],
  );

  const shouldShowUserSearchPanel = isUserSearchPanelOpen && userSearchQuery.trim().length > 0;

  const handleMobileProfileFeedCarouselScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.clientWidth <= 0) return;
    const nextSlide = Math.round(target.scrollLeft / target.clientWidth);
    setActiveMobileProfileFeedSlide(Math.max(0, Math.min(1, nextSlide)));
  }, []);

  const selectMobileContentSlide = useCallback((slide: 0 | 1) => {
    const carousel = mobileProfileFeedCarouselRef.current;
    if (!carousel) return;
    carousel.scrollTo({ left: slide * carousel.clientWidth, behavior: "smooth" });
    setActiveMobileProfileFeedSlide(slide);
  }, []);

  useEffect(() => {
    const prepareMobileOnboardingStep = (event: Event) => {
      if (!window.matchMedia("(max-width: 1279px)").matches) return;
      const action = (event as CustomEvent<{ action?: OnboardingPrepareAction }>).detail?.action;
      if (!action?.startsWith("profile-mobile-")) return;
      const requestId = ++navigationRequestId.current;
      if (action === "profile-mobile-release") {
        setForceMobileQuickNavigation(false);
        const snapshot = mobileOnboardingSnapshotRef.current;
        if (snapshot) {
          setActiveListView(snapshot.listView);
          selectMobileContentSlide(snapshot.slide === 1 ? 1 : 0);
          mobileOnboardingSnapshotRef.current = null;
        }
        return;
      }
      if (!mobileOnboardingSnapshotRef.current) mobileOnboardingSnapshotRef.current = { listView: activeListView, slide: activeMobileProfileFeedSlide };
      const forceQuickNavigation = ["profile-mobile-connections", "profile-mobile-activity", "profile-mobile-list", "profile-mobile-recommendations", "profile-mobile-following-activity"].includes(action);
      setForceMobileQuickNavigation(forceQuickNavigation);
      if (action === "profile-mobile-connections") setConnectionBlockRequest({ block: 0, id: requestId });
      if (action === "profile-mobile-activity" || action === "profile-mobile-inbox" || action === "profile-mobile-ratings") {
        const tab = action === "profile-mobile-inbox" ? "messages" : action === "profile-mobile-ratings" ? "rated" : "activity";
        setActivityTabRequest({ tab, id: requestId });
        selectMobileContentSlide(0);
      }
      if (action === "profile-mobile-list" || action === "profile-mobile-recommendations") {
        setActiveListView(action === "profile-mobile-list" ? "my-list" : "recommended");
        selectMobileContentSlide(1);
      }
    };
    window.addEventListener(onboardingPrepareStepEventName, prepareMobileOnboardingStep);
    return () => window.removeEventListener(onboardingPrepareStepEventName, prepareMobileOnboardingStep);
  }, [activeListView, activeMobileProfileFeedSlide, selectMobileContentSlide]);

  const navigateToFriends = useCallback((options?: { pendingTab?: boolean }) => {
    const requestId = ++navigationRequestId.current;
    setConnectionBlockRequest({ block: 1, id: requestId });
    if (options?.pendingTab) {
      setConnectionViewRequest({ view: "pending", id: requestId });
    }
    setPendingNavigationTarget("friends");
  }, []);

  const requestQuickNavigation = useCallback((target: QuickTarget) => {
    if (target === "friends") {
      navigateToFriends();
      return;
    }

    const requestId = ++navigationRequestId.current;
    if (target === "following") {
      setConnectionBlockRequest({ block: 0, id: requestId });
    } else if (target === "activity") {
      setActivityTabRequest({ tab: "activity", id: requestId });
      selectMobileContentSlide(0);
    } else if (target === "my-list" || target === "recommended") {
      const nextView = target === "my-list" ? "my-list" : "recommended";
      setActiveListView((current) => current === nextView ? current : nextView);
      selectMobileContentSlide(1);
    }
    setPendingNavigationTarget(target);
  }, [navigateToFriends, selectMobileContentSlide]);

  const completeConnectionBlockRequest = useCallback((requestId: number) => {
    setConnectionBlockRequest((current) => current?.id === requestId ? null : current);
  }, []);

  const completeConnectionViewRequest = useCallback((requestId: number) => {
    setConnectionViewRequest((current) => current?.id === requestId ? null : current);
  }, []);

  const handleConnectionBlockChange = useCallback((block: 0 | 1) => {
    setActiveConnectionBlock(block);
    logFriendRequestNavigation("connection-block-active", { activeConnectionBlock: block });
  }, []);

  const handleFriendsViewChange = useCallback((view: "friends" | "pending") => {
    setActiveFriendsView(view);
    logFriendRequestNavigation("friends-view-active", { activeFriendsView: view });
  }, []);

  useEffect(() => {
    if (
      !pendingFriendRequestNavigation ||
      friendRequestNavigationStarted.current ||
      loadingFriends ||
      loadingPendingRequests ||
      !connectionsSearchSectionRef.current
    ) return;

    friendRequestNavigationStarted.current = true;
    logFriendRequestNavigation("friends-and-pending-requested");
    navigateToFriends({ pendingTab: true });
  }, [loadingFriends, loadingPendingRequests, navigateToFriends, pendingFriendRequestNavigation]);

  useEffect(() => {
    if (
      !pendingFriendRequestNavigation ||
      !friendRequestNavigationStarted.current ||
      friendRequestNavigationCompleted.current ||
      activeConnectionBlock !== 1 ||
      activeFriendsView !== "pending" ||
      loadingProfileUser ||
      loadingPendingRequests ||
      !connectionsSearchSectionRef.current ||
      typeof window === "undefined"
    ) return;

    const target = connectionsSearchSectionRef.current;
    let firstFrame = 0;
    let layoutFrame = 0;
    let verificationFrame = 0;
    let retryFrame = 0;
    let cancelled = false;

    const isVisible = () => {
      const rect = target.getBoundingClientRect();
      return rect.top >= 0 && rect.top < window.innerHeight;
    };

    const finishNavigation = () => {
      if (cancelled) return;
      logFriendRequestNavigation("navigation-cleanup", { visible: isVisible() });
      friendRequestNavigationCompleted.current = true;
      setPendingFriendRequestNavigation(false);
      setPendingNavigationTarget(null);
      setConnectionBlockRequest(null);
      setConnectionViewRequest(null);

      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.delete("friendsTab");
      const nextQuery = nextSearchParams.toString();
      router.replace(nextQuery ? `/profile-feed?${nextQuery}` : "/profile-feed", { scroll: false });
    };

    const scrollAndVerify = (allowRetry: boolean) => {
      const beforeTop = target.getBoundingClientRect().top;
      logFriendRequestNavigation("scroll-attempt", { attempt: allowRetry ? 1 : 2, beforeTop });
      target.scrollIntoView({ behavior: "auto", block: "start" });
      verificationFrame = window.requestAnimationFrame(() => {
        const afterTop = target.getBoundingClientRect().top;
        const visible = isVisible();
        logFriendRequestNavigation("scroll-verified", { attempt: allowRetry ? 1 : 2, afterTop, visible });
        if (visible || !allowRetry) {
          finishNavigation();
          return;
        }
        retryFrame = window.requestAnimationFrame(() => scrollAndVerify(false));
      });
    };

    firstFrame = window.requestAnimationFrame(() => {
      layoutFrame = window.requestAnimationFrame(() => scrollAndVerify(true));
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(layoutFrame);
      window.cancelAnimationFrame(verificationFrame);
      window.cancelAnimationFrame(retryFrame);
    };
  }, [activeConnectionBlock, activeFriendsView, loadingPendingRequests, loadingProfileUser, pendingFriendRequestNavigation, router, searchParams]);

  useEffect(() => {
    if (!pendingNavigationTarget) return;
    if (pendingFriendRequestNavigation) return;
    if ((pendingNavigationTarget === "following" || pendingNavigationTarget === "friends") && (connectionBlockRequest || connectionViewRequest)) return;
    const requiredListView = pendingNavigationTarget === "my-list" ? "my-list" : pendingNavigationTarget === "recommended" ? "recommended" : null;
    if (requiredListView && activeListView !== requiredListView) return;

    const destination = pendingNavigationTarget === "following" || pendingNavigationTarget === "friends"
      ? connectionsSearchSectionRef.current
      : pendingNavigationTarget === "following-activity"
        ? followingActivityPanelRef.current
        : activityAndListsPanelRef.current;
    if (!destination || typeof window === "undefined") return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (pendingNavigationTarget === "activity") {
          activityAndListsPanelRef.current?.querySelector<HTMLElement>(".my-activity-scroll-area")?.scrollTo({ top: 0 });
        } else if (requiredListView) {
          activityAndListsPanelRef.current?.querySelector<HTMLElement>(".profile-feed-mobile-list-scroll")?.scrollTo({ top: 0 });
        } else if (pendingNavigationTarget === "following-activity") {
          followingActivityPanelRef.current?.querySelector<HTMLElement>(".profile-feed-following-scroll")?.scrollTo({ top: 0 });
        }
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        destination.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        setPendingNavigationTarget(null);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [activeListView, connectionBlockRequest, connectionViewRequest, pendingFriendRequestNavigation, pendingNavigationTarget, router, searchParams]);

  const renderMovieListPanel = (className: string, mobile = false) => (
    <section data-tour-mobile={mobile ? `profile-${activeListView === "recommended" ? "recommendations" : "list"}-mobile` : undefined} className={className}>
      <div className="relative mx-auto w-fit">
        <MobileDarkSelect
          ariaLabel={t("profileFeedMyList")}
          value={activeListView}
          options={[
            { value: "my-list", label: t("profileFeedMyList") },
            { value: "recommended", label: t("profileFeedMyRecommendations") },
          ]}
          onChange={setActiveListView}
          selectedIcon={activeListView === "my-list"
            ? <MyListIcon className="pointer-events-none h-[18px] w-[18px] shrink-0" />
            : <Image src="/icons/Ticket.png" alt="" width={22} height={18} className="pointer-events-none h-[18px] w-[22px] shrink-0 object-contain" />}
          className="rounded-xl border border-white/20 bg-zinc-900/80 px-3 py-1.5 text-center text-lg font-semibold text-zinc-100 shadow-[0_14px_26px_rgba(0,0,0,0.35)] outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        />
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 xl:block">
          {activeListView === "my-list"
            ? <MyListIcon className="h-[18px] w-[18px]" />
            : <Image src="/icons/Ticket.png" alt="" width={22} height={18} className="h-[18px] w-[22px] object-contain" />}
        </span>
        <select
          data-tour={activeListView === "recommended" ? "profile-recommendations" : "profile-list"}
          aria-label={t("profileFeedMyList")}
          value={activeListView}
          onChange={(event) => setActiveListView(event.target.value === "recommended" ? "recommended" : "my-list")}
          className={`hidden appearance-none overflow-hidden rounded-xl border xl:block xl:w-56 border-white/20 bg-zinc-900/80 px-3 py-1.5 pr-8 text-center ${activeListView === "recommended" ? "text-sm" : "text-lg"} font-semibold leading-7 text-zinc-100 [text-indent:1.25rem] shadow-[0_14px_26px_rgba(0,0,0,0.35)] outline-none transition hover:border-white/30 hover:bg-zinc-900 focus:outline-none focus:ring-0 focus:border-white/20 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-white/20 active:ring-0`}
        >
          <option value="my-list" className="rounded-t-xl bg-zinc-950 text-zinc-100">{t("profileFeedMyList")}</option>
          <option value="recommended" className="rounded-b-xl bg-zinc-950 text-zinc-100">{t("profileFeedMyRecommendations")}</option>
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-3 hidden xl:block top-1/2 -translate-y-1/2 text-xs text-zinc-300">▾</span>
      </div>
      <div className="profile-feed-mobile-list-scroll activity-scrollbar mt-4 flex-1 space-y-2.5 overflow-y-auto pr-3">
        {activeListView === "recommended" && loadingRecommendedMovies ? <p className="text-center text-xs text-zinc-400">{t("profileFeedLoadingList")}</p> : null}
        {activeListView === "recommended" && !loadingRecommendedMovies && recommendedMovies.length === 0 ? (
          <EmptyStatePanel
            title={t("emptyMyRecommendationsTitle")}
            description={t("emptyMyRecommendationsDescription")}
            icon={<span aria-hidden="true">🎬</span>}
          />
        ) : null}
        {activeListView === "my-list" && loadingMyList ? <p className="text-center text-xs text-zinc-400">{t("profileFeedLoadingList")}</p> : null}
        {activeListView === "my-list" && !loadingMyList && myListMovies.length === 0 ? (
          <EmptyStatePanel
            title={t("emptyMyListTitle")}
            description={t("emptyMyListDescription")}
            icon={<span aria-hidden="true">🎞️</span>}
          />
        ) : null}
        {activeListView === "my-list" && myListMovies.map((movie) => {
          const { primary: displayTitle, secondary: englishTitle } = resolveMovieTitles(locale, movie.titleSpanish || movie.displayTitle || movie.title, movie.titleEnglish || movie.displaySecondaryTitle, movie.title);
          const detailHref = `/movies/${encodeURIComponent(String(movie.id))}`;
          return (
            <article key={String(movie.id)} className="mr-1 rounded-xl border border-white/10 bg-zinc-900/35 px-2 py-2">
              <div className="relative flex justify-center">
                <Link href={detailHref} aria-label={`${locale === "en" ? "View details for" : "Ver detalle de"} ${displayTitle}`} className="mx-auto w-[96px] shrink-0 cursor-pointer">
                  {movie.image || movie.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={movie.image || movie.posterUrl || ""} alt={`${locale === "en" ? "Poster for" : "Poster de"} ${displayTitle}`} className="mx-auto h-[138px] w-[96px] rounded-md object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="mx-auto flex h-[138px] w-[96px] items-center justify-center rounded-md bg-zinc-800 text-xs text-zinc-400">{t("profileFeedNoPoster")}</div>
                  )}
                </Link>
                <button type="button" onClick={() => void handleRemoveFromMyList(movie.id)} className="absolute right-0 top-0 text-[13px] leading-none text-zinc-400" aria-label={interpolate(t("profileFeedMyListRemoveAria"), { title: displayTitle })}>✕</button>
              </div>
              <div className="mt-1.5 text-center">
                <p className="truncate text-sm font-semibold text-zinc-100"><Link href={detailHref} className="cursor-pointer hover:text-blue-100">{displayTitle}</Link></p>
                {englishTitle ? <p className="truncate text-xs text-zinc-400"><Link href={detailHref} className="cursor-pointer hover:text-blue-100">{englishTitle}</Link></p> : null}
              </div>
            </article>
          );
        })}

        {activeListView === "recommended" && recommendedMovies.map((movie) => {
          const { primary: displayTitle, secondary: englishTitle } = resolveMovieTitles(locale, movie.titleSpanish || movie.displayTitle || movie.title, movie.titleEnglish || movie.displaySecondaryTitle, movie.title);
          const detailHref = `/movies/${encodeURIComponent(String(movie.id))}`;
          return (
            <article key={String(movie.id)} className="mr-1 rounded-xl border border-white/10 bg-zinc-900/35 px-2 py-2">
              <div className="relative flex justify-center">
                <Link href={detailHref} aria-label={`${locale === "en" ? "View details for" : "Ver detalle de"} ${displayTitle}`} className="mx-auto w-[96px] shrink-0 cursor-pointer">
                  {movie.image || movie.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={movie.image || movie.posterUrl || ""} alt={`${locale === "en" ? "Poster for" : "Poster de"} ${displayTitle}`} className="mx-auto h-[138px] w-[96px] rounded-md object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="mx-auto flex h-[138px] w-[96px] items-center justify-center rounded-md bg-zinc-800 text-xs text-zinc-400">{t("profileFeedNoPoster")}</div>
                  )}
                </Link>
                <button type="button" onClick={() => void handleRemoveFromRecommended(movie.id)} className="absolute right-0 top-0 text-[13px] leading-none text-zinc-400" aria-label={interpolate(t("profileFeedMyRecommendationsRemoveAria"), { title: displayTitle })}>✕</button>
              </div>
              <div className="mt-1.5 text-center">
                <p className="truncate text-sm font-semibold text-zinc-100"><Link href={detailHref} className="cursor-pointer hover:text-blue-100">{displayTitle}</Link></p>
                {englishTitle ? <p className="truncate text-xs text-zinc-400"><Link href={detailHref} className="cursor-pointer hover:text-blue-100">{englishTitle}</Link></p> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  return (
    <main className="profile-feed-mobile-framing min-h-screen overflow-x-clip bg-black text-zinc-100">
      <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-8 xl:px-8 xl:pb-8">
        <section className="w-full min-w-0 max-w-full rounded-3xl bg-zinc-950/55 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.36)] xl:p-6">
          <div className="grid min-w-0 items-stretch gap-6 xl:grid-cols-[1fr_3fr]">
            <div data-tour="profile-info" className="mx-auto flex w-full min-w-0 max-w-full">
              <ProfileIdentityCard
                username={profileUser?.username || "usuario"}
                isLoading={loadingProfileUser || !profileUser}
                stabilizeMobileHeight
                avatarUrl={profileUser?.avatarUrl}
                avatarHref="/settings/personal-data"
                avatarLinkLabel={t("profileFeedPersonalDataAvatarLink")}
                constrainDesktopAvatar
                fitDesktopPersonalDataRow
                firstName={profileUser?.firstName}
                lastName={profileUser?.lastName}
                age={profileUser?.age}
                ageVisible={profileUser?.ageVisible}
                genderIdentity={profileUser?.genderIdentity}
                genderIdentityVisible={profileUser?.genderIdentityVisible}
                userLabel={t("profileFeedUser").toLocaleUpperCase(locale)}
                formatAge={(value) => interpolate(t("profileFeedAge"), { age: value })}
                followersCount={profileUser?.followersCount}
                formatFollowers={(count) =>
                  count === 1 ? t("profileFeedFollowedByYouOne") : interpolate(t("profileFeedFollowedByYouMany"), { count })
                }
                appBranding={branding}
                logoSlot="profile_feed_logo_url"
              />
            </div>

            <div data-tour="profile-favorites" className="flex min-h-[220px] flex-col justify-center gap-5">
              <p className="text-center text-lg font-semibold text-zinc-100 xl:text-left">{t("profileFeedFavoriteMovies")}</p>
              <FavoriteMoviesBlock />
            </div>
          </div>
        </section>

        <section ref={(node) => { userSearchContainerRef.current = node; connectionsSearchSectionRef.current = node; }} className="profile-feed-connections-search relative z-30 mx-auto mt-4 w-full max-w-2xl scroll-mt-4 xl:mt-5" aria-label={t("profileFeedSearchUser")}>
          <div className="flex w-full rounded-full border border-white/55 bg-zinc-900/80 p-1.5 shadow-[0_20px_45px_rgba(0,0,0,0.3)]">
            <div className="relative min-w-0 flex-1">
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
              <input
                type="search"
                placeholder={t("profileFeedSearchAndFollowFriends")}
                aria-label={t("profileFeedSearchAndFollowFriends")}
                value={userSearchQuery}
                onChange={(event) => {
                  setUserSearchQuery(event.target.value);
                  setIsUserSearchPanelOpen(event.target.value.trim().length > 0);
                }}
                onFocus={() => {
                  if (userSearchQuery.trim().length > 0) setIsUserSearchPanelOpen(true);
                }}
                autoComplete="off"
                className="w-full rounded-full border-[0.5px] border-white/30 bg-zinc-950 py-2 pl-10 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-blue-300/60"
              />
            </div>
          </div>

          {shouldShowUserSearchPanel ? (
            <div className="absolute left-1/2 top-full z-40 mt-2 w-[min(100%,42rem)] -translate-x-1/2 rounded-3xl border border-zinc-700/80 bg-zinc-900 p-2 shadow-[0_28px_70px_rgba(0,0,0,0.72),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="activity-scrollbar max-h-[24rem] space-y-2 overflow-y-auto pr-1" onScroll={handleUserSearchScroll}>
                {userSearchResults.map((user) => (
                  <UserSearchResultRow key={user.id || user.username} user={user} />
                ))}

                {!loadingUserSearch && userSearchResults.length === 0 ? (
                  <div className="rounded-2xl border border-white/5 bg-zinc-900/70 px-4 py-5 text-center text-sm text-zinc-400">
                    {t("profileFeedNoUsersFound")}
                  </div>
                ) : null}

                {loadingUserSearch ? (
                  <div className="rounded-2xl border border-white/5 bg-zinc-900/70 px-4 py-5 text-center text-sm text-zinc-400">
                    {t("profileFeedSearchingUsers")}
                  </div>
                ) : null}

                {userSearchError ? (
                  <p className="px-3 py-1 text-center text-xs text-rose-200">{userSearchError}</p>
                ) : null}

                {userSearchNext && !loadingUserSearch ? (
                  <button
                    type="button"
                    onClick={() => void handleLoadMoreUserSearch()}
                    disabled={loadingMoreUserSearch}
                    className="w-full rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-blue-300/30 hover:text-blue-100 disabled:cursor-wait disabled:opacity-70"
                  >
                    {loadingMoreUserSearch ? t("profileFeedLoadingMoreUsers") : t("profileFeedLoadMore")}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-4 w-full xl:mt-5">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,680px)_minmax(296px,360px)_minmax(260px,1fr)]">
            <TopUsersSection
              tourTarget="profile-connections"
              friends={friends}
              following={following}
              pendingRequests={pendingRequests}
              receivedPendingRequestsCount={receivedPendingRequestsCount}
              loadingFriends={loadingFriends}
              loadingFollowing={loadingFollowing}
              loadingPendingRequests={loadingPendingRequests}
              friendsError={friendsError}
              followingError={followingError}
              pendingRequestsError={pendingRequestsError}
              onRetryFriends={() => void loadFriends()}
              onRetryFollowing={() => void loadFollowing()}
              onRetryPendingRequests={() => void loadPendingRequests()}
              onAcceptFriendRequest={(request) => void handleAcceptFriendRequest(request)}
              onRejectFriendRequest={(request) => void handleRejectFriendRequest(request)}
              onCancelFriendRequest={(request) => void handleCancelFriendRequest(request)}
              authenticatedUsername={profileUser?.username ?? undefined}
              redirectOwnClicksToProfileFeed
              friendRequestsRestricted={shouldShowRestrictedFriendsEmptyState}
              initialConnectionView={initialConnectionView}
              branding={branding}
              mobileBlockRequest={connectionBlockRequest}
              onMobileBlockRequestComplete={completeConnectionBlockRequest}
              onMobileBlockChange={handleConnectionBlockChange}
              connectionViewRequest={connectionViewRequest}
              onConnectionViewRequestComplete={completeConnectionViewRequest}
              onConnectionViewChange={handleFriendsViewChange}
            />
            <div ref={activityAndListsPanelRef} className="profile-feed-mobile-content-row w-full max-w-full scroll-mt-4 overflow-hidden xl:hidden">
              <div
                ref={mobileProfileFeedCarouselRef}
                className="profile-feed-mobile-content-track flex w-full max-w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onScroll={handleMobileProfileFeedCarouselScroll}
              >
                <div className="profile-feed-mobile-content-panel w-full min-w-full shrink-0 snap-start">
                  <MyActivityColumn
                    key={`my-activity-mobile-${initialActivityTab}`}
                    isOwnProfile
                    initialActiveTab={initialActivityTab}
                    hidePrivateInbox={profileUser?.friendRequestsRestricted ?? null}
                    activeTabRequest={activityTabRequest}
                  />
                </div>
                <div className="profile-feed-mobile-content-panel w-full min-w-full shrink-0 snap-start">
                  {renderMovieListPanel("profile-feed-mobile-list-panel flex min-w-0 flex-col rounded-none bg-zinc-950/55 p-4", true)}
                </div>
              </div>
              <div className="profile-feed-mobile-carousel-dots mb-2 mt-1 py-0.5" aria-hidden="true">
                {[0, 1].map((slideIndex) => (
                  <span
                    key={slideIndex}
                    className={`profile-feed-mobile-carousel-dot${slideIndex === activeMobileProfileFeedSlide ? " profile-feed-mobile-carousel-dot--active" : ""}`}
                  />
                ))}
              </div>
            </div>
            <div data-tour="profile-activity" className="hidden xl:block">
              <MyActivityColumn
                key={`my-activity-${initialActivityTab}`}
                isOwnProfile
                initialActiveTab={initialActivityTab}
                hidePrivateInbox={profileUser?.friendRequestsRestricted ?? null}
                activeTabRequest={activityTabRequest}
              />
            </div>
            {renderMovieListPanel("hidden h-[30rem] xl:flex xl:min-w-[260px] xl:flex-col xl:rounded-none xl:bg-zinc-950/55 xl:p-4")}
          </div>
        </section>

        <div data-tour="profile-following-activity" data-tour-mobile="profile-following-activity-mobile" ref={followingActivityPanelRef} className="profile-feed-following-activity mt-3 scroll-mt-4 xl:mt-4">
          <SocialActivityTabsBlock />
        </div>
      </div>
      <ProfileQuickNavigation
        ariaLabel={t("profileFeedQuickNavigation")}
        pendingFriendRequestsCount={receivedPendingRequestsCount}
        forceVisible={forceMobileQuickNavigation}
        items={[
          { label: t("profileFeedFollowing"), icon: profileQuickNavigationIcons.following, tourTarget: "profile-quick-following", onNavigate: () => requestQuickNavigation("following") },
          { label: t("profileFeedFriends"), icon: profileQuickNavigationIcons.friends, tourTarget: "profile-quick-friends", onNavigate: () => requestQuickNavigation("friends") },
          { label: t("profileFeedMyActivity"), icon: profileQuickNavigationIcons.activity, tourTarget: "profile-quick-activity", onNavigate: () => requestQuickNavigation("activity") },
          { label: t("profileFeedMyList"), icon: profileQuickNavigationIcons.list, tourTarget: "profile-quick-list", onNavigate: () => requestQuickNavigation("my-list") },
          { label: t("profileFeedMyRecommendations"), icon: profileQuickNavigationIcons.recommendations, tourTarget: "profile-quick-recommendations", onNavigate: () => requestQuickNavigation("recommended") },
          { label: t("profileFeedFollowingActivityTitle"), icon: profileQuickNavigationIcons.followingActivity, tourTarget: "profile-quick-following-activity", onNavigate: () => requestQuickNavigation("following-activity") },
        ]}
      />
    </main>
  );
}

export default function ProfileFeedPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black text-zinc-100" />}>
      <ProfileFeedContent />
    </Suspense>
  );
}
