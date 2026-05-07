"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import FavoriteMoviesBlock from "../../../components/profile-feed/FavoriteMoviesBlock";
import MyActivityColumn from "../../../components/profile-feed/MyActivityColumn";
import ProfileIdentityCard from "../../../components/profile-feed/ProfileIdentityCard";
import {
  cancelFriendRequest,
  followUser,
  getUserProfileByUsername,
  sendFriendRequest,
  unfollowUser,
} from "../../../lib/profile-feed/adapters";
import { SocialUser } from "../../../lib/profile-feed/types";
import { useAppBranding } from "../../../hooks/useAppBranding";

function resolveUsernameParam(rawValue: string | string[] | undefined): string {
  if (Array.isArray(rawValue)) {
    const candidate = rawValue[0];
    if (!candidate) return "";
    return decodeURIComponent(candidate).trim();
  }

  if (!rawValue) return "";
  return decodeURIComponent(rawValue).trim();
}


function SocialActions({ profileUser, onProfileUserChange }: { profileUser: SocialUser; onProfileUserChange: (user: SocialUser) => void }) {
  const [pendingAction, setPendingAction] = useState<"follow" | "friend" | null>(null);
  const isSelf = profileUser.friendshipStatus === "self";

  if (isSelf) return null;

  const handleFollowToggle = async () => {
    if (pendingAction || !profileUser.canFollow) return;
    const previousUser = profileUser;
    const nextIsFollowing = !profileUser.isFollowing;
    onProfileUserChange({ ...profileUser, isFollowing: nextIsFollowing });
    setPendingAction("follow");

    try {
      if (nextIsFollowing) {
        await followUser(profileUser.username);
      } else {
        await unfollowUser(profileUser.username);
      }
    } catch {
      onProfileUserChange(previousUser);
    } finally {
      setPendingAction(null);
    }
  };

  const handleFriendRequest = async () => {
    if (pendingAction) return;
    const previousUser = profileUser;
    setPendingAction("friend");

    try {
      if (profileUser.friendshipStatus === "none") {
        onProfileUserChange({ ...profileUser, friendshipStatus: "sent_pending", canSendFriendRequest: false });
        await sendFriendRequest(profileUser.username);
      } else if (profileUser.friendshipStatus === "sent_pending") {
        onProfileUserChange({ ...profileUser, friendshipStatus: "none", canSendFriendRequest: true });
        await cancelFriendRequest(profileUser.username);
      }
    } catch {
      onProfileUserChange(previousUser);
    } finally {
      setPendingAction(null);
    }
  };

  const canShowFollow = profileUser.canFollow === true;
  const canShowFriendButton =
    profileUser.friendshipStatus === "friends" ||
    profileUser.friendshipStatus === "sent_pending" ||
    profileUser.friendshipStatus === "received_pending" ||
    (profileUser.friendshipStatus === "none" && profileUser.canSendFriendRequest === true);

  if (!canShowFollow && !canShowFriendButton) return null;

  const friendButtonConfig = (() => {
    switch (profileUser.friendshipStatus) {
      case "sent_pending":
        return { label: "Enviada", className: "border-blue-300/50 bg-blue-600/90 text-white hover:bg-blue-500", disabled: false };
      case "friends":
        return { label: "Amigos", className: "border-violet-300/50 bg-violet-600/90 text-white", disabled: true };
      case "received_pending":
        return { label: "Solicitud recibida", className: "border-amber-300/50 bg-amber-500/15 text-amber-100", disabled: true };
      case "none":
      default:
        return { label: "Solicitud de amistad", className: "border-white/15 bg-zinc-900 text-zinc-100 hover:bg-zinc-800", disabled: false };
    }
  })();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canShowFollow ? (
        <button
          type="button"
          onClick={handleFollowToggle}
          disabled={pendingAction === "follow"}
          className="rounded-full border border-white/15 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-70"
        >
          {profileUser.isFollowing ? "Siguiendo" : "Seguir"}
        </button>
      ) : null}
      {canShowFriendButton ? (
        <button
          type="button"
          onClick={handleFriendRequest}
          disabled={friendButtonConfig.disabled || pendingAction === "friend"}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-default disabled:opacity-85 ${friendButtonConfig.className}`}
        >
          {friendButtonConfig.label}
        </button>
      ) : null}
    </div>
  );
}

export default function UserProfileFeedPage() {
  const params = useParams<{ username?: string | string[] }>();
  const branding = useAppBranding();
  const routeUsername = resolveUsernameParam(params?.username);
  const [profileUser, setProfileUser] = useState<SocialUser | null>(null);

  const normalizedProfileAccess = profileUser?.profileAccess?.trim().toLocaleLowerCase();
  const hasLimitedAccess =
    profileUser?.canViewFullProfile === false ||
    profileUser?.isPrivateProfile === true ||
    profileUser?.isRestrictedByVisitedUser === true ||
    normalizedProfileAccess === "restricted" ||
    normalizedProfileAccess === "limited" ||
    normalizedProfileAccess === "private";

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

  const profileTitleName = profileUser?.displayName || profileUser?.username || routeUsername || "Usuario";
  const profileHandle = profileUser?.username || routeUsername || "usuario";

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8 md:px-8">
        <section className="rounded-3xl bg-zinc-950/55 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.36)] md:p-6">
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
              appBranding={branding}
              logoSlot="visited_profile_logo_url"
            />

            <div className="flex min-h-[220px] flex-col justify-center gap-5">
              {profileUser ? <SocialActions profileUser={profileUser} onProfileUserChange={setProfileUser} /> : null}
              {!hasLimitedAccess ? <FavoriteMoviesBlock title={`Favoritas de ${profileTitleName}`} readOnly viewedUsername={routeUsername} /> : null}
            </div>
          </div>
        </section>

        {!hasLimitedAccess ? (
          <section className="w-full">
            <div className="grid items-start gap-6">
              <MyActivityColumn
                isOwnProfile={false}
                viewedUsername={routeUsername}
                title={`Actividad de ${profileTitleName}`}
                emptyCopy="Este usuario no tiene actividad social visible aún."
                errorCopy="No se pudo cargar la actividad de este usuario."
              />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
