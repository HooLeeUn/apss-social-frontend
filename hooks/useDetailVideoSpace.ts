"use client";

import { type RefObject, useLayoutEffect } from "react";
import { detailVideoAvailableHeight, fitDetailVideo } from "./detailVideoReference";

export function useDetailVideoSpace(rootRef: RefObject<HTMLDivElement | null>, enabled: boolean, suspended = false) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!enabled || suspended || !root) return;
    const viewport = root.closest<HTMLElement>("[data-detail-movie-content]");
    if (!viewport) return;
    const saved = new Map<HTMLVideoElement, { video: string; wrapper: string }>();
    const observed = new Set<Element>();
    const paddingBottom = (element: Element | null) => element ? parseFloat(getComputedStyle(element).paddingBottom) || 0 : 0;
    const observe = (element: Element | null) => {
      if (element && !observed.has(element)) {
        observed.add(element);
        resize.observe(element);
      }
    };
    const apply = () => {
      const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("[data-video-comment-player]"));
      const first = videos[0];
      const slot = first?.parentElement?.parentElement;
      const header = slot?.previousElementSibling;
      const sticky = viewport.querySelector<HTMLElement>("[data-mobile-detail-sticky]");
      // Observe only inputs to the fit, never the video/wrapper's own height.
      observe(sticky);
      observe(header ?? null);
      const recorderGroup = viewport.querySelector("[data-video-reaction-rec]")?.parentElement ?? null;
      observe(recorderGroup);
      const usable = slot && header && sticky && viewport.clientHeight > 0 &&
        header.getBoundingClientRect().height > 0 && sticky.getBoundingClientRect().height > 0;
      const availableHeight = usable ? detailVideoAvailableHeight(
        viewport.clientHeight,
        slot.getBoundingClientRect().top,
        viewport.getBoundingClientRect().top,
        viewport.scrollTop,
        paddingBottom(viewport) + paddingBottom(recorderGroup) + paddingBottom(first.closest("[data-video-comment-card]")) + paddingBottom(root.closest("[data-mobile-video-reaction]")),
      ) : 0;
      const size = usable ? fitDetailVideo(slot.clientWidth, availableHeight) : null;
      videos.forEach(video => {
        const wrapper = video.parentElement;
        if (!wrapper) return;
        if (!saved.has(video)) saved.set(video, { video: video.style.cssText, wrapper: wrapper.style.cssText });
        if (!size) {
          wrapper.style.visibility = "hidden";
          return;
        }
        // This is a live safety bound, not a new calibration/base. Every update
        // fits the same immutable ideal against current layout inputs.
        const width = `${size.width}px`;
        if (wrapper.style.width !== width) wrapper.style.width = width;
        wrapper.style.aspectRatio = "9 / 16";
        wrapper.style.maxWidth = "100%";
        wrapper.style.height = "auto";
        video.style.position = "absolute";
        video.style.inset = "0";
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.maxHeight = "none";
        wrapper.style.visibility = "";
      });
    };
    const resize = new ResizeObserver(apply);
    observe(viewport);
    apply();
    // Child-list changes enroll late cards and update layout constraints.
    const mutation = new MutationObserver(apply);
    mutation.observe(viewport, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
      saved.forEach((styles, video) => {
        video.style.cssText = styles.video;
        if (video.parentElement) video.parentElement.style.cssText = styles.wrapper;
      });
    };
  }, [enabled, rootRef, suspended]);
}
