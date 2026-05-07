import { apiFetch } from "./api";

export type ProfileVisibility = "public" | "private";

export interface ProfilePrivacySettings {
  visibility: ProfileVisibility;
  friendRequestsRestricted: boolean;
}

export interface BlockedUser {
  id: number | string;
  username: string;
}

const PROFILE_PRIVACY_ENDPOINT = "/profile/privacy/";
const BLOCKED_USERS_ENDPOINT = "/profile/privacy/blocked-users/";
const USER_RESTRICT_SEARCH_ENDPOINT = "/users/search/";

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function normalizeVisibility(value: unknown): ProfileVisibility {
  if (typeof value !== "string") return "public";
  return value.trim().toLowerCase() === "private" ? "private" : "public";
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  if (typeof value === "number") return value === 1;
  return false;
}

function hasFriendRequestsRestrictedField(payload: unknown): boolean {
  const record = toRecord(payload);
  const data = toRecord(record?.data);
  return Boolean(
    (record && "friend_requests_restricted" in record) || (data && "friend_requests_restricted" in data),
  );
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const root = toRecord(payload);
  if (!root) return [];

  if (Array.isArray(root.results)) return root.results;
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.blocked_users)) return root.blocked_users;

  const data = toRecord(root.data);
  if (!data) return [];

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.blocked_users)) return data.blocked_users;

  return [];
}

function normalizeBlockedUser(value: unknown, index: number): BlockedUser | null {
  const record = toRecord(value);
  if (!record) return null;

  const nestedUser = toRecord(record.user) ?? toRecord(record.profile) ?? record;
  const id = nestedUser.id ?? nestedUser.user_id ?? record.id ?? `blocked-${index + 1}`;
  const usernameRaw = nestedUser.username ?? nestedUser.name ?? record.username;
  const username = typeof usernameRaw === "string" ? usernameRaw.trim() : "";

  if (!username) return null;

  return {
    id: id as number | string,
    username,
  };
}

export function parsePrivacySettings(payload: unknown): ProfilePrivacySettings {
  const record = toRecord(payload);
  const data = toRecord(record?.data);

  return {
    visibility: normalizeVisibility(record?.visibility ?? data?.visibility),
    friendRequestsRestricted: normalizeBoolean(
      record?.friend_requests_restricted ?? data?.friend_requests_restricted,
    ),
  };
}

export function parseVisibility(payload: unknown): ProfileVisibility {
  return parsePrivacySettings(payload).visibility;
}

export function parseBlockedUsers(payload: unknown): BlockedUser[] {
  return extractArray(payload)
    .map((entry, index) => normalizeBlockedUser(entry, index))
    .filter((entry): entry is BlockedUser => Boolean(entry));
}

export async function getProfilePrivacySettings(): Promise<ProfilePrivacySettings> {
  const payload = await apiFetch(PROFILE_PRIVACY_ENDPOINT);
  return parsePrivacySettings(payload);
}

export async function getProfileVisibility(): Promise<ProfileVisibility> {
  return (await getProfilePrivacySettings()).visibility;
}

export async function updateProfileVisibility(visibility: ProfileVisibility): Promise<ProfileVisibility> {
  const payload = await apiFetch(PROFILE_PRIVACY_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify({ visibility }),
  });

  return parseVisibility(payload);
}

export async function updateFriendRequestsRestriction(friendRequestsRestricted: boolean): Promise<boolean> {
  const payload = await apiFetch(PROFILE_PRIVACY_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify({ friend_requests_restricted: friendRequestsRestricted }),
  });

  if (!hasFriendRequestsRestrictedField(payload)) return friendRequestsRestricted;

  return parsePrivacySettings(payload).friendRequestsRestricted;
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const payload = await apiFetch(BLOCKED_USERS_ENDPOINT);
  return parseBlockedUsers(payload);
}

export async function blockUser(userId: number | string): Promise<void> {
  await apiFetch(BLOCKED_USERS_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function unblockUser(userId: number | string): Promise<void> {
  await apiFetch(`${BLOCKED_USERS_ENDPOINT}${encodeURIComponent(String(userId))}/`, {
    method: "DELETE",
  });
}

export async function searchUsersToRestrict(query: string): Promise<BlockedUser[]> {
  const trimmed = query.trim();
  const normalizedQuery = trimmed.startsWith("@") ? `@${trimmed.slice(1).trim()}` : trimmed;
  if (!normalizedQuery || normalizedQuery === "@") return [];

  const payload = await apiFetch(
    `${USER_RESTRICT_SEARCH_ENDPOINT}?${new URLSearchParams({ q: normalizedQuery }).toString()}`,
  );
  return parseBlockedUsers(payload);
}
