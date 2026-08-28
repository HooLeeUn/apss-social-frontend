"use client";

import { useEffect, useState } from "react";
import { authStateEventName, getAuthState } from "../lib/auth";

export function useAuthState() {
  const [state, setState] = useState({ isAuthenticated: false, isGuest: false, hydrated: false });
  useEffect(() => {
    const sync = () => setState({ ...getAuthState(), hydrated: true });
    sync();
    window.addEventListener(authStateEventName, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(authStateEventName, sync); window.removeEventListener("storage", sync); };
  }, []);
  return state;
}
