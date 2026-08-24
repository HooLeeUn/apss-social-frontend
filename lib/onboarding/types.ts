export type TourId = "feed" | "profile_feed" | "detail_movie";
export type OnboardingStatus = "pending" | "in_progress" | "completed" | "skipped";
export type OnboardingPrepareAction = "profile-activity" | "profile-inbox" | "profile-ratings" | "profile-list" | "profile-recommendations" | "detail-video" | "detail-comments-public" | "detail-comments-directed" | "detail-restore" | "feed-mobile-panel-show" | "feed-mobile-panel-release";
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
}

export interface TourDefinition {
  id: TourId;
  path: (pathname: string) => boolean;
  readyTargets: string[];
  welcomeTitle: string;
  welcomeBody: string;
  finalTitle: string;
  finalBody: string;
  steps: TourStepDefinition[];
  /** Desktop can use a focused sequence without changing the existing mobile tour. */
  desktopSteps?: TourStepDefinition[];
  /** Mobile-only targets and placements leave the approved desktop sequence unchanged. */
  mobileSteps?: TourStepDefinition[];
}
