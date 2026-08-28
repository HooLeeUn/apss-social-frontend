"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDesktopGuest } from "../hooks/useDesktopGuest";

const PUBLIC_GUEST_ROUTE = /^(?:\/feed|\/login|\/signup|\/movies\/[^/]+|\/users\/[^/]+)\/?$/;

export default function GuestRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, viewportHydrated, isAuthenticated, isGuest, isDesktop, isMobile } = useDesktopGuest();
  useEffect(() => {
    if (!hydrated || !viewportHydrated || isAuthenticated || !isGuest) return;
    if (!isDesktop && !isMobile) { router.replace("/login"); return; }
    if (!PUBLIC_GUEST_ROUTE.test(pathname)) router.replace("/feed");
  }, [hydrated, viewportHydrated, isAuthenticated, isGuest, isDesktop, isMobile, pathname, router]);
  return null;
}
