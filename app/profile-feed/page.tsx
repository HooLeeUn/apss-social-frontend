"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FavoriteMoviesBlock from "../../components/profile-feed/FavoriteMoviesBlock";
import SocialActivityTabsBlock from "../../components/profile-feed/SocialActivityTabsBlock";
import TopUsersSection from "../../components/profile-feed/TopUsersSection";
import { getFavoriteMovies, getTopFollowing, getTopFriends } from "../../lib/profile-feed/adapters";
import { FavoriteMovie, SocialUser } from "../../lib/profile-feed/types";

export default function ProfileFeedPage() {
  const [favorites, setFavorites] = useState<FavoriteMovie[]>([]);
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);

  useEffect(() => {
    const load = async () => {
      const [favMovies, topFriends, topFollowing] = await Promise.all([
        getFavoriteMovies(),
        getTopFriends(),
        getTopFollowing(),
      ]);

      setFavorites(favMovies);
      setFriends(topFriends);
      setFollowing(topFollowing);
    };

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/55 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.36)] md:p-6">
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/15 bg-zinc-900/70 px-4 py-3 text-sm uppercase tracking-[0.2em] text-zinc-300">
                MiAppSocialMovies
              </div>
              <Link
                href="/feed"
                className="inline-flex rounded-full border border-white/20 bg-zinc-900/70 px-4 py-2 text-xs text-zinc-300 transition hover:border-white/40 hover:text-zinc-100"
              >
                Volver al feed
              </Link>
            </div>

            <div className="space-y-4">
              <p className="text-center text-lg font-semibold text-zinc-100">Mis Películas Favoritas</p>
              <div className="grid gap-2">
                <div className="h-[1px] bg-white/10" />
                <div className="h-[1px] bg-white/10" />
                <div className="h-[1px] bg-white/10" />
                <div className="h-[1px] bg-white/10" />
              </div>
              <FavoriteMoviesBlock movies={favorites} />
            </div>
          </div>
        </section>

        <TopUsersSection friends={friends} following={following} />

        <SocialActivityTabsBlock />
      </div>
    </main>
  );
}
