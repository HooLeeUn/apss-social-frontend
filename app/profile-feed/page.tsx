"use client";

import { useCallback, useEffect, useState } from "react";
import FavoriteMoviesBlock from "../../components/profile-feed/FavoriteMoviesBlock";
import MyActivityColumn from "../../components/profile-feed/MyActivityColumn";
import ProfileIdentityCard from "../../components/profile-feed/ProfileIdentityCard";
import SocialActivityTabsBlock from "../../components/profile-feed/SocialActivityTabsBlock";
import TopUsersSection from "../../components/profile-feed/TopUsersSection";
import { getMyProfile, getTopFollowing, getTopFriends } from "../../lib/profile-feed/adapters";
import { SocialUser } from "../../lib/profile-feed/types";
import { getPersonalData } from "../../lib/personal-data";

export default function ProfileFeedPage() {
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<SocialUser | null>(null);

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

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/55 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.36)] md:p-6">
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
              />
            </div>

            <div className="flex min-h-[220px] flex-col justify-center gap-5">
              <p className="text-center text-lg font-semibold text-zinc-100 md:text-left">Mis Películas Favoritas</p>
              <FavoriteMoviesBlock />
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,680px)_minmax(296px,360px)_minmax(460px,1.25fr)]">
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
            <MyActivityColumn isOwnProfile />
            <div className="hidden xl:block" aria-hidden="true" />
          </div>
        </section>

        <SocialActivityTabsBlock />
      </div>
    </main>
  );
}
