import type { Movie } from "./movies";

export function buildPersonalizedFeedEndpoint(baseEndpoint: string, selectedGenres: string[]): string;
export function filterBySelectedGenres(
  movies: Movie[],
  selectedGenres: string[],
  matchesGenres: (movieGenres: string[] | undefined, selectedGenres: string[]) => boolean,
): Movie[];
export function sanitizePersonalizedMovies(
  movies: Movie[],
  excludedRatedIds: Set<string>,
  excludeProfileRatings: boolean,
): Movie[];
export function isCurrentPersonalizedRequest(
  currentRequestId: number,
  currentQueryKey: string,
  requestId: number,
  queryKey: string,
): boolean;
export function resolvePersonalizedMovies(
  payload: unknown,
  selectedGenres: string[],
  excludedRatedIds: Set<string>,
  excludeProfileRatings: boolean,
  parseMovies: (payload: unknown) => Movie[],
  matchesGenres: (movieGenres: string[] | undefined, selectedGenres: string[]) => boolean,
): Movie[];
export function loadFeedAccountCollections(
  isGuest: boolean,
  getList: () => Promise<Movie[]>,
  getRecommendations: () => Promise<Movie[]>,
): Promise<{ list: Movie[]; recommendations: Movie[] }>;
