import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const feed = readFileSync(new URL("../app/feed/page.tsx", import.meta.url), "utf8");

test("guest detection is session-based instead of viewport-based", () => {
  assert.match(feed, /isGuest: isDesktopGuest/);
  assert.doesNotMatch(feed, /isGuestExperience: isDesktopGuest/);
});

test("the personalized feed endpoint is public with and without genre filters", () => {
  assert.match(
    feed,
    /return queryString \? `\$\{MOVIES_FEED_ENDPOINT\}\?\$\{queryString\}` : MOVIES_FEED_ENDPOINT;/,
  );
  assert.match(feed, /apiFetch\(buildPersonalizedFeedEndpoint\(genres\)/);
  assert.match(feed, /params\.append\("genres", genre\)/);
});

test("clearing all genres reloads the unfiltered public feed", () => {
  assert.match(feed, /void fetchPersonalizedMovies\(selectedGenres\)/);
  assert.match(feed, /\[fetchPersonalizedMovies, loading, selectedGenres\]/);
  assert.match(feed, /return current\.filter\(\(item\) => item !== genre\)/);
});

test("guest startup skips private list and recommendation requests", () => {
  assert.match(feed, /isDesktopGuest \? Promise\.resolve\(\[\]\) : getMyMovieList\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(feed, /isDesktopGuest \? Promise\.resolve\(\[\]\) : getMyMovieRecommendations\(\)\.catch\(\(\) => \[\]\)/);
});

test("authenticated startup keeps private list and recommendation requests", () => {
  assert.match(feed, /!isDesktopGuest && !weeklyResult\.ok/);
  assert.match(feed, /getMyMovieList\(\)/);
  assert.match(feed, /getMyMovieRecommendations\(\)/);
});
