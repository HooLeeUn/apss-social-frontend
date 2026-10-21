"use client";

import { type ReactNode, type RefObject, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Local to Following Actions, including its opt-in moderation menu.
export default function ActionsFloatingPanel({ anchorRef, onClose, children, label }: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  label: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const viewport = window.visualViewport;
    const margin = 8;
    const gap = 6;
    const leftEdge = (viewport?.offsetLeft ?? 0) + margin;
    const topEdge = (viewport?.offsetTop ?? 0) + margin;
    const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - margin * 2;
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - margin * 2;
    panel.style.maxWidth = `${rightEdge - leftEdge}px`;
    panel.style.maxHeight = `${bottomEdge - topEdge}px`;
    const rect = anchor.getBoundingClientRect();
    const height = panel.getBoundingClientRect().height;
    const below = bottomEdge - rect.bottom - gap;
    const above = rect.top - topEdge - gap;
    const opensAbove = height > below && above > below;
    panel.style.maxHeight = `${Math.max(1, Math.min(bottomEdge - topEdge, Math.max(above, below)))}px`;
    const size = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(leftEdge, Math.min(rect.left, rightEdge - size.width))}px`;
    panel.style.top = `${Math.max(topEdge, Math.min(opensAbove ? rect.top - gap - size.height : rect.bottom + gap, bottomEdge - size.height))}px`;
    panel.style.visibility = "visible";

    const outside = (event: Event) => {
      if (!panel.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose();
    };
    const movement = (event: Event) => {
      // Long comments can scroll inside the panel without dismissing it.
      if (!panel.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const otherPanel = () => onClose();
    window.dispatchEvent(new Event("profile-actions-panel-open"));
    window.addEventListener("profile-actions-panel-open", otherPanel);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("touchmove", movement, { passive: true, capture: true });
    document.addEventListener("wheel", movement, { passive: true, capture: true });
    window.addEventListener("scroll", movement, true);
    window.addEventListener("resize", onClose);
    viewport?.addEventListener("resize", onClose);
    viewport?.addEventListener("scroll", onClose);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("profile-actions-panel-open", otherPanel);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("touchmove", movement, true);
      document.removeEventListener("wheel", movement, true);
      window.removeEventListener("scroll", movement, true);
      window.removeEventListener("resize", onClose);
      viewport?.removeEventListener("resize", onClose);
      viewport?.removeEventListener("scroll", onClose);
      window.removeEventListener("keydown", escape);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div ref={panelRef} role="region" aria-label={label} style={{ position: "fixed", visibility: "hidden", width: "max-content" }} className="z-[1300] overflow-y-auto overscroll-contain rounded-xl border border-white/15 bg-zinc-950 p-3 text-sm text-zinc-200 shadow-xl shadow-black/50 [overflow-wrap:anywhere]">
      {children}
    </div>, document.body,
  );
}
