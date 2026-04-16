import { SocialUser } from "../../lib/profile-feed/types";
import { useMemo, useState } from "react";

interface TopUsersSectionProps {
  friends: SocialUser[];
  following: SocialUser[];
  loadingFriends: boolean;
  loadingFollowing: boolean;
  friendsError: string | null;
  followingError: string | null;
  onRetryFriends: () => void;
  onRetryFollowing: () => void;
}

function UserRow({ user }: { user: SocialUser }) {
  const initials = user.username.slice(0, 2).toUpperCase();
  const title = user.displayName || user.username;

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
        <p className="truncate text-sm font-medium text-zinc-100">{title}</p>
        {typeof user.followersCount === "number" ? (
          <p className="text-xs text-zinc-400">Lo siguen {user.followersCount} usuarios</p>
        ) : null}
      </div>
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
}: {
  title: string;
  users: SocialUser[];
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  emptyCopy: string;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="flex h-[30rem] flex-col rounded-3xl border border-white/15 bg-zinc-950/55 p-3.5 md:p-4">
      <header className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar"
          aria-label={`Buscar en ${title}`}
          className="h-8 w-24 rounded-full border border-white/15 bg-zinc-900/75 px-3 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-blue-300/60 focus:bg-zinc-900"
        />
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {!loading && error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
            <p>{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-full border border-red-200/30 bg-red-900/40 px-2.5 py-1 text-[11px] font-medium hover:bg-red-900/60"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-2.5 overflow-y-auto pr-1">
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
          <p className="py-6 text-center text-sm text-zinc-500">{emptyCopy}</p>
        ) : null}

        {!loading && !error
          ? (
              <div className="h-full overflow-y-auto pr-1">
                {users.map((user) => (
                  <UserRow key={`${title}-${user.id}`} user={user} />
                ))}
              </div>
            )
          : null}
      </div>
    </section>
  );
}

export default function TopUsersSection({
  friends,
  following,
  loadingFriends,
  loadingFollowing,
  friendsError,
  followingError,
  onRetryFriends,
  onRetryFollowing,
}: TopUsersSectionProps) {
  const [followingQuery, setFollowingQuery] = useState("");
  const [friendsQuery, setFriendsQuery] = useState("");

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

  const filteredFollowing = useMemo(() => filterUsers(following, followingQuery), [following, followingQuery]);
  const filteredFriends = useMemo(() => filterUsers(friends, friendsQuery), [friends, friendsQuery]);

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
      />
      <Block
        title="Amigos"
        users={filteredFriends}
        query={friendsQuery}
        onQueryChange={setFriendsQuery}
        loading={loadingFriends}
        emptyCopy={friendsQuery.trim() ? "Sin coincidencias en amigos" : "Aún no tienes amigos agregados"}
        error={friendsError}
        onRetry={onRetryFriends}
      />
    </section>
  );
}
