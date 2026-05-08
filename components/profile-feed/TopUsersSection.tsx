import { FriendRequest, SocialUser } from "../../lib/profile-feed/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

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
  const initials = user.username.slice(0, 2).toUpperCase();
  const title = user.displayName || user.username;
  const followersCopy =
    typeof user.followersCount === "number"
      ? user.followersCount === 1
        ? "Lo sigue 1 usuario"
        : `Lo siguen ${user.followersCount} usuarios`
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
  const user = request.user;
  const initials = user.username.slice(0, 2).toUpperCase();
  const title = user.displayName || user.username;
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
        <p className="text-xs text-zinc-400">{request.direction === "sent" ? "Solicitud enviada" : "Solicitud recibida"}</p>
        {request.direction === "received" ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onAccept(request)} className="rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-violet-500">
              Aceptar
            </button>
            <button type="button" onClick={() => onReject(request)} className="rounded-full border border-white/15 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-100 transition hover:bg-zinc-800">
              Eliminar
            </button>
          </div>
        ) : null}
      </div>
      {request.direction === "sent" ? (
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <button type="button" onClick={() => onCancel(request)} className="rounded-full border border-blue-300/40 bg-blue-600/20 px-2.5 py-1 text-[11px] font-semibold text-blue-100 transition hover:bg-blue-600/30">
            Cancelar
          </button>
        </div>
      ) : null}
    </article>
  );
}

