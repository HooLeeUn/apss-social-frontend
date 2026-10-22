"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";
import { measureDetailVideoReference } from "./detailVideoReference";

export function useDetailVideoSpace(rootRef: RefObject<HTMLDivElement | null>, enabled: boolean, suspended = false) {
  // Calibration belongs to this hook instance, not to the trailer/layout effect.
  const calibration = useRef<{
    base: { width: number; height: number } | null;
    pending: ReturnType<typeof measureDetailVideoReference> | null;
  }>({ base: null, pending: null });
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!enabled || suspended || !root) return;
    let disposed = false;
    let measuring = false;
    let base = calibration.current.base;
    const saved = new Map<HTMLVideoElement, { video: string; wrapper: string }>();
    const apply = () => {
      root.querySelectorAll<HTMLVideoElement>("[data-video-comment-player]").forEach(video => {
        const wrapper = video.parentElement;
        if (!wrapper) return;
        if (!saved.has(video)) saved.set(video, { video: video.style.cssText, wrapper: wrapper.style.cssText });
        if (!base) {
          wrapper.style.visibility = "hidden";
          return;
        }
        const width = base.width + "px", height = base.height + "px";
        if (wrapper.style.width !== width) wrapper.style.width = width;
        if (wrapper.style.height !== height) wrapper.style.height = height;
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.maxHeight = "none";
        wrapper.style.visibility = "";
      });
    };
    const measure = async () => {
      if (disposed || measuring || !root.querySelector("[data-video-comment-player]")) return;
      measuring = true;
      try {
        if (!calibration.current.pending) {
          calibration.current.pending = measureDetailVideoReference(root)
            .then(next => { calibration.current.base = next; return next; })
            .finally(() => { calibration.current.pending = null; });
        }
        const next = await calibration.current.pending;
        if (disposed || !next) return;
        if (!base || base.width !== next.width || base.height !== next.height) base = next;
        apply();
      } catch (error) {
        console.error("Could not measure the mobile Detail video reference", error);
        saved.forEach((styles, video) => {
          video.style.cssText = styles.video;
          if (video.parentElement) video.parentElement.style.cssText = styles.wrapper;
        });
      } finally {
        measuring = false;
      }
    };
    apply();
    if (!base) void measure();
    // Child-list changes enroll newly loaded cards; live geometry is never observed.
    const mutation = new MutationObserver(() => { apply(); if (!base) void measure(); });
    mutation.observe(root, { childList: true, subtree: true });
    const resize = () => { apply(); if (!base) void measure(); };
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      disposed = true;
      mutation.disconnect();
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      saved.forEach((styles, video) => {
        video.style.cssText = styles.video;
        if (video.parentElement) video.parentElement.style.cssText = styles.wrapper;
      });
    };
  }, [enabled, rootRef, suspended]);
}
