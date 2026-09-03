import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const feed = readFileSync(new URL("../app/feed/page.tsx", import.meta.url), "utf8");

test("guest billboard always uses the public feed endpoint, including without genres", () => {
  assert.match(
    feed,
    /return queryString \? `\$\{MOVIES_FEED_ENDPOINT\}\?\$\{queryString\}` : MOVIES_FEED_ENDPOINT;/,
  );
  assert.match(feed, /apiFetch\(buildPersonalizedFeedEndpoint\(genres\)/);
  assert.match(feed, /void fetchPersonalizedMovies\(selectedGenres\)/);
});

test("guest detection for feed data is independent from viewport presentation", () => {
  assert.match(feed, /viewportHydrated, isGuest, isGuestExperience: isDesktopGuest/);
  assert.match(feed, /isGuest \? Promise\.resolve\(\[\]\) : getMyMovieList\(\)/);
  assert.match(feed, /isGuest \? Promise\.resolve\(\[\]\) : getMyMovieRecommendations\(\)/);
  assert.doesNotMatch(feed, /isDesktopGuest \? Promise\.resolve\(\[\]\) : getMyMovieList\(\)/);
});
