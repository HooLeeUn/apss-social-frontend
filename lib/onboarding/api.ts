import { apiFetch } from "../api";
import type { OnboardingState, OnboardingStatus, TourId } from "./types";

const ENDPOINT = "/onboarding/";

function normalize(raw: unknown, fallbackTour?: TourId): OnboardingState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const tour = (value.tour ?? value.tour_key ?? value.key ?? fallbackTour) as TourId;
  const status = value.status as OnboardingStatus;
  if (!["feed", "profile_feed", "detail_movie"].includes(tour) || !["pending", "in_progress", "completed", "skipped"].includes(status)) return null;
  const step = value.current_step;
  return { tour, status, version: Number(value.version) || 1, currentStep: typeof step === "number" ? step : null };
}

export async function getOnboardingStates(): Promise<OnboardingState[]> {
  const payload = await apiFetch(ENDPOINT);
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const values = Array.isArray(payload) ? payload : Array.isArray(record?.results) ? record.results : record ? Object.entries(record).map(([key, value]) => ({ ...(value as object), tour: key })) : [];
  return values.map((value) => normalize(value)).filter((value): value is OnboardingState => Boolean(value));
}

export async function updateOnboardingState(tour: TourId, status: OnboardingStatus, currentStep: number | null): Promise<OnboardingState | null> {
  const payload = await apiFetch(`${ENDPOINT}${tour}/`, { method: "PATCH", body: JSON.stringify({ status, current_step: currentStep }) });
  return normalize(payload, tour);
}

export const onboardingQueueKey = (user: string, tour: TourId, version: number) => `qnext:onboarding:${encodeURIComponent(user)}:${tour}:v${version}`;
