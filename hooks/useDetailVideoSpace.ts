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
        const width = DETAIL_VIDEO_WIDTH;
        if (wrapper.style.width !== width) wrapper.style.width = width;
        // CSS constrains the displayed rectangle to its parent when necessary.
        // It never writes a measured safety limit back into the design base.
        wrapper.style.aspectRatio = "9 / 16";
        wrapper.style.maxWidth = "100%";
        wrapper.style.height = "auto";
        // Keep intrinsic video dimensions from influencing the aspect-ratio box.
        video.style.position = "absolute";
        video.style.inset = "0";
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.maxHeight = "none";
        wrapper.style.visibility = "";
      });
    };
    apply();
    // Child-list changes enroll newly loaded cards; live geometry is never observed.
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
