"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UIEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import FavoriteMoviesBlock from "../../components/profile-feed/FavoriteMoviesBlock";
import MyActivityColumn from "../../components/profile-feed/MyActivityColumn";
import ProfileIdentityCard from "../../components/profile-feed/ProfileIdentityCard";
import SocialActivityTabsBlock from "../../components/profile-feed/SocialActivityTabsBlock";
import TopUsersSection from "../../components/profile-feed/TopUsersSection";
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
import { getMyMovieList, getMyMovieRecommendations, Movie, removeMovieFromMyList, removeMovieFromMyRecommendations } from "../../lib/movies";

const MY_LIST_IDS_STORAGE_KEY = "my_list_movie_ids";

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
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const followersCopy =
    typeof user.followersCount === "number"
      ? user.followersCount === 1
        ? "Lo sigue 1 usuario"
        : `Lo siguen ${user.followersCount} usuarios`
      : "Seguidores no disponibles";

  const statusBadges = [
    user.friendshipStatus === "friends" ? { label: "Amigo", className: "border-violet-300/40 bg-violet-600/25 text-violet-100" } : null,
    user.isFollowing ? { label: "Seguido", className: "border-violet-300/40 bg-violet-600/25 text-violet-100" } : null,
    user.friendshipStatus === "sent_pending" ? { label: "Solicitud enviada", className: "border-blue-300/40 bg-blue-600/25 text-blue-100" } : null,
    user.friendshipStatus === "received_pending" ? { label: "Solicitud recibida", className: "border-blue-300/40 bg-blue-600/25 text-blue-100" } : null,
  ].filter((badge): badge is { label: string; className: string } => Boolean(badge));

  return (
    <Link
      href={`/users/${encodeURIComponent(user.username)}`}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-zinc-950/70 px-4 py-3 transition hover:border-blue-300/30 hover:bg-zinc-900/90 focus-visible:border-blue-300/50 focus-visible:outline-none"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-100 group-hover:text-blue-100">@{user.username}</p>
        {fullName ? <p className="truncate text-xs text-zinc-300">{fullName}</p> : null}
        <p className="text-xs text-zinc-500">{followersCopy}</p>
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


export default function ProfileFeedPage() {
  const searchParams = useSearchParams();
  const branding = useAppBranding();
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<SocialUser[]>([]);
  const [userSearchNext, setUserSearchNext] = useState<string | null>(null);
  const [loadingUserSearch, setLoadingUserSearch] = useState(false);
  const [loadingMoreUserSearch, setLoadingMoreUserSearch] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);
  const latestUserSearchRequest = useRef(0);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const [pendingRequestsError, setPendingRequestsError] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<SocialUser | null>(null);
  const requestedTab = searchParams.get("tab");
  const requestedFriendsTab = searchParams.get("friendsTab");
  const [myListMovies, setMyListMovies] = useState<Movie[]>([]);
  const [loadingMyList, setLoadingMyList] = useState(true);
  const [recommendedMovies, setRecommendedMovies] = useState<Movie[]>([]);
  const [loadingRecommendedMovies, setLoadingRecommendedMovies] = useState(true);
  const [activeListView, setActiveListView] = useState<"my-list" | "recommended">("my-list");
  const requestedPrivateInboxTab = requestedTab === "private_inbox" || requestedTab === "messages";
  const initialConnectionView = requestedFriendsTab === "pending" ? "pending" : "friends";
  const canRenderPrivateInbox = profileUser?.friendRequestsRestricted === false;
  const initialActivityTab = requestedPrivateInboxTab && canRenderPrivateInbox ? "messages" : "activity";
  const shouldShowRestrictedFriendsEmptyState =
    profileUser?.friendRequestsRestricted === true && profileUser.profileVisibility === "public";

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
    const loadOwnProfileData = async () => {
      try {
        const [myProfile, personalData, privacySettings] = await Promise.all([
          getMyProfile(),
          getPersonalData(),
          getProfilePrivacySettings(),
        ]);
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
      }
    };

    void loadOwnProfileData();
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

  const shouldShowUserSearchPanel = userSearchQuery.trim().length > 0;

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col px-4 py-8 md:px-8">
        <section className="rounded-3xl bg-zinc-950/55 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.36)] md:p-6">
          <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_3fr]">
            <div className="flex">
              <ProfileIdentityCard
                username={profileUser?.username || "usuario"}
                avatarUrl={profileUser?.avatarUrl}
                firstName={profileUser?.firstName}
                lastName={profileUser?.lastName}
                age={profileUser?.age}
                ageVisible={profileUser?.ageVisible}
                genderIdentity={profileUser?.genderIdentity}
                genderIdentityVisible={profileUser?.genderIdentityVisible}
                appBranding={branding}
                logoSlot="profile_feed_logo_url"
              />
            </div>

            <div className="flex min-h-[220px] flex-col justify-center gap-5">
              <p className="text-center text-lg font-semibold text-zinc-100 md:text-left">Mis Películas Favoritas</p>
              <FavoriteMoviesBlock />
            </div>
          </div>
        </section>

        <section className="relative z-30 mx-auto mt-4 w-full max-w-2xl md:mt-5" aria-label="Buscador de usuarios">
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
                placeholder="Buscar usuarios"
                aria-label="Buscar usuarios"
                value={userSearchQuery}
                onChange={(event) => setUserSearchQuery(event.target.value)}
                autoComplete="off"
                className="w-full rounded-full border-[0.5px] border-white/30 bg-zinc-950 py-2 pl-10 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-blue-300/60"
              />
            </div>
          </div>

          {shouldShowUserSearchPanel ? (
            <div className="absolute left-1/2 top-full z-40 mt-2 w-[min(100%,42rem)] -translate-x-1/2 rounded-3xl border border-white/15 bg-zinc-950/95 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur">
              <div className="activity-scrollbar max-h-[24rem] space-y-2 overflow-y-auto pr-1" onScroll={handleUserSearchScroll}>
                {userSearchResults.map((user) => (
                  <UserSearchResultRow key={user.id || user.username} user={user} />
                ))}

                {!loadingUserSearch && userSearchResults.length === 0 ? (
                  <div className="rounded-2xl border border-white/5 bg-zinc-900/70 px-4 py-5 text-center text-sm text-zinc-400">
                    No encontramos usuarios
                  </div>
                ) : null}

                {loadingUserSearch ? (
                  <div className="rounded-2xl border border-white/5 bg-zinc-900/70 px-4 py-5 text-center text-sm text-zinc-400">
                    Buscando usuarios…
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
                    {loadingMoreUserSearch ? "Cargando más usuarios…" : "Cargar más resultados"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-4 w-full md:mt-5">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,680px)_minmax(296px,360px)_minmax(260px,1fr)]">
            <TopUsersSection
              friends={friends}
              following={following}
              pendingRequests={pendingRequests}
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
            />
            <MyActivityColumn
              key={`my-activity-${initialActivityTab}`}
              isOwnProfile
              initialActiveTab={initialActivityTab}
              hidePrivateInbox={profileUser?.friendRequestsRestricted ?? null}
            />
            <section className="hidden h-[30rem] xl:flex xl:min-w-[260px] xl:flex-col xl:rounded-none xl:border-2 xl:border-white/15 xl:bg-zinc-950/55 xl:p-4">
              <div className="relative mx-auto w-fit">
                <select
                  aria-label="Seleccionar lista"
                  value={activeListView}
                  onChange={(event) => setActiveListView(event.target.value === "recommended" ? "recommended" : "my-list")}
                  className="appearance-none overflow-hidden rounded-xl border border-white/20 bg-zinc-900/80 px-3 py-1.5 pr-8 text-center text-lg font-semibold text-zinc-100 shadow-[0_14px_26px_rgba(0,0,0,0.35)] outline-none transition hover:border-white/30 hover:bg-zinc-900 focus:outline-none focus:ring-0 focus:border-white/20 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-white/20 active:ring-0"
                >
                  <option value="my-list" className="rounded-t-xl bg-zinc-950 text-zinc-100">Mi Lista</option>
                  <option value="recommended" className="rounded-b-xl bg-zinc-950 text-zinc-100">Mis recomendadas</option>
                </select>
                <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-300">▾</span>
              </div>
              <div className="activity-scrollbar mt-4 flex-1 space-y-2.5 overflow-y-auto pr-3">
                {activeListView === "recommended" && loadingRecommendedMovies ? <p className="text-center text-xs text-zinc-400">Cargando lista…</p> : null}
                {activeListView === "recommended" && !loadingRecommendedMovies && recommendedMovies.length === 0 ? <p className="text-center text-xs text-zinc-500">Sin películas en esta lista por ahora.</p> : null}
                {activeListView === "my-list" && loadingMyList ? <p className="text-center text-xs text-zinc-400">Cargando lista…</p> : null}
                {activeListView === "my-list" && !loadingMyList && myListMovies.length === 0 ? <p className="text-center text-xs text-zinc-500">Sin películas en tu lista.</p> : null}
                {activeListView === "my-list" && myListMovies.map((movie) => {
                  const displayTitle = movie.titleSpanish || movie.displayTitle || movie.title;
                  const englishTitle = movie.titleEnglish || movie.displaySecondaryTitle || "";
                  const detailHref = `/movies/${encodeURIComponent(String(movie.id))}`;
                  return (
                    <article key={String(movie.id)} className="mr-1 rounded-xl border border-white/10 bg-zinc-900/35 px-2 py-2">
                      <div className="relative flex justify-center">
                        <Link href={detailHref} aria-label={`Ver detalle de ${displayTitle}`} className="mx-auto w-[96px] shrink-0 cursor-pointer">
                          {movie.image || movie.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={movie.image || movie.posterUrl || ""} alt={`Poster de ${displayTitle}`} className="mx-auto h-[138px] w-[96px] rounded-md object-cover" loading="lazy" decoding="async" />
                          ) : (
                            <div className="mx-auto flex h-[138px] w-[96px] items-center justify-center rounded-md bg-zinc-800 text-xs text-zinc-400">Sin poster</div>
                          )}
                        </Link>
                        <button type="button" onClick={() => void handleRemoveFromMyList(movie.id)} className="absolute right-0 top-0 text-[13px] leading-none text-zinc-400" aria-label={`Quitar ${displayTitle} de Mi Lista`}>✕</button>
                      </div>
                      <div className="mt-1.5 text-center">
                        <p className="truncate text-sm font-semibold text-zinc-100"><Link href={detailHref} className="cursor-pointer hover:text-blue-100">{displayTitle}</Link></p>
                        {englishTitle ? <p className="truncate text-xs text-zinc-400"><Link href={detailHref} className="cursor-pointer hover:text-blue-100">{englishTitle}</Link></p> : null}
                      </div>
                    </article>
                  );
                })}

                {activeListView === "recommended" && recommendedMovies.map((movie) => {
                  const displayTitle = movie.titleSpanish || movie.displayTitle || movie.title;
                  const englishTitle = movie.titleEnglish || movie.displaySecondaryTitle || "";
                  const detailHref = `/movies/${encodeURIComponent(String(movie.id))}`;
                  return (
                    <article key={String(movie.id)} className="mr-1 rounded-xl border border-white/10 bg-zinc-900/35 px-2 py-2">
                      <div className="relative flex justify-center">
                        <Link href={detailHref} aria-label={`Ver detalle de ${displayTitle}`} className="mx-auto w-[96px] shrink-0 cursor-pointer">
                          {movie.image || movie.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={movie.image || movie.posterUrl || ""} alt={`Poster de ${displayTitle}`} className="mx-auto h-[138px] w-[96px] rounded-md object-cover" loading="lazy" decoding="async" />
                          ) : (
                            <div className="mx-auto flex h-[138px] w-[96px] items-center justify-center rounded-md bg-zinc-800 text-xs text-zinc-400">Sin poster</div>
                          )}
                        </Link>
                        <button type="button" onClick={() => void handleRemoveFromRecommended(movie.id)} className="absolute right-0 top-0 text-[13px] leading-none text-zinc-400" aria-label={`Quitar ${displayTitle} de Mis recomendadas`}>✕</button>
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
          </div>
        </section>

        <div className="mt-3 md:mt-4">
          <SocialActivityTabsBlock />
        </div>
      </div>
    </main>
  );
}
