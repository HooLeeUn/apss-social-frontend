export type SocialTab = "following" | "friends";

export type InteractionType = "rating" | "comment" | "like";

export type SocialActivityType = "rating" | "public_comment" | "public_comment_like";

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
  user: SocialUser;
  userDisplayName?: string | null;
  movieTitle: string;
  movieYear: number | null;
  movieId: number | string;
  moviePosterUrl: string | null;
  movieType?: string;
  movieGenre?: string;
  generalRating?: number;
  followingRating?: number;
  myRating?: number;
  createdAt: string;
  interactionType: InteractionType;
  ratingValue?: number;
  commentText?: string;
  likedCommentSnippet?: string;
  likedCommentAuthorUsername?: string;
}

export interface PaginatedSocialActivity {
  items: SocialActivityItem[];
  next: string | null;
}

export interface ProfileFeedActivityActor {
  id: number;
  username: string;
  display_name?: string;
  avatar: string | null;
}

export interface ProfileFeedActivityMovie {
  id: number;
  title_english: string | null;
  title_spanish: string | null;
  release_year: number | null;
  image: string | null;
  type?: string | null;
  content_type?: string | null;
  genre?: string | null;
  genres?: string[] | string | null;
  display_rating?: number | string | null;
  general_rating?: number | string | null;
  following_avg_rating?: number | string | null;
  following_rating?: number | string | null;
  my_rating?: number | string | null;
}

export interface RatingActivityPayload {
  score?: number | string;
}

export interface PublicCommentActivityPayload {
  comment_id?: number | string;
  content?: string;
  text?: string;
}

export interface PublicCommentLikeActivityPayload {
  comment_id?: number | string;
  comment_excerpt?: string;
  comment_author?: {
    id?: number | string;
    username?: string;
  };
}

export type ProfileFeedActivityPayload =
  | RatingActivityPayload
  | PublicCommentActivityPayload
  | PublicCommentLikeActivityPayload
  | null;

export interface ProfileFeedActivityResponseItem {
  id: string;
  activity_type: SocialActivityType;
  created_at: string;
  actor: ProfileFeedActivityActor;
  movie: ProfileFeedActivityMovie;
  payload: ProfileFeedActivityPayload;
}

export interface ProfileFeedActivityResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ProfileFeedActivityResponseItem[];
}
