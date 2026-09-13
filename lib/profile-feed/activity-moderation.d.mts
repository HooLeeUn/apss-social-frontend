import type { SocialActivityItem } from "./types";

export function shouldRenderActivityModerationMenu(activity: SocialActivityItem): boolean;
export function normalizeActivityCommentId(activity: { comment_id?: string | number | null; payload?: { comment_id?: string | number | null } | null }): string | number | null;
export function getActivityCommentReportId(activity: SocialActivityItem | Record<string, unknown>): string | number | undefined;
export function shouldShowActivityContentReport(activity: SocialActivityItem): boolean;
