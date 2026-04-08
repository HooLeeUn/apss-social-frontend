import { SocialUser } from "../../lib/profile-feed/types";

interface TopUsersSectionProps {
  friends: SocialUser[];
  following: SocialUser[];
}

function UserMiniCard({ user }: { user: SocialUser }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950/80 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-zinc-900 text-xs font-semibold text-zinc-200">
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-100">{user.username}</p>
          <p className="text-xs text-zinc-400">Lo siguen {user.followersCount} usuarios</p>
        </div>
      </div>
    </article>
  );
}

function Block({ title, users }: { title: string; users: SocialUser[] }) {
  return (
    <section className="rounded-3xl border border-white/15 bg-zinc-950/55 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        <button type="button" className="text-sm text-zinc-300 transition hover:text-blue-200">
          Todos
        </button>
      </header>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
        {users.map((user) => (
          <UserMiniCard key={`${title}-${user.id}`} user={user} />
        ))}
      </div>
    </section>
  );
}

export default function TopUsersSection({ friends, following }: TopUsersSectionProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <Block title="Amigos" users={friends} />
      <Block title="Seguidos" users={following} />
    </section>
  );
}
