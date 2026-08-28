"use client";

import { useEffect, useState } from "react";
import { useAuthState } from "./useAuthState";

export function useDesktopGuest() {
  const auth = useAuthState();
  const [desktop, setDesktop] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [viewportHydrated, setViewportHydrated] = useState(false);
  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1280px) and (hover: hover) and (pointer: fine)");
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const sync = () => { setDesktop(desktopQuery.matches); setMobile(mobileQuery.matches); setViewportHydrated(true); };
    sync(); desktopQuery.addEventListener("change", sync); mobileQuery.addEventListener("change", sync);
    return () => { desktopQuery.removeEventListener("change", sync); mobileQuery.removeEventListener("change", sync); };
  }, []);
  return { ...auth, viewportHydrated, isDesktopGuest: auth.isGuest && desktop, isMobileGuest: auth.isGuest && mobile, isGuestExperience: auth.isGuest && (desktop || mobile), isDesktop: desktop, isMobile: mobile };
}
