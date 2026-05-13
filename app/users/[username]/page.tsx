"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import FavoriteMoviesBlock from "../../../components/profile-feed/FavoriteMoviesBlock";
import MyActivityColumn from "../../../components/profile-feed/MyActivityColumn";
import ProfileIdentityCard from "../../../components/profile-feed/ProfileIdentityCard";
import {
  cancelFriendRequest,
  deleteAcceptedFriendship,
  followUser,
  getUserProfileByUsername,
  sendFriendRequest,
  unfollowUser,
} from "../../../lib/profile-feed/adapters";
import { SocialUser } from "../../../lib/profile-feed/types";
import { getProfilePrivacySettings } from "../../../lib/privacy";
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


function SocialActions({
  profileUser,
  authenticatedFriendRequestsRestricted,
  onProfileUserChange,
}: {
  profileUser: SocialUser;
  authenticatedFriendRequestsRestricted: boolean | null;
  onProfileUserChange: (user: SocialUser) => void;
}) {
  const [pendingAction, setPendingAction] = useState<"follow" | "friend" | null>(null);
  const [isRemoveFriendModalOpen, setIsRemoveFriendModalOpen] = useState(false);
  const [friendActionError, setFriendActionError] = useState<string | null>(null);
  const isSelf = profileUser.friendshipStatus === "self";

  if (isSelf) return null;

  const handleFollowToggle = async () => {
    if (pendingAction || (profileUser.isFollowing !== true && profileUser.canFollow !== true)) return;
    const previousUser = profileUser;
    const nextIsFollowing = !profileUser.isFollowing;
    onProfileUserChange({
      ...profileUser,
      isFollowing: nextIsFollowing,
      canFollow: nextIsFollowing ? profileUser.canFollow : true,
    });
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
    if (pendingAction || authenticatedFriendRequestsRestricted !== false) return;
    setFriendActionError(null);
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

  const handleRemoveFriendClick = () => {
    if (pendingAction || profileUser.friendshipStatus !== "friends") return;

    setFriendActionError(null);

    if (!profileUser.friendshipId) {
      setFriendActionError("No se puede eliminar la amistad todavía: falta el friendship_id en la respuesta del perfil.");
      return;
    }

    setIsRemoveFriendModalOpen(true);
  };

  const handleConfirmRemoveFriend = async () => {
    if (pendingAction || profileUser.friendshipStatus !== "friends") return;

    if (!profileUser.friendshipId) {
      setIsRemoveFriendModalOpen(false);
      setFriendActionError("No se puede eliminar la amistad todavía: falta el friendship_id en la respuesta del perfil.");
      return;
    }

    const previousUser = profileUser;
    const nextCanSendFriendRequest = authenticatedFriendRequestsRestricted === false && profileUser.friendRequestsRestricted !== true;
    setPendingAction("friend");
    setFriendActionError(null);

    try {
      await deleteAcceptedFriendship(profileUser.friendshipId);
      setIsRemoveFriendModalOpen(false);
      onProfileUserChange({
        ...profileUser,
        friendshipStatus: "none",
        friendshipId: null,
        canSendFriendRequest: nextCanSendFriendRequest,
        ...(profileUser.isPrivateProfile === true
          ? {
              profileAccess: "restricted",
              canViewFullProfile: false,
            }
          : {}),
      });
    } catch {
      onProfileUserChange(previousUser);
      setFriendActionError("No se pudo eliminar la amistad. Inténtalo de nuevo.");
    } finally {
      setPendingAction(null);
    }
  };

  const canShowFollow = profileUser.isFollowing === true || profileUser.canFollow === true;
  const canShowFriendButton =
    profileUser.friendshipStatus === "friends" ||
    (authenticatedFriendRequestsRestricted === false &&
      (profileUser.friendshipStatus === "sent_pending" ||
        profileUser.friendshipStatus === "received_pending" ||
        (profileUser.friendshipStatus === "none" && profileUser.canSendFriendRequest === true)));

  if (!canShowFollow && !canShowFriendButton) return null;

  const friendButtonConfig = (() => {
    switch (profileUser.friendshipStatus) {
      case "sent_pending":
        return { label: "Enviada", className: "border-blue-300/50 bg-blue-600/90 text-white hover:bg-blue-500", disabled: false };
      case "friends":
        return { label: "Amigos", className: "border-violet-300/50 bg-violet-600/90 text-white hover:bg-violet-500", disabled: false };
      case "received_pending":
        return { label: "Solicitud recibida", className: "border-amber-300/50 bg-amber-500/15 text-amber-100", disabled: true };
      case "none":
      default:
        return { label: "Solicitud de amistad", className: "border-white/15 bg-zinc-900 text-zinc-100 hover:bg-zinc-800", disabled: false };
    }
  })();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
      {canShowFollow ? (
        <button
          type="button"
          onClick={handleFollowToggle}
          disabled={pendingAction === "follow"}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-70 ${
            profileUser.isFollowing
              ? "border-violet-300/50 bg-violet-600/90 text-white hover:bg-violet-500"
              : "border-white/15 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
          }`}
        >
          {profileUser.isFollowing ? "Siguiendo" : "Seguir"}
        </button>
      ) : null}
      {canShowFriendButton ? (
        <button
          type="button"
          onClick={profileUser.friendshipStatus === "friends" ? handleRemoveFriendClick : handleFriendRequest}
          disabled={friendButtonConfig.disabled || pendingAction === "friend"}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-default disabled:opacity-85 ${friendButtonConfig.className}`}
        >
          {friendButtonConfig.label}
        </button>
      ) : null}
      </div>

      {friendActionError ? (
        <p className="mt-3 max-w-xl rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100">
          {friendActionError}
        </p>
      ) : null}

      {isRemoveFriendModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.65)]">
            <p className="text-base font-medium leading-7 text-zinc-100">
              Si dejas de ser amigo de este usuario, no podrás enviarle ni recibir mensajes privados con él. ¿Quieres continuar?
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => setIsRemoveFriendModalOpen(false)}
                disabled={pendingAction === "friend"}
                className="rounded-full border border-white/15 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveFriend}
                disabled={pendingAction === "friend"}
                className="rounded-full border border-violet-300/50 bg-violet-600/90 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-wait disabled:opacity-70"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function UserProfileFeedPage() {
  const params = useParams<{ username?: string | string[] }>();
  const branding = useAppBranding();
  const routeUsername = resolveUsernameParam(params?.username);
  const [profileUser, setProfileUser] = useState<SocialUser | null>(null);
  const [authenticatedFriendRequestsRestricted, setAuthenticatedFriendRequestsRestricted] = useState<boolean | null>(null);

  const normalizedProfileAccess = profileUser?.profileAccess?.trim().toLocaleLowerCase();
  const hasLimitedAccess =
    normalizedProfileAccess === "restricted" &&
    profileUser?.friendshipStatus !== "friends" &&
    profileUser?.canViewFullProfile !== true;

  useEffect(() => {
    const loadAuthenticatedPrivacy = async () => {
      try {
        const privacySettings = await getProfilePrivacySettings();
        setAuthenticatedFriendRequestsRestricted(privacySettings.friendRequestsRestricted);
      } catch {
        setAuthenticatedFriendRequestsRestricted(true);
      }
    };

    void loadAuthenticatedPrivacy();
  }, []);

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
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_3fr] lg:items-end">
            <div className="flex flex-col gap-5 lg:self-end">
              <Link
                href="/profile-feed"
                className="inline-flex w-fit items-center rounded-full border border-white/20 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-blue-200/70 hover:text-blue-100"
              >
                ← Volver a mi perfil
              </Link>

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
                autoHeight
              />
            </div>

            <div className="flex min-h-[220px] flex-col justify-center gap-5">
              {profileUser ? (
                <SocialActions
                  profileUser={profileUser}
                  authenticatedFriendRequestsRestricted={authenticatedFriendRequestsRestricted}
                  onProfileUserChange={setProfileUser}
                />
              ) : null}
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
