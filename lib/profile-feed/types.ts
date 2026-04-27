export type SocialTab = "following" | "friends";
export type SocialActivityScope = SocialTab | "me" | `user:${string}`;

export type InteractionType = "rating" | "comment" | "like" | "dislike";

export type SocialActivityType =
  | "rating"
  | "public_comment"
  | "directed_comment"
  | "public_comment_like"
  | "public_comment_dislike"
  | "public_comment_reaction"
  | "directed_comment_like"
  | "directed_comment_dislike"
  | "directed_comment_reaction"
  | "private_message"
  | "private_comment_reaction"
  | string;

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
  visitedOwnerRating?: number | null;
  visitedFollowingAvgRating?: number | null;
  visitedFollowingRatingsCount?: number;
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
  canViewFullProfile?: boolean | null;
  profileAccess?: string | null;
}

export interface SocialActivityItem {
  id: string;
  activityType?: string;
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
  updatedAt?: string;
  activityAt?: string;
  interactionType: InteractionType;
  isDirectedComment?: boolean;
  directedCommentTargetUsername?: string;
  ratingValue?: number;
  commentText?: string;
  likedCommentSnippet?: string;
  likedCommentAuthorUsername?: string;
  reactionActorUsername?: string;
  commentId?: string;
  reactionId?: string;
  actorId?: string;
  isGivenReaction?: boolean;
  isReceivedReaction?: boolean;
  scope?: NotificationTargetTab;
  reactionScope?: "public" | "private";
  reactionValue?: "like" | "dislike";
}

export interface PaginatedSocialActivity {
  items: SocialActivityItem[];
  next: string | null;
}

export interface MyMessageItem {
  id: string;
  direction: "sent" | "received";
  sender: SocialUser;
  recipient: SocialUser | null;
  movieId: number | string;
  movieTitle: string;
  movieSecondaryTitle?: string | null;
  moviePosterUrl: string | null;
  movieType?: string;
  movieGenre?: string;
  text: string;
  createdAt: string;
}

export interface PaginatedMyMessages {
  items: MyMessageItem[];
  next: string | null;
}

export interface MyMessagesSummary {
  hasUnreadMessages: boolean;
  unreadCount: number;
  totalMessages: number;
}

export type NotificationTargetTab = "activity" | "private_inbox";

export interface MyNotificationItem {
  id: string;
  text: string;
  targetTab: NotificationTargetTab;
  createdAt: string | null;
}

export interface MyNotificationsSummary {
  totalUnread: number;
  items: MyNotificationItem[];
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
  type?: SocialActivityType;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  activity_at?: string;
  activityAt?: string;
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
