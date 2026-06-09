import { FriendRequest, SocialUser } from "../../lib/profile-feed/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useMemo, useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import { interpolate } from "../../lib/i18n";

interface TopUsersSectionProps {
  friends: SocialUser[];
  following: SocialUser[];
  pendingRequests: FriendRequest[];
  loadingFriends: boolean;
  loadingFollowing: boolean;
  loadingPendingRequests: boolean;
  friendsError: string | null;
  followingError: string | null;
  pendingRequestsError: string | null;
  onRetryFriends: () => void;
  onRetryFollowing: () => void;
  onRetryPendingRequests: () => void;
  onAcceptFriendRequest: (request: FriendRequest) => void;
  onRejectFriendRequest: (request: FriendRequest) => void;
  onCancelFriendRequest: (request: FriendRequest) => void;
  authenticatedUsername?: string;
  redirectOwnClicksToProfileFeed?: boolean;
  friendRequestsRestricted?: boolean;
  initialConnectionView?: "friends" | "pending";
}

function UserRow({
  user,
  onNavigateUser,
}: {
  user: SocialUser;
  onNavigateUser?: (clickedUser: SocialUser) => void;
}) {
  const { t } = useI18n();
  const initials = user.username.slice(0, 2).toUpperCase();
  const title = user.username;
  const followersCopy =
    typeof user.followersCount === "number"
      ? user.followersCount === 1
        ? t("profileFeedFollowedByOne")
        : interpolate(t("profileFeedFollowedByMany"), { count: user.followersCount })
      : null;

  const href = `/users/${encodeURIComponent(user.username)}`;

  return (
    <article className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-b-0 last:pb-0 first:pt-0">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt={`Avatar de ${user.username}`} className="h-9 w-9 rounded-full border border-white/20 object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-zinc-900 text-xs font-semibold text-zinc-200">
          {initials}
        </div>
      )}
      <div className="min-w-0">
        {onNavigateUser ? (
          <button
            type="button"
            onClick={() => onNavigateUser(user)}
            className="truncate text-left text-sm font-medium text-zinc-100 transition hover:text-blue-200 focus-visible:text-blue-200 focus-visible:outline-none"
          >
            {title}
          </button>
        ) : (
          <Link href={href} className="truncate text-sm font-medium text-zinc-100 transition hover:text-blue-200 focus-visible:text-blue-200 focus-visible:outline-none">
            {title}
          </Link>
        )}
        {followersCopy ? <p className="text-xs text-zinc-400">{followersCopy}</p> : null}
      </div>
    </article>
  );
}

