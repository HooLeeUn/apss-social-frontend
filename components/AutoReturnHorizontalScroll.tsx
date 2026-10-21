"use client";

import { type HTMLAttributes, useEffect, useRef } from "react";

/** Native scrolling preserves vertical gestures and button clicks. Desktop is untouched. */
export default function AutoReturnHorizontalScroll({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const mobile = window.matchMedia("(max-width: 1279px)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let touching = false;
    const clear = () => { clearTimeout(timer); };
    const schedule = () => {
      clear();
      if (!mobile.matches || touching || (node.matches(":focus-visible") || !!node.querySelector(":focus-visible")) || node.scrollLeft <= 0) return;
      timer = setTimeout(() => node.scrollTo({ left: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }), 1500);
    };
    const measure = () => {
      const overflow = mobile.matches && node.scrollWidth > node.clientWidth + 1;
      node.dataset.overflow = String(overflow);
      node.tabIndex = overflow ? 0 : -1;
      if (!overflow) { clear(); node.scrollLeft = 0; }
    };
    const start = () => { touching = true; clear(); };
    const end = () => { touching = false; schedule(); };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    const mutation = new MutationObserver(measure);
    mutation.observe(node, { childList: true, subtree: true, characterData: true });
    node.addEventListener("scroll", schedule, { passive: true });
    node.addEventListener("pointerdown", start, { passive: true });
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchend", end, { passive: true });
    node.addEventListener("touchcancel", end, { passive: true });
    node.addEventListener("focusin", clear);
    node.addEventListener("focusout", schedule);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    mobile.addEventListener("change", measure);
    measure();
    void document.fonts.ready.then(() => { if (node.isConnected) measure(); });
    return () => {
      clear(); observer.disconnect(); mutation.disconnect();
      node.removeEventListener("scroll", schedule);
      node.removeEventListener("pointerdown", start);
      node.removeEventListener("touchstart", start);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", end);
      node.removeEventListener("focusin", clear);
      node.removeEventListener("focusout", schedule);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      mobile.removeEventListener("change", measure);
    };
  }, []);
  return <div {...props} ref={ref} className={`auto-return-horizontal ${className}`}>{children}</div>;
}
