"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PROTECTED_ROUTE_PATTERNS = [
  /^\/feed\/?$/,
  /^\/profile-feed\/?$/,
  /^\/movies\/[^/]+\/?$/,
  /^\/users\/[^/]+\/?$/,
  /^\/settings\/personal-data\/?$/,
  /^\/privacy-security\/?$/,
  /^\/policies\/?$/,
];

const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable]";

function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isEditableTarget(target: EventTarget | null) {
  const element = target instanceof Element
    ? target
    : target instanceof Node
      ? target.parentElement
      : null;

  return Boolean(element?.closest(EDITABLE_SELECTOR));
}

export default function DisableNativeContextMenu() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isProtectedRoute(pathname)) return;

    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const handleContextMenu = (event: MouseEvent) => {
      if (coarsePointer.matches && !isEditableTarget(event.target)) {
        event.preventDefault();
      }
    };

    document.body.classList.add("qnext-disable-native-callout");
    document.addEventListener("contextmenu", handleContextMenu, { capture: true });

    return () => {
      document.body.classList.remove("qnext-disable-native-callout");
      document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
    };
  }, [pathname]);

  return null;
}
