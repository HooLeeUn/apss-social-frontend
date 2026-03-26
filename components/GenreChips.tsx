import type { GenreOption } from "../lib/genres";

interface GenreChipsProps {
  genres: readonly (string | GenreOption)[];
  selectedGenres?: string[];
  onToggleGenre?: (genre: string) => void;
  selectedGenre?: string;
  onSelectGenre?: (genre: string) => void;
  onClearSelection?: () => void;
  showAllChip?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface NormalizedGenreChip {
  label: string;
  value: string;
}

export default function GenreChips({
  genres,
  selectedGenres,
  onToggleGenre,
  selectedGenre,
  onSelectGenre,
  onClearSelection,
  showAllChip = false,
  actionLabel,
  onAction,
}: GenreChipsProps) {
  const normalizedGenres: NormalizedGenreChip[] = genres.map((genre) =>
    typeof genre === "string"
      ? { label: genre, value: genre }
      : { label: genre.label, value: genre.value },
  );

  const selectedValues =
    selectedGenres ?? (selectedGenre && selectedGenre !== "Todos" ? [selectedGenre] : []);

  const chips = showAllChip
    ? [{ label: "Todos", value: "Todos", isAll: true }, ...normalizedGenres.map((genre) => ({ ...genre, isAll: false }))]
    : normalizedGenres.map((genre) => ({ ...genre, isAll: false }));

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
        {chips.map((chip) => {
          const selected = !chip.isAll && selectedValues.includes(chip.value);

          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => {
                if (chip.isAll) {
                  onClearSelection?.();
                  return;
                }

                if (onToggleGenre) {
                  onToggleGenre(chip.value);
                  return;
                }

                onSelectGenre?.(chip.value);
              }}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm transition-colors ${
                selected
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              {chip.label}
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
