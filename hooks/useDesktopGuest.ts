"use client";

import { useEffect, useState } from "react";
import { useAuthState } from "./useAuthState";

export function useDesktopGuest() {
  const auth = useAuthState();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px) and (hover: hover) and (pointer: fine)");
    const sync = () => setDesktop(query.matches);
    sync(); query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return { ...auth, isDesktopGuest: auth.isGuest && desktop, isDesktop: desktop };
}
