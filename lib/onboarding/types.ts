export type TourId = "feed" | "profile_feed" | "detail_movie";
export type OnboardingStatus = "pending" | "in_progress" | "completed" | "skipped";
export type OnboardingPrepareAction = "profile-activity" | "profile-inbox" | "profile-ratings" | "profile-list" | "profile-recommendations" | "profile-mobile-connections" | "profile-mobile-activity" | "profile-mobile-inbox" | "profile-mobile-ratings" | "profile-mobile-list" | "profile-mobile-recommendations" | "profile-mobile-following-activity" | "profile-mobile-release" | "detail-video" | "detail-comments-public" | "detail-comments-directed" | "detail-restore" | "detail-mobile-video" | "detail-mobile-comments-public" | "detail-mobile-comments-directed" | "detail-mobile-restore" | "feed-mobile-panel-show" | "feed-mobile-panel-release";
export const onboardingPrepareStepEventName = "qnext:onboarding:prepare-step";

export interface OnboardingState {
  tour: TourId;
  status: OnboardingStatus;
  version: number;
  currentStep: number | null;
}

export interface TourStepDefinition {
  target: string;
  icon?: "search" | "filter" | "profile" | "notifications" | "menu" | "productions" | "favorite" | "connections" | "activity" | "inbox" | "ratings" | "list" | "recommendations" | "information" | "play" | "video" | "rec" | "conversation" | "comments" | "directed";
  prepare?: OnboardingPrepareAction;
  mobilePrepare?: OnboardingPrepareAction;
  /** Keep the spotlight on a parent while callouts point at controls inside it. */
  spotlightTarget?: string;
  callouts?: Array<{
    target: string;
    label?: string;
    placement?: "top" | "bottom" | "left" | "right";
    anchor?: "center" | "start";
  }>;
  mobileTarget?: string;
  title: string;
  body: string;
  mobileBody?: string;
  optional?: boolean;
  placement?: "top" | "bottom" | "left" | "right";
  mobileScroll?: "below-tooltip";
}

export interface TourDefinition {
  id: TourId;
  path: (pathname: string) => boolean;
  readyTargets: string[];
  welcomeTitle: string;
  welcomeBody: string;
  finalTitle: string;
  finalBody: string;
  mobileFinalTitle?: string;
  mobileFinalBody?: string;
  steps: TourStepDefinition[];
  /** Desktop can use a focused sequence without changing the existing mobile tour. */
  desktopSteps?: TourStepDefinition[];
  /** Mobile-only targets and placements leave the approved desktop sequence unchanged. */
  mobileSteps?: TourStepDefinition[];
}
