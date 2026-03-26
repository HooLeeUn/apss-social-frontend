interface GenreChipsProps {
  genres: string[];
  selectedGenres: string[];
  onToggleGenre: (genre: string) => void;
  onClearSelection?: () => void;
  showAllChip?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export default function GenreChips({
  genres,
  selectedGenres,
  onToggleGenre,
  onClearSelection,
  showAllChip = false,
  actionLabel,
  onAction,
}: GenreChipsProps) {
  const chips = showAllChip ? ["Todos", ...genres] : genres;

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
        {chips.map((genre) => {
          const selected = genre !== "Todos" && selectedGenres.includes(genre);

          return (
            <button
              key={genre}
              type="button"
              onClick={() => {
                if (genre === "Todos") {
                  onClearSelection?.();
                  return;
                }

                onToggleGenre(genre);
              }}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm transition-colors ${
                selected
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>

      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-full border border-black px-4 py-1 text-sm font-medium text-black"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
