/** Build the public feed URL without inventing a query string for "all genres". */
export function buildPersonalizedFeedEndpoint(baseEndpoint, selectedGenres) {
  const params = new URLSearchParams();
  selectedGenres.forEach((genre) => params.append("genres", genre));
  const queryString = params.toString();
  return queryString ? `${baseEndpoint}?${queryString}` : baseEndpoint;
}

export function filterBySelectedGenres(movies, selectedGenres, matchesGenres) {
  if (selectedGenres.length === 0) return movies;
  return movies.filter((movie) => matchesGenres(movie.genres, selectedGenres));
}

/** Rating exclusions belong to an authenticated profile, never to a guest session. */
export function sanitizePersonalizedMovies(movies, excludedRatedIds, excludeProfileRatings) {
  if (!excludeProfileRatings) return movies;
  return movies.filter((movie) => !excludedRatedIds.has(String(movie.id)) && movie.myRating === null);
}

export function isCurrentPersonalizedRequest(currentRequestId, currentQueryKey, requestId, queryKey) {
  return currentRequestId === requestId && currentQueryKey === queryKey;
}

export function resolvePersonalizedMovies(payload, selectedGenres, excludedRatedIds, excludeProfileRatings, parseMovies, matchesGenres) {
  return sanitizePersonalizedMovies(
    filterBySelectedGenres(parseMovies(payload), selectedGenres, matchesGenres),
    excludedRatedIds,
    excludeProfileRatings,
  );
}

/** Avoid even starting private requests for guests (rather than swallowing their 401s). */
export async function loadFeedAccountCollections(isGuest, getList, getRecommendations) {
  if (isGuest) return { list: [], recommendations: [] };
  const [list, recommendations] = await Promise.all([getList(), getRecommendations()]);
  return { list, recommendations };
}
