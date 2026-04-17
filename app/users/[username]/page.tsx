"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import FavoriteMoviesBlock from "../../../components/profile-feed/FavoriteMoviesBlock";
import MyActivityColumn from "../../../components/profile-feed/MyActivityColumn";
import TopUsersSection from "../../../components/profile-feed/TopUsersSection";
import {
  getTopFollowingByUsername,
  getTopFriendsByUsername,
  getUserProfileByUsername,
} from "../../../lib/profile-feed/adapters";
import { SocialUser } from "../../../lib/profile-feed/types";

function resolveUsernameParam(rawValue: string | string[] | undefined): string {
  if (Array.isArray(rawValue)) {
    const candidate = rawValue[0];
    if (!candidate) return "";
    return decodeURIComponent(candidate).trim();
  }

  if (!rawValue) return "";
  return decodeURIComponent(rawValue).trim();
}

export default function UserProfileFeedPage() {
  const params = useParams<{ username?: string | string[] }>();
  const routeUsername = resolveUsernameParam(params?.username);
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<SocialUser | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const loadFollowing = useCallback(async () => {
    if (!routeUsername) {
      setFollowing([]);
      setLoadingFollowing(false);
      setFollowingError("Usuario inválido.");
      return;
    }

    setLoadingFollowing(true);
    setFollowingError(null);
    try {
      const topFollowing = await getTopFollowingByUsername(routeUsername);
      setFollowing(topFollowing);
    } catch {
      setFollowing([]);
      setFollowingError("No se pudieron cargar los seguidos de este perfil.");
    } finally {
      setLoadingFollowing(false);
    }
  }, [routeUsername]);

  const loadFriends = useCallback(async () => {
    if (!routeUsername) {
      setFriends([]);
      setLoadingFriends(false);
      setFriendsError("Usuario inválido.");
      return;
    }

    setLoadingFriends(true);
    setFriendsError(null);
    try {
      const topFriends = await getTopFriendsByUsername(routeUsername);
      setFriends(topFriends);
    } catch {
      setFriends([]);
      setFriendsError("No se pudieron cargar los amigos de este perfil.");
    } finally {
      setLoadingFriends(false);
    }
  }, [routeUsername]);

  useEffect(() => {
    void loadFollowing();
    void loadFriends();
  }, [loadFollowing, loadFriends]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!routeUsername) {
        setProfileUser(null);
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);
      try {
        const profile = await getUserProfileByUsername(routeUsername);
        setProfileUser(profile);
      } catch {
        setProfileUser(null);
      } finally {
        setLoadingProfile(false);
      }
    };

    void loadProfile();
  }, [routeUsername]);

  const displayName = useMemo(
    () => profileUser?.displayName || profileUser?.username || routeUsername || "Usuario",
    [profileUser, routeUsername],
  );
  const initials = displayName.slice(0, 2).toUpperCase();
  const profileTitleName = profileUser?.displayName || profileUser?.username || routeUsername || "Usuario";
  const profileHandle = profileUser?.username || routeUsername || "usuario";

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/55 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.36)] md:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <Link
              href="/profile-feed"
              className="inline-flex items-center rounded-full border border-white/20 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-blue-200/70 hover:text-blue-100"
            >
              ← Volver a mi perfil
            </Link>
          </div>

          <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_3fr]">
            <div className="rounded-3xl border border-white/15 bg-zinc-900/75 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
              <div className="flex items-center gap-3">
                {profileUser?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileUser.avatarUrl} alt={`Avatar de ${displayName}`} className="h-16 w-16 rounded-full border border-white/20 object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-zinc-800 text-lg font-semibold text-zinc-200">
                    {initials}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-sm uppercase tracking-[0.18em] text-zinc-500">Perfil público</p>
                  <p className="truncate text-lg font-semibold text-zinc-100">{profileTitleName}</p>
                  <p className="truncate text-xs text-zinc-400">@{profileHandle}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Información personal</p>
                <p className="mt-2 text-sm text-zinc-400">
                  {loadingProfile ? "Cargando perfil..." : "Información personal disponible próximamente."}
                </p>
              </div>
            </div>

            <div className="flex min-h-[220px] flex-col justify-center gap-5">
              <FavoriteMoviesBlock title={`Favoritas de ${profileTitleName}`} readOnly viewedUsername={routeUsername} />
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
            <MyActivityColumn
              scope={routeUsername ? `user:${routeUsername}` : "user:unknown"}
              title={`Actividad de ${profileTitleName}`}
              emptyCopy="Este usuario no tiene actividad social visible aún."
              errorCopy="No se pudo cargar la actividad de este usuario."
            />
            <div className="hidden xl:block" aria-hidden="true" />
          </div>
        </section>
      </div>
    </main>
  );
}
