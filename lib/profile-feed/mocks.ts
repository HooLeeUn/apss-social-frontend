import { FavoriteMovie, SocialUser } from "./types";

export const favoriteMoviesMock: FavoriteMovie[] = [];

export const friendsMock: SocialUser[] = [
  { id: "u-001", username: "cineNora", followersCount: 420, avatarUrl: null },
  { id: "u-002", username: "FrameHunter", followersCount: 290, avatarUrl: null },
  { id: "u-003", username: "SofiCritica", followersCount: 260, avatarUrl: null },
  { id: "u-004", username: "NeoMovies", followersCount: 180, avatarUrl: null },
  { id: "u-005", username: "LunaFilm", followersCount: 160, avatarUrl: null },
  { id: "u-006", username: "OscarScope", followersCount: 120, avatarUrl: null },
];

export const followingMock: SocialUser[] = [
  { id: "u-001", username: "cineNora", followersCount: 420, avatarUrl: null },
  { id: "u-007", username: "RetroPulse", followersCount: 390, avatarUrl: null },
  { id: "u-008", username: "AriVisuals", followersCount: 310, avatarUrl: null },
  { id: "u-009", username: "MovieMint", followersCount: 275, avatarUrl: null },
  { id: "u-003", username: "SofiCritica", followersCount: 260, avatarUrl: null },
  { id: "u-010", username: "ClackDirector", followersCount: 140, avatarUrl: null },
];
