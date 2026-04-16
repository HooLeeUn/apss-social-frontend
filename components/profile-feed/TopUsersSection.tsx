import { SocialUser } from "../../lib/profile-feed/types";

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
  console.log("FOLLOWING USER:", user);

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
        <p className="text-xs text-zinc-400">Lo siguen {user.followersCount ?? 0} usuarios</p>
      </div>
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
}: {
  title: string;
  users: SocialUser[];
  loading: boolean;
  emptyCopy: string;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-3xl border border-white/15 bg-zinc-950/55 p-3.5 md:p-4">
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        <button type="button" className="text-sm text-zinc-300 transition hover:text-blue-200">
          Todos
        </button>
      </header>
      <div>
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
          <div className="space-y-2.5">
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

        {!loading && !error && users.length === 0 ? <p className="py-1 text-sm text-zinc-500">{emptyCopy}</p> : null}

        {!loading && !error
          ? users.map((user) => (
              <UserRow key={`${title}-${user.id}`} user={user} />
            ))
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
  return (
    <section className="grid w-full max-w-[640px] gap-3 sm:grid-cols-2 lg:max-w-[680px]">
      <Block
        title="Seguidos"
        users={following}
        loading={loadingFollowing}
        emptyCopy="Aún no sigues a ningún usuario"
        error={followingError}
        onRetry={onRetryFollowing}
      />
      <Block
        title="Amigos"
        users={friends}
        loading={loadingFriends}
        emptyCopy="Aún no tienes amigos agregados"
        error={friendsError}
        onRetry={onRetryFriends}
      />
    </section>
  );
}
