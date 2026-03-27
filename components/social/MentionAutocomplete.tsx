import { Friend } from "../../lib/social";

interface MentionAutocompleteProps {
  friends: Friend[];
  activeIndex: number;
  onSelect: (friend: Friend) => void;
}

export default function MentionAutocomplete({ friends, activeIndex, onSelect }: MentionAutocompleteProps) {
  if (friends.length === 0) {
    return (
      <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-white/15 bg-zinc-950/95 p-3 text-sm text-zinc-400 shadow-xl">
        No hay coincidencias de amigos.
      </div>
    );
  }

  return (
    <ul className="absolute left-0 right-0 top-full z-20 mt-2 max-h-52 overflow-y-auto rounded-xl border border-white/20 bg-zinc-950/95 p-1 shadow-xl">
      {friends.map((friend, index) => (
        <li key={friend.id}>
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(friend);
            }}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
              index === activeIndex ? "bg-white/10 text-zinc-100" : "text-zinc-300 hover:bg-white/5"
            }`}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/30 text-[11px] font-semibold">
              {friend.username.charAt(0).toUpperCase()}
            </span>
            <span>@{friend.username}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
