"use client";

import { type RefObject, useLayoutEffect } from "react";

// Keep the input and the start of its upward-opening results in the visible
// viewport. Never change scrollTop: scrolling/pagination belongs to SearchBar.
export function useMobileSearchViewport(active: boolean, containerRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    const viewport = window.visualViewport;
    let fullHeight = window.innerHeight;
    let timer: number | undefined;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      const layoutHeight = document.documentElement.clientHeight;
      fullHeight = Math.max(fullHeight, window.innerHeight);
      const keyboardOpen = (viewport?.scale ?? 1) === 1 && fullHeight - height > 150;

      if (keyboardOpen) {
        container.style.bottom = `${Math.max(12, layoutHeight - top - height + 12)}px`;
      } else {
        container.style.removeProperty("bottom");
      }

      const search = container.firstElementChild;
      if (search) {
        const available = Math.max(0, search.getBoundingClientRect().top - top - 12);
        const limit = keyboardOpen ? 420 : Math.min(420, window.innerHeight * 0.56);
        container.style.setProperty("--search-results-max-height", `${Math.min(limit, available)}px`);
      }
    };
    // Android emits several resize/scroll events during the keyboard animation.
    // Apply one measurement after it settles, without scrolling the document.
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 150);
    };
    update();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      window.clearTimeout(timer);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      container.style.removeProperty("bottom");
      container.style.removeProperty("--search-results-max-height");
    };
  }, [active, containerRef]);
}
