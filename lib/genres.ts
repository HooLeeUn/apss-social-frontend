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
