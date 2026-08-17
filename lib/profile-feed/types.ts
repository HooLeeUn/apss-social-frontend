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
  | "video_reactions_received_summary"
  | "comment_reactions_received_summary"
  | string;

export interface FavoriteMovie {
  id: string;
  slot: number;
  title: string;
  image?: string | null;
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

export interface UserMovieRecommendation {
  id: string;
  titleSpanish: string;
  titleEnglish: string;
  image: string | null;
  genre: string;
  type: string;
  releaseYear: string;
  director: string;
  castMembers: string;
  displayRating?: number | null;
  followingAvgRating?: number | null;
  followingRating?: number | null;
  myRating?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  recommendedAt?: string | null;
}

export type FriendshipStatus = "none" | "sent_pending" | "received_pending" | "friends" | "self";

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
  profileVisibility?: "public" | "private" | null;
  isFollowing?: boolean | null;
  canFollow?: boolean | null;
  friendshipStatus?: FriendshipStatus | null;
  friendshipId?: string | null;
  canSendFriendRequest?: boolean | null;
  friendRequestsRestricted?: boolean | null;
  isPrivateProfile?: boolean | null;
  isRestrictedByVisitedUser?: boolean | null;
  restrictedCurrentUser?: boolean;
}

export interface PaginatedUserSearchResults {
  items: SocialUser[];
  next: string | null;
}

export interface FriendRequest {
  id: string;
  direction: "sent" | "received";
  user: SocialUser;
}

export interface SocialActivityItem {
  id: string;
  activityType?: string;
  user: SocialUser;
  userDisplayName?: string | null;
  movieTitle: string;
  movieTitleSpanish?: string | null;
  movieTitleEnglish?: string | null;
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
  activityAt?: string | null;
  updatedAt?: string | null;
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
  videoCommentId?: string;
  videoUrl?: string;
  videoOwnerUsername?: string;
  videoLikesCount?: number;
  videoDislikesCount?: number;
  videoMyReaction?: "like" | "dislike" | null;
  likesCount?: number;
  dislikesCount?: number;
  usersWhoLiked?: ReactionSummaryUser[];
  usersWhoDisliked?: ReactionSummaryUser[];
  latestReactionAt?: string | null;
  objectCreatedAt?: string | null;
}

export interface ReactionSummaryUser {
  id: string;
  username: string;
  avatarUrl: string | null;
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

export type NotificationTargetTab = "activity" | "private_inbox" | "friend_requests_pending";
export type NotificationId = string | number;
export type NotificationContext = "activity" | "private_inbox";

export interface MyNotificationItem {
  id: NotificationId;
  type: string | null;
  text: string;
  targetTab: NotificationTargetTab;
  movieId: number | string | null;
  actorId: number | string | null;
  actorUsername: string | null;
  directedCommentId: number | string | null;
  commentId: number | string | null;
  videoCommentId: number | string | null;
  reactionType: "like" | "dislike" | null;
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

export interface VideoReactionActivityPayload {
  video_comment_id?: number | string;
  video_url?: string;
  reaction?: "like" | "dislike";
  video_owner?: { id?: number | string; username?: string } | string;
  likes_count?: number;
  dislikes_count?: number;
  my_reaction?: "like" | "dislike" | null;
}

export interface ReactionSummaryActivityPayload {
  comment_id?: number | string;
  comment_text?: string;
  content?: string;
  video_comment_id?: number | string;
  video_url?: string;
  likes_count: number;
  dislikes_count: number;
  users_who_liked: Array<{ id: number | string; username: string; avatar: string | null }>;
  users_who_disliked: Array<{ id: number | string; username: string; avatar: string | null }>;
  latest_reaction_at: string;
  object_created_at: string;
  owner?: { id?: number | string; username?: string; avatar?: string | null };
}

export type ProfileFeedActivityPayload =
  | RatingActivityPayload
  | PublicCommentActivityPayload
  | PublicCommentLikeActivityPayload
  | VideoReactionActivityPayload
  | ReactionSummaryActivityPayload
  | null;

export interface ProfileFeedActivityResponseItem {
  id: string;
  activity_type: SocialActivityType;
  created_at: string;
  updated_at?: string | null;
  activity_at?: string | null;
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
