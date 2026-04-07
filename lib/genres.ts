export interface GenreOption {
  label: string;
  value: string;
}

export const FEED_GENRE_OPTIONS: readonly GenreOption[] = [
  { label: "Acción", value: "Action" },
  { label: "Animación", value: "Animation" },
  { label: "Comedia", value: "Comedy" },
  { label: "Documental", value: "Documentary" },
  { label: "Drama", value: "Drama" },
  { label: "Horror", value: "Horror" },
  { label: "Musical", value: "Musical" },
  { label: "Ciencia ficción", value: "Sci-Fi" },
] as const;

const GENRE_SPLIT_REGEX = /[,/|]+/;

export function normalizeGenreToken(value: string): string {
  return value.trim().toLowerCase();
}

export function parseGenresFromField(genreField: unknown): string[] {
  if (Array.isArray(genreField)) {
    return genreField
      .filter((value): value is string => typeof value === "string")
      .flatMap((value) => value.split(GENRE_SPLIT_REGEX))
      .map((value) => normalizeGenreToken(value))
      .filter(Boolean);
  }

  if (typeof genreField === "string") {
    return genreField
      .split(GENRE_SPLIT_REGEX)
      .map((value) => normalizeGenreToken(value))
      .filter(Boolean);
  }

  return [];
}

export function movieMatchesSelectedGenres(movieGenres: string[] | undefined, selectedGenres: string[]): boolean {
  if (!selectedGenres.length) return true;

  const normalizedMovieGenres = new Set(parseGenresFromField(movieGenres ?? []));
  const normalizedSelectedGenres = selectedGenres.map((genre) => normalizeGenreToken(genre));

  return normalizedSelectedGenres.every((genre) => normalizedMovieGenres.has(genre));
}
