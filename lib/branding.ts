import { API_BASE_URL } from "./api";

export interface AppBranding {
  app_name: string;
  default_logo_url: string | null;
  login_logo_url: string | null;
  signup_logo_url: string | null;
  feed_logo_url: string | null;
  movie_detail_logo_url: string | null;
  profile_feed_logo_url: string | null;
  visited_profile_logo_url: string | null;
  personal_data_logo_url: string | null;
  privacy_security_logo_url: string | null;
  updated_at: string;
}

export type BrandingLogoSlot =
  | "login_logo_url"
  | "signup_logo_url"
  | "feed_logo_url"
  | "movie_detail_logo_url"
  | "profile_feed_logo_url"
  | "visited_profile_logo_url"
  | "personal_data_logo_url"
  | "privacy_security_logo_url";

export async function fetchAppBranding(signal?: AbortSignal): Promise<AppBranding | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/branding/`, {
      method: "GET",
      signal,
      cache: "no-store",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return null;

    return (await response.json()) as AppBranding;
  } catch {
    return null;
  }
}

export function resolveBrandingLogoUrl(branding: AppBranding | null, slot: BrandingLogoSlot): string | null {
  if (!branding) return null;
  const slotUrl = branding[slot];
  if (slotUrl) return slotUrl;
  return branding.default_logo_url || null;
}
