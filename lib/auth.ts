const TOKEN_KEY = "token";
const GUEST_KEY = "qnext_guest_mode_v1";
export const authStateEventName = "qnext:auth-state-change";

function emitAuthStateChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(authStateEventName));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(GUEST_KEY);
    emitAuthStateChange();
  } catch {
    // no-op
  }
}

export function clearToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    emitAuthStateChange();
  } catch {
    // no-op
  }
}

/** Guest is an explicit, session-scoped UI choice; it is never an identity or credential. */
export function enterGuestMode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.setItem(GUEST_KEY, "1");
  emitAuthStateChange();
}

export function clearGuestMode() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(GUEST_KEY);
  emitAuthStateChange();
}

export function getAuthState() {
  const isAuthenticated = Boolean(getToken());
  let explicitlyGuest = false;
  if (typeof window !== "undefined") {
    try { explicitlyGuest = sessionStorage.getItem(GUEST_KEY) === "1"; } catch { /* no-op */ }
  }
  return { isAuthenticated, isGuest: !isAuthenticated && explicitlyGuest };
}
