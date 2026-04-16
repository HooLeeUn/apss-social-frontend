import { SocialUser } from "../../lib/profile-feed/types";

interface TopUsersSectionProps {
  friends: SocialUser[];
  following: SocialUser[];
}

function UserRow({ user }: { user: SocialUser }) {
  return (
    <article className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-zinc-900 text-xs font-semibold text-zinc-200">
        {user.username.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-100">{user.username}</p>
        <p className="text-xs text-zinc-400">Lo siguen {user.followersCount} usuarios</p>
      </div>
    </article>
  );
}

function Block({ title, users }: { title: string; users: SocialUser[] }) {
  return (
    <section className="rounded-3xl border border-white/15 bg-zinc-950/55 p-3.5 md:p-4">
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        <button type="button" className="text-sm text-zinc-300 transition hover:text-blue-200">
          Todos
        </button>
      </header>
      <div>
        {users.map((user) => (
          <UserRow key={`${title}-${user.id}`} user={user} />
        ))}
      </div>
    </section>
  );
}

export default function TopUsersSection({ friends, following }: TopUsersSectionProps) {
  return (
    <section className="grid w-full max-w-[640px] gap-3 sm:grid-cols-2 lg:max-w-[680px]">
      <Block title="Seguidos" users={following} />
      <Block title="Amigos" users={friends} />
    </section>
  );
}
