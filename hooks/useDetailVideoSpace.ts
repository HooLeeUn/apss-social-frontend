"use client";

import { type RefObject, useLayoutEffect } from "react";

export function useDetailVideoSpace(rootRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;
    const sticky = document.querySelector<HTMLElement>('[data-mobile-detail-sticky="true"]');
    const viewport = window.visualViewport;
    const saved = new Map<HTMLVideoElement, { video: string; wrapper: string }>();
    const safe = document.createElement("div");
    safe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom)";
    document.body.appendChild(safe);
    const measure = () => {
      const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("[data-video-comment-player]"));
      const first = videos[0];
      const firstWrapper = first?.parentElement;
      if (!first || !firstWrapper) return;
      const top = Math.max(sticky?.getBoundingClientRect().bottom ?? 0, root.getBoundingClientRect().top);
      // Reserve the card's author/date row, spacing, and padding above the video.
      const overhead = firstWrapper.getBoundingClientRect().top - root.getBoundingClientRect().top;
      const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      const safeBottom = (parseFloat(getComputedStyle(safe).paddingBottom) || 0) + 12;
      const height = Math.max(1, bottom - top - overhead - safeBottom);
      videos.forEach(video => {
        const wrapper = video.parentElement;
        if (!wrapper?.parentElement) return;
        if (!saved.has(video)) saved.set(video, { video: video.style.cssText, wrapper: wrapper.style.cssText });
        const ratio = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 9 / 16;
        const width = Math.min(wrapper.parentElement.clientWidth, height * ratio);
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${width / ratio}px`;
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.maxHeight = "none";
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (sticky) observer.observe(sticky);
    const mutation = new MutationObserver(measure);
    mutation.observe(root, { childList: true, subtree: true });
    root.addEventListener("loadedmetadata", measure, true);
    window.addEventListener("resize", measure);
    viewport?.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      mutation.disconnect();
      root.removeEventListener("loadedmetadata", measure, true);
      window.removeEventListener("resize", measure);
      viewport?.removeEventListener("resize", measure);
      saved.forEach((styles, video) => {
        video.style.cssText = styles.video;
        if (video.parentElement) video.parentElement.style.cssText = styles.wrapper;
      });
      safe.remove();
    };
  }, [enabled, rootRef]);
}
