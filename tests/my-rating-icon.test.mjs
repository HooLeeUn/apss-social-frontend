import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const ratingIcons = fs.readFileSync("components/RatingIcons.tsx", "utf8");
const movieCard = fs.readFileSync("components/MovieCard.tsx", "utf8");
const favorites = fs.readFileSync("components/profile-feed/FavoriteMoviesBlock.tsx", "utf8");
const detailPage = fs.readFileSync("app/movies/[id]/page.tsx", "utf8");
const visitedProfile = fs.readFileSync("app/users/[username]/page.tsx", "utf8");

test("all production My Rating surfaces use the shared raising-hand icon", () => {
  assert.match(ratingIcons, /export function RatingPersonRaisingHandIcon/);
  assert.doesNotMatch(ratingIcons, /Rating(?:User)?SmileIcon/);
  assert.match(movieCard, /import \{ RatingPersonRaisingHandIcon \}/);
  assert.match(favorites, /import \{ RatingPersonRaisingHandIcon \}/);
  assert.match(detailPage, /<MovieCard/);
  assert.match(visitedProfile, /<FavoriteMoviesBlock[\s\S]*?readOnly/);
});

test("the icon replacement preserves rating dimensions, color, and read-only ownership", () => {
  for (const source of [movieCard, favorites]) {
    assert.match(source, /<RatingPersonRaisingHandIcon className="h-4 w-4 shrink-0 text-violet-400" \/>/);
  }
  assert.match(favorites, /readOnlyOwnerRating = readOnly \? \(movie\?\.visitedOwnerRating \?\? movie\?\.myRating/);
  assert.match(favorites, /\{readOnly \? \([\s\S]*?<div[\s\S]*?RatingPersonRaisingHandIcon/);
});
