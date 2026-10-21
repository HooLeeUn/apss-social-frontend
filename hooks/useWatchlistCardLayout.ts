"use client";

import { useLayoutEffect, useRef } from "react";

/** Measure the existing layout, ignoring empty reserved space around synopsis. */
export function watchlistNeedsTallLayout(card: HTMLElement): boolean {
  const row = card.querySelector<HTMLElement>("[data-watchlist-ratings]");
  if (!row) return false;
  const rowBounds = row.getBoundingClientRect();
  const style = getComputedStyle(row);
  const left = rowBounds.left + parseFloat(style.paddingLeft || "0");
  const right = rowBounds.right - parseFloat(style.paddingRight || "0");
  const selectors = [
    '[data-tour="feed-card-rating-overall"]',
    '[data-tour="feed-card-rating-following"]',
    '[data-tour="feed-card-rating-mine"]',
    '[data-tour="feed-card-synopsis"]',
  ];
  const groups = selectors.map(selector => {
    const element = row.querySelector<HTMLElement>(selector);
    if (!element) return [];
    // Text ranges include painted content that can extend outside a flex item's box.
    const range = document.createRange();
    range.selectNodeContents(element);
    return [element.getBoundingClientRect(), ...Array.from(range.getClientRects())]
      .filter(rect => rect.width > 0 && rect.height > 0);
  });
  if (groups.flat().some(rect => rect.left < left - 1 || rect.right > right + 1)) return true;
  const intersects = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  if (groups.some((group, index) => groups.slice(index + 1).some(other => group.some(a => other.some(b => intersects(a, b)))))) return true;
  const icons = card.querySelector<HTMLElement>("[data-watchlist-metadata] > .interaction-icons");
  const body = card.querySelector<HTMLElement>("[data-watchlist-body]");
  if (!icons || !body) return false;
  const iconBounds = icons.getBoundingClientRect();
  const bodyBounds = body.getBoundingClientRect();
  return iconBounds.left < bodyBounds.left - 1 || iconBounds.right > bodyBounds.right + 1;
}

/** Only the main watchlist opts in; publish a layout only after measurement. */
export function useWatchlistCardLayout(enabled: boolean) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const card = ref.current;
    if (!enabled || !card) return;
    const mobile = window.matchMedia("(max-width: 767px)");
    let frame = 0;
    let disposed = false;
    let stable = card.dataset.watchlistTall === "true";
    let candidate: boolean | null = null;
    let width = card.getBoundingClientRect().width;

    const readNormalLayout = () => {
      if (!mobile.matches) return false;
      const previous = card.dataset.watchlistTall;
      // The normal-layout probe and restoration happen in the same JS task.
      // No intermediate mode survives to a paint or to the next animation frame.
      if (stable) card.dataset.watchlistTall = "false";
      try {
        return watchlistNeedsTallLayout(card);
      } finally {
        if (stable) card.dataset.watchlistTall = previous!;
      }
    };
    const commit = (tall: boolean) => {
      const value = String(tall);
      if (card.dataset.watchlistTall !== value) card.dataset.watchlistTall = value;
      stable = tall;
      candidate = null;
    };
    const measure = () => {
      frame = 0;
      if (disposed) return;
      const next = readNormalLayout();
      if (next === stable) {
        candidate = null;
      } else if (candidate === next) {
        commit(next);
      } else {
        // Keep the last stable mode visible until the next frame confirms it.
        candidate = next;
        schedule();
      }
    };
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(measure);
    };

    // Complete the first layout in this commit, before the browser paints the card.
    commit(readNormalLayout());
    card.dataset.watchlistReady = "true";

    const observer = new ResizeObserver(() => {
      const nextWidth = card.getBoundingClientRect().width;
      // Our own height change must not start another detection cycle.
      if (nextWidth !== width) {
        width = nextWidth;
        schedule();
      }
    });
    observer.observe(card);
    const mutation = new MutationObserver(schedule);
    mutation.observe(card, { childList: true, characterData: true, subtree: true });
    mobile.addEventListener("change", schedule);
    window.addEventListener("resize", schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    void document.fonts.ready.then(() => { if (!disposed) schedule(); });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect(); mutation.disconnect();
      mobile.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
      document.fonts.removeEventListener("loadingdone", schedule);
      delete card.dataset.watchlistTall;
      delete card.dataset.watchlistReady;
    };
  }, [enabled]);
  return ref;
}
