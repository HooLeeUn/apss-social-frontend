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
  className?: string;
  chipsContainerClassName?: string;
  chipClassName?: string;
  selectedChipClassName?: string;
  unselectedChipClassName?: string;
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
  className,
  chipsContainerClassName,
  chipClassName,
  selectedChipClassName,
  unselectedChipClassName,
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
    <div className={`flex items-center gap-2 ${className ?? ""}`.trim()}>
      <div className={`flex flex-1 gap-2 overflow-x-auto pb-1 ${chipsContainerClassName ?? ""}`.trim()}>
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
                  ? (selectedChipClassName ?? "border-black bg-black text-white")
                  : (unselectedChipClassName ?? "border-gray-300 bg-white text-gray-700 hover:border-gray-400")
              } ${chipClassName ?? ""}`.trim()}
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
