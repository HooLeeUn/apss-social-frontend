"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import FavoriteMoviesBlock from "../../../components/profile-feed/FavoriteMoviesBlock";
import MyActivityColumn from "../../../components/profile-feed/MyActivityColumn";
import ProfileIdentityCard from "../../../components/profile-feed/ProfileIdentityCard";
import TopUsersSection from "../../../components/profile-feed/TopUsersSection";
import {
  getMyProfile,
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
  const [authenticatedUsername, setAuthenticatedUsername] = useState<string>("");

  const normalizedProfileAccess = profileUser?.profileAccess?.trim().toLocaleLowerCase();
  const hasLimitedAccess =
    profileUser?.canViewFullProfile === false ||
    normalizedProfileAccess === "restricted" ||
    normalizedProfileAccess === "limited" ||
    normalizedProfileAccess === "private";

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
    if (hasLimitedAccess) {
      setFollowing([]);
      setFriends([]);
      setLoadingFollowing(false);
      setLoadingFriends(false);
      setFollowingError(null);
      setFriendsError(null);
      return;
    }

    void loadFollowing();
    void loadFriends();
  }, [hasLimitedAccess, loadFollowing, loadFriends]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!routeUsername) {
        setProfileUser(null);
        return;
      }

      try {
        const profile = await getUserProfileByUsername(routeUsername);
        setProfileUser(profile);
      } catch {
        setProfileUser(null);
      }
    };

    void loadProfile();
  }, [routeUsername]);

  useEffect(() => {
    const loadAuthenticated = async () => {
      try {
        const me = await getMyProfile();
        setAuthenticatedUsername(me?.username ?? "");
      } catch {
        setAuthenticatedUsername("");
      }
    };

    void loadAuthenticated();
  }, []);

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
            <ProfileIdentityCard
              username={profileHandle}
              avatarUrl={profileUser?.avatarUrl}
              firstName={profileUser?.firstName}
              lastName={profileUser?.lastName}
              age={profileUser?.age}
              ageVisible={profileUser?.ageVisible}
              genderIdentity={profileUser?.genderIdentity}
              genderIdentityVisible={profileUser?.genderIdentityVisible}
            />

            <div className="flex min-h-[220px] flex-col justify-center gap-5">
              {!hasLimitedAccess ? <FavoriteMoviesBlock title={`Favoritas de ${profileTitleName}`} readOnly viewedUsername={routeUsername} /> : null}
            </div>
          </div>
        </section>

        {!hasLimitedAccess ? (
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
                authenticatedUsername={authenticatedUsername}
                redirectOwnClicksToProfileFeed
              />
              <MyActivityColumn
                isOwnProfile={false}
                viewedUsername={routeUsername}
                title={`Actividad de ${profileTitleName}`}
                emptyCopy="Este usuario no tiene actividad social visible aún."
                errorCopy="No se pudo cargar la actividad de este usuario."
              />
              <div className="hidden xl:block" aria-hidden="true" />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
