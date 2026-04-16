"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import FavoriteMoviesBlock from "../../components/profile-feed/FavoriteMoviesBlock";
import MyActivityColumn from "../../components/profile-feed/MyActivityColumn";
import SocialActivityTabsBlock from "../../components/profile-feed/SocialActivityTabsBlock";
import TopUsersSection from "../../components/profile-feed/TopUsersSection";
import { getTopFollowing, getTopFriends } from "../../lib/profile-feed/adapters";
import { SocialUser } from "../../lib/profile-feed/types";

export default function ProfileFeedPage() {
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [followingError, setFollowingError] = useState<string | null>(null);

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

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/55 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.36)] md:p-6">
          <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_3fr]">
            <div className="flex">
              <Link
                href="/feed"
                className="group relative flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-zinc-900/75 px-4 py-8 text-center shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition hover:border-blue-200/70 hover:shadow-[0_20px_45px_rgba(37,99,235,0.18)] md:px-5"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_55%)] opacity-75 transition group-hover:opacity-100" />
                <div className="relative">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-500">Volver a feed</p>
                  <p className="mt-3 text-xl font-semibold uppercase tracking-[0.2em] text-zinc-100">MiAppSocialMovies</p>
                </div>
              </Link>
            </div>

            <div className="flex min-h-[220px] flex-col justify-center gap-5">
              <p className="text-center text-lg font-semibold text-zinc-100 md:text-left">Mis Películas Favoritas</p>
              <FavoriteMoviesBlock />
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,680px)_minmax(280px,340px)_minmax(80px,1fr)]">
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
            <MyActivityColumn />
            <div className="hidden xl:block" aria-hidden="true" />
          </div>
        </section>

        <SocialActivityTabsBlock />
      </div>
    </main>
  );
}
