import type { GenreOption } from "../lib/genres";

interface GenreChipsProps {
  locale?: "es" | "en";
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
  disabledChipClassName?: string;
  isGenreDisabled?: (genre: string) => boolean;
}

interface NormalizedGenreChip {
  label: string;
  value: string;
}

export default function GenreChips({
  locale = "es",
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
  disabledChipClassName,
  isGenreDisabled,
}: GenreChipsProps) {
  const genreLabelMap: Record<string, { es: string; en: string }> = {
    Action: { es: "Acción", en: "Action" },
    Animation: { es: "Animación", en: "Animation" },
    Comedy: { es: "Comedia", en: "Comedy" },
    Documentary: { es: "Documental", en: "Documentary" },
    Drama: { es: "Drama", en: "Drama" },
    Horror: { es: "Horror", en: "Horror" },
    Musical: { es: "Musical", en: "Musical" },
    "Sci-Fi": { es: "Ciencia ficción", en: "Sci-Fi" },
  };

  const normalizedGenres: NormalizedGenreChip[] = genres.map((genre) =>
    typeof genre === "string"
      ? { label: genreLabelMap[genre]?.[locale] ?? genre, value: genre }
      : { label: genreLabelMap[genre.value]?.[locale] ?? genre.label, value: genre.value },
  );

  const selectedValues =
    selectedGenres ?? (selectedGenre && selectedGenre !== "Todos" && selectedGenre !== "All" ? [selectedGenre] : []);

  const chips = showAllChip
    ? [{ label: locale === "en" ? "All" : "Todos", value: "Todos", isAll: true }, ...normalizedGenres.map((genre) => ({ ...genre, isAll: false }))]
    : normalizedGenres.map((genre) => ({ ...genre, isAll: false }));

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`.trim()}>
      <div className={`flex flex-1 gap-2 overflow-x-auto pb-1 ${chipsContainerClassName ?? ""}`.trim()}>
        {chips.map((chip) => {
          const selected = !chip.isAll && selectedValues.includes(chip.value);
          const disabled = !chip.isAll && !selected && (isGenreDisabled?.(chip.value) ?? false);

          return (
            <button
              key={chip.value}
              type="button"
              disabled={disabled}
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
                  : disabled
                    ? (disabledChipClassName ?? "border-gray-300 bg-gray-100 text-gray-400")
                  : (unselectedChipClassName ?? "border-gray-300 bg-white text-gray-700 hover:border-gray-400")
              } ${chipClassName ?? ""} ${disabled ? "cursor-not-allowed opacity-70" : ""}`.trim()}
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
