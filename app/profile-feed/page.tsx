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
