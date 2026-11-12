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

// Display normalization preserves the first spelling and backend order.
export function productionGenres(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    const text = typeof entry === "string" ? entry : entry && typeof entry === "object" && "name" in entry ? String(entry.name) : "";
    return text.split(GENRE_SPLIT_REGEX);
  }).map((entry) => entry.trim()).filter((entry) => {
    const key = normalizeGenreToken(entry);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
