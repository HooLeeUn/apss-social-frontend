import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPersonalizedFeedEndpoint,
  filterBySelectedGenres,
  isCurrentPersonalizedRequest,
  loadFeedAccountCollections,
  resolvePersonalizedMovies,
  sanitizePersonalizedMovies,
} from "../lib/personalized-feed.mjs";

const movies = [
  { id: 1, genres: ["Action"], myRating: 5 },
  { id: 2, genres: ["Drama"], myRating: null },
];
const matchesGenres = (genres, selected) => selected.every((genre) => genres.includes(genre));
const parseMovieList = (payload) => Array.isArray(payload?.results) ? payload.results : [];

test("guest without genres uses the public endpoint and keeps paginated results", async () => {
  const calls = [];
  const apiFetch = async (endpoint) => {
    calls.push(endpoint);
    return { count: 2, next: "/feed/movies/?page=2", previous: null, results: movies };
  };
  const payload = await apiFetch(buildPersonalizedFeedEndpoint("/feed/movies/", []));
  const personalizedMovies = resolvePersonalizedMovies(payload, [], new Set(), false, parseMovieList, matchesGenres);
  assert.deepEqual(calls, ["/feed/movies/"]);
  assert.deepEqual(personalizedMovies, movies);
  assert.equal(payload.next, "/feed/movies/?page=2");
});

test("guest genres are encoded and clearing them restores the unfiltered endpoint", () => {
  assert.equal(buildPersonalizedFeedEndpoint("/feed/movies/", ["Action", "Sci-Fi"]), "/feed/movies/?genres=Action&genres=Sci-Fi");
  assert.equal(buildPersonalizedFeedEndpoint("/feed/movies/", []), "/feed/movies/");
});

test("an empty genre selection does not filter or sanitize guest results", () => {
  assert.strictEqual(filterBySelectedGenres(movies, [], matchesGenres), movies);
  assert.strictEqual(sanitizePersonalizedMovies(movies, new Set(), false), movies);
});

test("guest account bootstrap never starts private list or recommendation calls", async () => {
  let listCalls = 0;
  let recommendationCalls = 0;
  const result = await loadFeedAccountCollections(
    true,
    async () => { listCalls += 1; return movies; },
    async () => { recommendationCalls += 1; return movies; },
  );
  assert.deepEqual(result, { list: [], recommendations: [] });
  assert.equal(listCalls, 0);
  assert.equal(recommendationCalls, 0);
});

test("the current response survives request id/query key checks", () => {
  assert.equal(isCurrentPersonalizedRequest(3, "", 3, ""), true);
  assert.equal(isCurrentPersonalizedRequest(4, "Action", 3, ""), false);
});

test("authenticated account bootstrap and rated exclusions retain their behavior", async () => {
  const result = await loadFeedAccountCollections(false, async () => [movies[0]], async () => [movies[1]]);
  assert.deepEqual(result, { list: [movies[0]], recommendations: [movies[1]] });
  assert.deepEqual(sanitizePersonalizedMovies(movies, new Set(), true), [movies[1]]);
  assert.deepEqual(sanitizePersonalizedMovies(movies, new Set(["2"]), true), []);
});
