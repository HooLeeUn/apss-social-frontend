"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import FavoriteMoviesBlock from "../../components/profile-feed/FavoriteMoviesBlock";
import MyActivityColumn from "../../components/profile-feed/MyActivityColumn";
import ProfileIdentityCard from "../../components/profile-feed/ProfileIdentityCard";
import SocialActivityTabsBlock from "../../components/profile-feed/SocialActivityTabsBlock";
import TopUsersSection from "../../components/profile-feed/TopUsersSection";
import { getMyProfile, getTopFollowing, getTopFriends, markNotificationsContextRead } from "../../lib/profile-feed/adapters";
import { SocialUser } from "../../lib/profile-feed/types";
import { getPersonalData } from "../../lib/personal-data";
import { useAppBranding } from "../../hooks/useAppBranding";
import { getMyMovieList, Movie, removeMovieFromMyList } from "../../lib/movies";

const MY_LIST_IDS_STORAGE_KEY = "my_list_movie_ids";

export default function ProfileFeedPage() {
  const searchParams = useSearchParams();
  const branding = useAppBranding();
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<SocialUser | null>(null);
  const requestedTab = searchParams.get("tab");
  const [myListMovies, setMyListMovies] = useState<Movie[]>([]);
  const [loadingMyList, setLoadingMyList] = useState(true);
  const [activeListView, setActiveListView] = useState<"my-list" | "recommended">("my-list");
  const initialActivityTab = requestedTab === "private_inbox" || requestedTab === "messages" ? "messages" : "activity";

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

  useEffect(() => {
    void loadFollowing();
    void loadFriends();
  }, [loadFollowing, loadFriends]);

  useEffect(() => {
    const loadOwnProfileData = async () => {
      try {
        const [myProfile, personalData] = await Promise.all([getMyProfile(), getPersonalData()]);
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
        });
      } catch {
        const myProfile = await getMyProfile().catch(() => null);
        setProfileUser(myProfile);
      }
    };

    void loadOwnProfileData();
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

  useEffect(() => {
    const normalizedTab = requestedTab === "private_inbox" || requestedTab === "messages" ? "private_inbox" : requestedTab === "activity" ? "activity" : null;
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
  }, [requestedTab]);

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

    void loadMyList();
  }, []);

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8 md:px-8">
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

        <section className="w-full">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,680px)_minmax(296px,360px)_minmax(260px,1fr)]">
            <TopUsersSection
              friends={friends}
              following={following}
              loadingFriends={loadingFriends}
              loadingFollowing={loadingFollowing}
              friendsError={friendsError}
              followingError={followingError}
              onRetryFriends={() => void loadFriends()}
              onRetryFollowing={() => void loadFollowing()}
            />
            <MyActivityColumn key={`my-activity-${initialActivityTab}`} isOwnProfile initialActiveTab={initialActivityTab} />
            <section className="hidden h-[30rem] xl:flex xl:min-w-[260px] xl:flex-col xl:rounded-none xl:border-2 xl:border-white/15 xl:bg-zinc-950/55 xl:p-4">
              <div className="relative mx-auto w-fit">
                <select
                  aria-label="Seleccionar lista"
                  value={activeListView}
                  onChange={(event) => setActiveListView(event.target.value === "recommended" ? "recommended" : "my-list")}
                  className="appearance-none rounded-2xl border border-white/15 bg-zinc-900/80 px-4 py-2.5 pr-9 text-center text-lg font-semibold text-zinc-100 shadow-[0_14px_26px_rgba(0,0,0,0.35)] outline-none transition hover:border-white/30 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-300/60"
                >
                  <option value="my-list" className="bg-zinc-950 text-zinc-100">Mi Lista</option>
                  <option value="recommended" className="bg-zinc-950 text-zinc-100">Mis recomendadas</option>
                </select>
                <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-300">▾</span>
              </div>
              <div className="activity-scrollbar mt-4 flex-1 space-y-2.5 overflow-y-auto pr-3">
                {activeListView === "recommended" ? <p className="text-center text-xs text-zinc-500">Sin películas en esta lista por ahora.</p> : null}
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
                          {movie.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={movie.posterUrl} alt={`Poster de ${displayTitle}`} className="mx-auto h-[138px] w-[96px] rounded-md object-cover" loading="lazy" decoding="async" />
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
              </div>
            </section>
          </div>
        </section>

        <SocialActivityTabsBlock />
      </div>
    </main>
  );
}
