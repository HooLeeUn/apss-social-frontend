"use client";

import { useEffect, useRef } from "react";

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

/** Only the main watchlist opts in; no alternative DOM, scroll or hidden controls. */
export function useWatchlistCardLayout(enabled: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const card = ref.current;
    if (!enabled || !card) return;
    const mobile = window.matchMedia("(max-width: 767px)");
    let frame = 0;
    let disposed = false;
    const measure = () => {
      // Read normal geometry synchronously, then restore the final mode before paint.
      // This also allows a tall card to return to normal when width becomes sufficient.
      card.dataset.watchlistTall = "false";
      card.dataset.watchlistTall = String(mobile.matches && watchlistNeedsTallLayout(card));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(card);
    const mutation = new MutationObserver(schedule);
    mutation.observe(card, { childList: true, characterData: true, subtree: true });
    mobile.addEventListener("change", schedule);
    window.addEventListener("resize", schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    void document.fonts.ready.then(() => { if (!disposed) schedule(); });
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect(); mutation.disconnect();
      mobile.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
      document.fonts.removeEventListener("loadingdone", schedule);
      delete card.dataset.watchlistTall;
    };
  }, [enabled]);
  return ref;
}
