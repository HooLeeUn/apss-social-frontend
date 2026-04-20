export type SocialTab = "following" | "friends";
export type SocialActivityScope = SocialTab | "me" | `user:${string}`;

export type InteractionType = "rating" | "comment" | "like" | "dislike";

export type SocialActivityType = "rating" | "public_comment" | "directed_comment" | "public_comment_like" | "public_comment_dislike";

export interface FavoriteMovie {
  id: string;
  slot: number;
  title: string;
  displaySecondaryTitle?: string | null;
  titleSpanish?: string | null;
  titleEnglish?: string | null;
  year: string;
  genre: string;
  type: string;
  posterUrl?: string | null;
  generalRating: number | null;
  followingRating: number | null;
  followingRatingsCount: number;
  myRating: number | null;
}

export interface FavoriteMovieSearchResult {
  id: string;
  title: string;
  displayTitle: string;
  displaySecondaryTitle?: string | null;
  year: string;
  genre: string;
  type: string;
  generalRating: number | null;
  followingRating: number | null;
  followingRatingsCount: number;
  myRating: number | null;
}

export interface SocialUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followersCount: number | null;
  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  ageVisible?: boolean | null;
  genderIdentity?: string | null;
  genderIdentityVisible?: boolean | null;
}

export interface SocialActivityItem {
  id: string;
  user: SocialUser;
  userDisplayName?: string | null;
  movieTitle: string;
  movieSecondaryTitle?: string | null;
  movieYear: number | null;
  movieId: number | string;
  moviePosterUrl: string | null;
  movieType?: string;
  movieGenre?: string;
  generalRating?: number;
  followingRating?: number;
  followingRatingsCount?: number;
  myRating?: number;
  createdAt: string;
  interactionType: InteractionType;
  isDirectedComment?: boolean;
  directedCommentTargetUsername?: string;
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
  genre?: string | null;
  display_rating?: number | string | null;
  following_avg_rating?: number | string | null;
  following_ratings_count?: number | string | null;
  my_rating?: number | string | null;
}

export interface RatingActivityPayload {
  score?: number | string;
}

export interface PublicCommentActivityPayload {
  comment_id?: number | string;
  content?: string;
  text?: string;
  target_user?: {
    id?: number | string;
    username?: string;
  } | string;
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
