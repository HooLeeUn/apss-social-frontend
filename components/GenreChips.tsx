interface GenreChipsProps {
  genres: string[];
  selectedGenre: string;
  onSelectGenre: (genre: string) => void;
}

export default function GenreChips({ genres, selectedGenre, onSelectGenre }: GenreChipsProps) {
  const chips = ["Todos", ...genres];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {chips.map((genre) => {
        const selected = genre === selectedGenre;
        return (
          <button
            key={genre}
            type="button"
            onClick={() => onSelectGenre(genre)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${
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
  );
}
