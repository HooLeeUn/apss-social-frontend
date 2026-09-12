import { ApiError, apiFetch } from "./api";

export const REPORT_REASONS = ["inappropriate_content", "harassment_or_threats", "sexual_content", "spam_or_scam", "hate_or_discrimination", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportTarget =
  | { kind: "comment" | "video_comment"; objectId: string | number; userId: string | number; username: string }
  | { kind: "user"; userId: string | number; username: string };

export function buildReportPayload(target: ReportTarget, reason: ReportReason, details: string) {
  const payload: Record<string, string | number> = { type: target.kind, reason };
  if (target.kind === "user") payload.reported_user = target.userId;
  else payload.object_id = target.objectId;
  if (details.trim()) payload.details = details.trim();
  return payload;
}

export async function submitReport(target: ReportTarget, reason: ReportReason, details: string): Promise<void> {
  await apiFetch("/reports/", { method: "POST", body: JSON.stringify(buildReportPayload(target, reason, details)) });
}

export function reportErrorStatus(error: unknown): number | null {
  return error instanceof ApiError ? error.status : null;
}
