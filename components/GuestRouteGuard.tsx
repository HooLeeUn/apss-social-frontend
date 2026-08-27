"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDesktopGuest } from "../hooks/useDesktopGuest";

const PUBLIC_GUEST_ROUTE = /^(?:\/feed|\/login|\/signup|\/movies\/[^/]+|\/users\/[^/]+)\/?$/;

export default function GuestRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, isAuthenticated, isGuest, isDesktop } = useDesktopGuest();
  useEffect(() => {
    if (!hydrated || isAuthenticated || !isGuest) return;
    if (!isDesktop) { router.replace("/login"); return; }
    if (!PUBLIC_GUEST_ROUTE.test(pathname)) router.replace("/feed");
  }, [hydrated, isAuthenticated, isGuest, isDesktop, pathname, router]);
  return null;
}
