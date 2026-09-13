import type { SocialActivityItem } from "./types";

export function shouldRenderActivityModerationMenu(activity: SocialActivityItem): boolean;
export function getActivityCommentReportId(activity: SocialActivityItem): string | number | undefined;
export function shouldShowActivityContentReport(activity: SocialActivityItem): boolean;
