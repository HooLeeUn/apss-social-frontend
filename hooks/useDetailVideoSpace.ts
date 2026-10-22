"use client";

import { type RefObject, useLayoutEffect } from "react";
import { DETAIL_VIDEO_WIDTH } from "./detailVideoReference";

export function useDetailVideoSpace(rootRef: RefObject<HTMLDivElement | null>, enabled: boolean, suspended = false) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!enabled || suspended || !root) return;
    const saved = new Map<HTMLVideoElement, { video: string; wrapper: string }>();
    const apply = () => {
      root.querySelectorAll<HTMLVideoElement>("[data-video-comment-player]").forEach(video => {
        const wrapper = video.parentElement;
        if (!wrapper) return;
        if (!saved.has(video)) saved.set(video, { video: video.style.cssText, wrapper: wrapper.style.cssText });
        // CSS resolves the original height rule before painting. Parent width is
        // the sole overflow constraint; no measured size can replace this rule.
        wrapper.style.width = DETAIL_VIDEO_WIDTH;
        wrapper.style.aspectRatio = "9 / 16";
        wrapper.style.maxWidth = "100%";
        wrapper.style.height = "auto";
        // Metadata must not change the geometry of the aspect-ratio box.
        video.style.position = "absolute";
        video.style.inset = "0";
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.maxHeight = "none";
        wrapper.style.visibility = "";
      });
    };
    apply();
    // Enroll new cards only. No resize, scroll or metadata recalculation.
    const mutation = new MutationObserver(apply);
    mutation.observe(root, { childList: true, subtree: true });
    return () => {
      mutation.disconnect();
      saved.forEach((styles, video) => {
        video.style.cssText = styles.video;
        if (video.parentElement) video.parentElement.style.cssText = styles.wrapper;
      });
    };
  }, [enabled, rootRef, suspended]);
}