function Block({
  title,
  users,
  query,
  onQueryChange,
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
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  emptyCopy: string;
  error: string | null;
  onRetry: () => void;
  onNavigateUser?: (clickedUser: SocialUser) => void;
  centerEmpty?: boolean;
  headerSlot?: ReactNode;
}) {
  return (
    <section className="flex h-[30rem] flex-col rounded-3xl border-2 border-white/15 bg-zinc-950/55 p-3.5 md:p-4">
      <header className="mb-2.5 flex items-center justify-between gap-3">
        {headerSlot ?? <h2 className="text-base font-semibold text-zinc-100">{title}</h2>}
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar"
          aria-label={`Buscar en ${title}`}
          className="h-9 w-40 rounded-full border border-white/15 bg-zinc-900/75 px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-blue-300/60 focus:bg-zinc-900"
        />
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {!loading && error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
            <p>{error}</p>
            <button type="button" onClick={onRetry} className="mt-2 rounded-full border border-red-200/30 bg-red-900/40 px-2.5 py-1 text-[11px] font-medium hover:bg-red-900/60">
              Reintentar
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
  query,
  onQueryChange,
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
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAccept: (request: FriendRequest) => void;
  onReject: (request: FriendRequest) => void;
  onCancel: (request: FriendRequest) => void;
  onNavigateUser?: (clickedUser: SocialUser) => void;
  headerSlot: ReactNode;
}) {
  return (
    <section className="flex h-[30rem] flex-col rounded-3xl border-2 border-white/15 bg-zinc-950/55 p-3.5 md:p-4">
      <header className="mb-2.5 flex items-center justify-between gap-3">
        {headerSlot}
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar"
          aria-label="Buscar en Pendientes"
          className="h-9 w-40 rounded-full border border-white/15 bg-zinc-900/75 px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-blue-300/60 focus:bg-zinc-900"
        />
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {!loading && error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
            <p>{error}</p>
            <button type="button" onClick={onRetry} className="mt-2 rounded-full border border-red-200/30 bg-red-900/40 px-2.5 py-1 text-[11px] font-medium hover:bg-red-900/60">
              Reintentar
            </button>
          </div>
        ) : null}
        {loading ? <p className="py-6 text-center text-sm text-zinc-500">Cargando solicitudes…</p> : null}
        {!loading && !error && requests.length === 0 ? <p className="py-6 text-center text-sm text-zinc-500">No tienes solicitudes pendientes</p> : null}
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
  const [followingQuery, setFollowingQuery] = useState("");
  const [friendsQuery, setFriendsQuery] = useState("");
  const [activeConnectionView, setActiveConnectionView] = useState<"friends" | "pending">(initialConnectionView);

  const filterUsers = (users: SocialUser[], query: string) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return users;
    }

    return users.filter((user) => {
      const username = user.username.toLocaleLowerCase();
      const displayName = user.displayName?.toLocaleLowerCase() ?? "";
      return username.includes(normalizedQuery) || displayName.includes(normalizedQuery);
    });
  };

  const filterRequests = (requests: FriendRequest[], query: string) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return requests;
    return requests.filter((request) => {
      const username = request.user.username.toLocaleLowerCase();
      const displayName = request.user.displayName?.toLocaleLowerCase() ?? "";
      return username.includes(normalizedQuery) || displayName.includes(normalizedQuery);
    });
  };

  const filteredFollowing = useMemo(() => filterUsers(following, followingQuery), [following, followingQuery]);
  const filteredFriends = useMemo(() => filterUsers(friends, friendsQuery), [friends, friendsQuery]);
  const filteredPendingRequests = useMemo(() => filterRequests(pendingRequests, friendsQuery), [pendingRequests, friendsQuery]);
  const receivedPendingRequestsCount = useMemo(
    () => pendingRequests.filter((request) => request.direction === "received").length,
    [pendingRequests],
  );
  const normalizedAuthenticatedUsername = authenticatedUsername?.trim().toLocaleLowerCase() ?? "";
  const shouldShowRestrictedFriendsEmptyState = activeConnectionView === "friends" && friendRequestsRestricted && !friendsQuery.trim();

  useEffect(() => {
    setActiveConnectionView(initialConnectionView);
  }, [initialConnectionView]);

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

  const connectionHeader = (
    <div className="relative w-fit">
      <select
        aria-label="Seleccionar vista de amistades"
        value={activeConnectionView}
        onChange={(event) => setActiveConnectionView(event.target.value === "pending" ? "pending" : "friends")}
        className="appearance-none rounded-xl border border-white/20 bg-zinc-900/80 px-3 py-1.5 pr-8 text-base font-semibold text-zinc-100 outline-none transition hover:border-white/30 hover:bg-zinc-900 focus:border-white/20"
      >
        <option value="friends" className="bg-zinc-950 text-zinc-100">Amigos</option>
        <option value="pending" className="bg-zinc-950 text-zinc-100">Pendientes</option>
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-300">▾</span>
      {receivedPendingRequestsCount > 0 ? (
        <span className="pointer-events-none absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-400 px-1 text-[10px] font-bold leading-none text-zinc-950 shadow-[0_6px_18px_rgba(59,130,246,0.35)]">
          {receivedPendingRequestsCount}
        </span>
      ) : null}
    </div>
  );

  return (
    <section className="grid w-full max-w-[640px] gap-3 sm:grid-cols-2 lg:max-w-[680px]">
      <Block
        title="Seguidos"
        users={filteredFollowing}
        query={followingQuery}
        onQueryChange={setFollowingQuery}
        loading={loadingFollowing}
        emptyCopy={followingQuery.trim() ? "Sin coincidencias en seguidos" : "Aún no sigues a ningún usuario"}
        error={followingError}
        onRetry={onRetryFollowing}
        onNavigateUser={redirectOwnClicksToProfileFeed ? handleNavigateUser : undefined}
      />
      {activeConnectionView === "friends" ? (
        <Block
          title="Amigos"
          headerSlot={connectionHeader}
          users={filteredFriends}
          query={friendsQuery}
          onQueryChange={setFriendsQuery}
          loading={loadingFriends}
          emptyCopy={
            friendsQuery.trim()
              ? "Sin coincidencias en amigos"
              : friendRequestsRestricted
                ? "Restringiste solicitudes de amistad, solo puedes tener Seguidores"
                : "Aún no tienes amigos agregados"
          }
          centerEmpty={shouldShowRestrictedFriendsEmptyState}
          error={friendsError}
          onRetry={onRetryFriends}
          onNavigateUser={redirectOwnClicksToProfileFeed ? handleNavigateUser : undefined}
        />
      ) : (
        <PendingRequestsBlock
          headerSlot={connectionHeader}
          requests={filteredPendingRequests}
          query={friendsQuery}
          onQueryChange={setFriendsQuery}
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
