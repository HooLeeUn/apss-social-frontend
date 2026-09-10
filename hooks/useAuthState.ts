"use client";

import { useEffect, useState } from "react";
import { authStateEventName, getAuthState } from "../lib/auth";

export type AuthStatus = "checking" | "authenticated" | "unauthenticated";

export function useAuthState() {
  const [state, setState] = useState<{ isAuthenticated: boolean; isGuest: boolean; hydrated: boolean; authStatus: AuthStatus }>({
    isAuthenticated: false,
    isGuest: false,
    hydrated: false,
    authStatus: "checking",
  });
  useEffect(() => {
    const sync = () => {
      const authState = getAuthState();
      setState({
        ...authState,
        hydrated: true,
        authStatus: authState.isAuthenticated ? "authenticated" : "unauthenticated",
      });
    };
    sync();
    window.addEventListener(authStateEventName, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(authStateEventName, sync); window.removeEventListener("storage", sync); };
  }, []);
  return state;
}
