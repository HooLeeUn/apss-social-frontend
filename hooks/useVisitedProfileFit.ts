"use client";

import { type RefObject, useLayoutEffect } from "react";

export function useVisitedProfileFit(ref: RefObject<HTMLElement | null>, enabled: boolean, kind: "identity" | "ratings", contentKey = "") {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const attribute = kind === "identity" ? "data-visited-identity-compact" : "data-visited-ratings-stacked";
    const media = window.matchMedia("(max-width: 1279px)");
    const measure = () => {
      if (!media.matches) { element.removeAttribute(attribute); return; }
      // Always measure the original layout, preventing feedback after adaptation.
      const original = kind === "ratings" ? element.closest<HTMLElement>(".favorite-movie-card") ?? element : element;
      const probe = original.cloneNode(true) as HTMLElement;
      probe.removeAttribute(attribute);
      probe.querySelectorAll(`[${attribute}]`).forEach(node => node.removeAttribute(attribute));
      probe.setAttribute("aria-hidden", "true");
      probe.setAttribute("inert", "");
      probe.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
      probe.style.cssText = `position:fixed;left:-10000px;top:0;width:${original.getBoundingClientRect().width}px;visibility:hidden;pointer-events:none;box-sizing:border-box`;
      original.parentElement?.appendChild(probe);
      try {
        let crowded = false;
        if (kind === "identity") {
          const followers = probe.querySelector<HTMLElement>("[data-profile-identity-followers]");
          if (followers) {
            const target = followers.getBoundingClientRect();
            crowded = Array.from(probe.querySelectorAll<HTMLElement>("[data-profile-chip]")).some(chip => {
              const rect = chip.getBoundingClientRect();
              return rect.width > 0 && rect.left < target.right && rect.right > target.left && rect.top < target.bottom && rect.bottom > target.top;
            });
          }
        } else {
          const row = probe.querySelector<HTMLElement>(".favorite-movie-card__ratings") ?? probe;
          Array.from(row.children).forEach(child => { (child as HTMLElement).style.flexShrink = "0"; });
          crowded = row.scrollWidth > row.clientWidth + 1;
        }
        if (crowded) element.setAttribute(attribute, "true");
        else element.removeAttribute(attribute);
      } finally { probe.remove(); }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    media.addEventListener("change", measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", measure);
      document.fonts.removeEventListener("loadingdone", measure);
      element.removeAttribute(attribute);
    };
  }, [contentKey, enabled, kind, ref]);
}
