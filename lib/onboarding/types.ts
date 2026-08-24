export type TourId = "feed" | "profile_feed" | "detail_movie";
export type OnboardingStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface OnboardingState {
  tour: TourId;
  status: OnboardingStatus;
  version: number;
  currentStep: number | null;
}

export interface TourStepDefinition {
  target: string;
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
}