function PendingRequestRow({
  request,
  onAccept,
  onReject,
  onCancel,
  onNavigateUser,
}: {
  request: FriendRequest;
  onAccept: (request: FriendRequest) => void;
  onReject: (request: FriendRequest) => void;
  onCancel: (request: FriendRequest) => void;
  onNavigateUser?: (clickedUser: SocialUser) => void;
}) {
  const { locale, t } = useI18n();
  const user = request.user;
  const initials = user.username.slice(0, 2).toUpperCase();
  const title = user.username;
  const href = `/users/${encodeURIComponent(user.username)}`;

  return (
    <article className="flex items-start gap-3 border-b border-white/5 py-2.5 last:border-b-0 last:pb-0 first:pt-0">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt={`Avatar de ${user.username}`} className="h-9 w-9 rounded-full border border-white/20 object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-zinc-900 text-xs font-semibold text-zinc-200">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        {onNavigateUser ? (
          <button type="button" onClick={() => onNavigateUser(user)} className="block max-w-full truncate text-left text-sm font-medium text-zinc-100 transition hover:text-blue-200">
            {title}
          </button>
        ) : (
          <Link href={href} className="block max-w-full truncate text-sm font-medium text-zinc-100 transition hover:text-blue-200">
            {title}
          </Link>
        )}
        <p className="text-xs text-zinc-400">{request.direction === "sent" ? t("profileFeedRequestSent") : t("profileFeedRequestReceived")}</p>
        {request.direction === "received" ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onAccept(request)} className="rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-violet-500">
              {locale === "en" ? "Accept" : "Aceptar"}
            </button>
            <button type="button" onClick={() => onReject(request)} className="rounded-full border border-white/15 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-100 transition hover:bg-zinc-800">
              {locale === "en" ? "Delete" : "Eliminar"}
            </button>
          </div>
        ) : null}
      </div>
      {request.direction === "sent" ? (
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <button type="button" onClick={() => onCancel(request)} className="rounded-full border border-blue-300/40 bg-blue-600/20 px-2.5 py-1 text-[11px] font-semibold text-blue-100 transition hover:bg-blue-600/30">
            {locale === "en" ? "Cancel" : "Cancelar"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function Block({
  title,
  users,
  loading,
  emptyCopy,
  error,
  onRetry,
  onNavigateUser,
  centerEmpty = false,
  headerSlot,
}: {
  title: string;
  users: SocialUser[];
  loading: boolean;
  emptyCopy: string;
  error: string | null;
  onRetry: () => void;
  onNavigateUser?: (clickedUser: SocialUser) => void;
  centerEmpty?: boolean;
  headerSlot?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="flex h-[30rem] flex-col rounded-3xl border-2 border-white/15 bg-zinc-950/55 p-3.5 md:p-4">
      <header className="mb-2.5 flex items-center justify-between gap-3">
        {headerSlot ?? <h2 className="text-base font-semibold text-zinc-100">{title}</h2>}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {!loading && error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
            <p>{error}</p>
            <button type="button" onClick={onRetry} className="mt-2 rounded-full border border-red-200/30 bg-red-900/40 px-2.5 py-1 text-[11px] font-medium hover:bg-red-900/60">
              {t("profileFeedRetry")}
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="activity-scrollbar space-y-2.5 overflow-y-auto pr-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`${title}-skeleton-${index}`} className="flex animate-pulse items-center gap-3 py-2.5">
                <div className="h-9 w-9 rounded-full bg-zinc-800" />
                <div className="space-y-2">
                  <div className="h-2.5 w-24 rounded bg-zinc-700" />
                  <div className="h-2.5 w-32 rounded bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !error && users.length === 0 ? (
          centerEmpty ? (
            <div className="flex h-full items-center justify-center px-3 text-center">
              <p className="text-sm text-zinc-500">{emptyCopy}</p>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-zinc-500">{emptyCopy}</p>
          )
        ) : null}

        {!loading && !error && users.length > 0 ? (
          <div className="activity-scrollbar h-full overflow-y-auto pr-1">
            {users.map((user) => (
              <UserRow key={`${title}-${user.id}`} user={user} onNavigateUser={onNavigateUser} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PendingRequestsBlock({
  requests,
  loading,
  error,
  onRetry,
  onAccept,
  onReject,
  onCancel,
  onNavigateUser,
  headerSlot,
}: {
  requests: FriendRequest[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAccept: (request: FriendRequest) => void;
  onReject: (request: FriendRequest) => void;
  onCancel: (request: FriendRequest) => void;
  onNavigateUser?: (clickedUser: SocialUser) => void;
  headerSlot: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="flex h-[30rem] flex-col rounded-3xl border-2 border-white/15 bg-zinc-950/55 p-3.5 md:p-4">
      <header className="mb-2.5 flex items-center justify-between gap-3">
        {headerSlot}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {!loading && error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
            <p>{error}</p>
            <button type="button" onClick={onRetry} className="mt-2 rounded-full border border-red-200/30 bg-red-900/40 px-2.5 py-1 text-[11px] font-medium hover:bg-red-900/60">
              {t("profileFeedRetry")}
            </button>
          </div>
        ) : null}
        {loading ? <p className="py-6 text-center text-sm text-zinc-500">{t("profileFeedLoading")}</p> : null}
        {!loading && !error && requests.length === 0 ? <p className="py-6 text-center text-sm text-zinc-500">{t("profileFeedNoPendingRequests")}</p> : null}
        {!loading && !error && requests.length > 0 ? (
          <div className="activity-scrollbar h-full overflow-y-auto pr-1">
            {requests.map((request) => (
              <PendingRequestRow key={`pending-${request.id}`} request={request} onAccept={onAccept} onReject={onReject} onCancel={onCancel} onNavigateUser={onNavigateUser} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function TopUsersSection({
  friends,
  following,
  pendingRequests,
  loadingFriends,
  loadingFollowing,
  loadingPendingRequests,
  friendsError,
  followingError,
  pendingRequestsError,
  onRetryFriends,
  onRetryFollowing,
  onRetryPendingRequests,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onCancelFriendRequest,
  authenticatedUsername,
  redirectOwnClicksToProfileFeed = false,
  friendRequestsRestricted = false,
  initialConnectionView = "friends",
}: TopUsersSectionProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [activeConnectionView, setActiveConnectionView] = useState<"friends" | "pending">(initialConnectionView);
  const receivedPendingRequestsCount = useMemo(
    () => pendingRequests.filter((request) => request.direction === "received").length,
    [pendingRequests],
  );
  const normalizedAuthenticatedUsername = authenticatedUsername?.trim().toLocaleLowerCase() ?? "";
  const effectiveConnectionView = friendRequestsRestricted ? "friends" : activeConnectionView;
  const restrictedFriendRequestsCopy = t("profileFeedRequestRejected");
  const shouldShowRestrictedFriendsEmptyState = effectiveConnectionView === "friends" && friendRequestsRestricted;

  const handleNavigateUser = (clickedUser: SocialUser) => {
    if (
      redirectOwnClicksToProfileFeed &&
      normalizedAuthenticatedUsername &&
      clickedUser.username.toLocaleLowerCase() === normalizedAuthenticatedUsername
    ) {
      router.push("/profile-feed");
      return;
    }

    router.push(`/users/${encodeURIComponent(clickedUser.username)}`);
  };

  const activeConnectionTabClass = "bg-zinc-100 text-zinc-950 shadow-[0_10px_20px_rgba(0,0,0,0.35)]";

  const connectionHeader = (
    <div className="flex w-full items-center justify-start">
      <div className="inline-flex h-9 rounded-full border border-white/15 bg-zinc-900/75 p-1" role="tablist" aria-label={t("profileFeedFriends")}>
        <button
          type="button"
          role="tab"
          aria-selected={effectiveConnectionView === "friends"}
          onClick={() => setActiveConnectionView("friends")}
          className={`rounded-full px-3 text-sm font-semibold transition ${
            effectiveConnectionView === "friends" ? activeConnectionTabClass : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          {t("profileFeedFriends")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={effectiveConnectionView === "pending"}
          disabled={friendRequestsRestricted}
          onClick={() => {
            if (friendRequestsRestricted) return;
            setActiveConnectionView("pending");
          }}
          className={`relative rounded-full px-3 text-sm font-semibold transition disabled:cursor-default ${
            effectiveConnectionView === "pending" ? activeConnectionTabClass : "text-zinc-400 hover:text-zinc-100 disabled:hover:text-zinc-400"
          }`}
        >
          {t("profileFeedPending")}
          {receivedPendingRequestsCount > 0 ? (
            <span className="pointer-events-none absolute -right-1.5 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-400 px-1 text-[10px] font-bold leading-none text-zinc-950 shadow-[0_6px_18px_rgba(59,130,246,0.35)]">
              {receivedPendingRequestsCount}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );

  return (
    <section className="grid w-full max-w-[640px] gap-3 sm:grid-cols-2 lg:max-w-[680px]">
      <Block
        title={t("profileFeedFollowing")}
        users={following}
        loading={loadingFollowing}
        emptyCopy={locale === "en" ? "You are not following anyone yet" : "Aún no sigues a ningún usuario"}
        error={followingError}
        onRetry={onRetryFollowing}
        onNavigateUser={redirectOwnClicksToProfileFeed ? handleNavigateUser : undefined}
      />
      {effectiveConnectionView === "friends" ? (
        <Block
          title={t("profileFeedFriends")}
          headerSlot={connectionHeader}
          users={friendRequestsRestricted ? [] : friends}
          loading={friendRequestsRestricted ? false : loadingFriends}
          emptyCopy={friendRequestsRestricted ? restrictedFriendRequestsCopy : locale === "en" ? "You have no friends added yet" : "Aún no tienes amigos agregados"}
          centerEmpty={shouldShowRestrictedFriendsEmptyState}
          error={friendsError}
          onRetry={onRetryFriends}
          onNavigateUser={redirectOwnClicksToProfileFeed ? handleNavigateUser : undefined}
        />
      ) : (
        <PendingRequestsBlock
          headerSlot={connectionHeader}
          requests={pendingRequests}
          loading={loadingPendingRequests}
          error={pendingRequestsError}
          onRetry={onRetryPendingRequests}
          onAccept={onAcceptFriendRequest}
          onReject={onRejectFriendRequest}
          onCancel={onCancelFriendRequest}
          onNavigateUser={redirectOwnClicksToProfileFeed ? handleNavigateUser : undefined}
        />
      )}
    </section>
  );
}
