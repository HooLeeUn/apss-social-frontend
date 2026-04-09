export type SocialTab = "following" | "friends";

export type InteractionType = "rating" | "comment" | "like";

export interface FavoriteMovie {
  id: string;
  slot: number;
  title: string;
  titleSpanish?: string | null;
  titleEnglish?: string | null;
  year: string;
  genre: string;
  type: string;
  posterUrl?: string | null;
  generalRating: number | null;
  followingRating: number | null;
  myRating: number | null;
}

export interface FavoriteMovieSearchResult {
  id: string;
  title: string;
  year: string;
  genre: string;
  type: string;
  generalRating: number | null;
  followingRating: number | null;
  myRating: number | null;
}

export interface SocialUser {
  id: string;
  username: string;
  avatarUrl?: string | null;
  followersCount: number;
}

export interface SocialActivityItem {
  id: string;
  tab: SocialTab;
  user: SocialUser;
  movieTitle: string;
  movieYear: number;
  createdAt: string;
  interactionType: InteractionType;
  ratingValue?: number;
  commentText?: string;
  likedCommentSnippet?: string;
}

export interface PaginatedSocialActivity {
  items: SocialActivityItem[];
  nextPage: number | null;
}
