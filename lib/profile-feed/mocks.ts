import { FavoriteMovie, SocialUser } from "./types";

export const favoriteMoviesMock: FavoriteMovie[] = [];

export const friendsMock: SocialUser[] = [
  { id: "u-001", username: "cineNora", displayName: null, followersCount: 420, avatarUrl: null },
  { id: "u-002", username: "FrameHunter", displayName: null, followersCount: 290, avatarUrl: null },
  { id: "u-003", username: "SofiCritica", displayName: null, followersCount: 260, avatarUrl: null },
  { id: "u-004", username: "NeoMovies", displayName: null, followersCount: 180, avatarUrl: null },
  { id: "u-005", username: "LunaFilm", displayName: null, followersCount: 160, avatarUrl: null },
  { id: "u-006", username: "OscarScope", displayName: null, followersCount: 120, avatarUrl: null },
];

export const followingMock: SocialUser[] = [
  { id: "u-001", username: "cineNora", displayName: null, followersCount: 420, avatarUrl: null },
  { id: "u-007", username: "RetroPulse", displayName: null, followersCount: 390, avatarUrl: null },
  { id: "u-008", username: "AriVisuals", displayName: null, followersCount: 310, avatarUrl: null },
  { id: "u-009", username: "MovieMint", displayName: null, followersCount: 275, avatarUrl: null },
  { id: "u-003", username: "SofiCritica", displayName: null, followersCount: 260, avatarUrl: null },
  { id: "u-010", username: "ClackDirector", displayName: null, followersCount: 140, avatarUrl: null },
];
