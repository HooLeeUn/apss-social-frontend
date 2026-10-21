"use client";
import { type ReactNode, useEffect, useRef, useState } from "react";
import AutoReturnHorizontalScroll from "./AutoReturnHorizontalScroll";

/** Keep an inert normal-layout probe so entering compact mode cannot oscillate. */
export default function AdaptiveFeedInformation({ normal, title, metadata, controls }: { normal: ReactNode; title: ReactNode; metadata: ReactNode; controls: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const host = root.current!;
    const content = probe.current!;
    const media = matchMedia("(max-width: 1279px)");
    const measure = () => {
      const bounds = content.getBoundingClientRect();
      const ratings = content.querySelector<HTMLElement>("[data-tour=feed-card-rating-overall]")?.parentElement;
      const icons = content.querySelector<HTMLElement>(".interaction-icons");
      const genre = content.querySelector<HTMLElement>("[data-feed-genres]");
      const range = document.createRange();
      if (genre) range.selectNodeContents(genre);
      const textBounds = genre ? range.getBoundingClientRect() : null;
      const collision = !!(icons && genre && icons.getBoundingClientRect().left < (textBounds?.right ?? 0) && icons.getBoundingClientRect().top < (textBounds?.bottom ?? 0));
      const overflow = Array.from(content.querySelectorAll<HTMLElement>("[data-tour^=feed-card-rating], .interaction-icons, [data-tour=feed-card-synopsis]")).some(el => el.getBoundingClientRect().right > bounds.right + 1);
      const ratingItems = ratings ? Array.from(ratings.children).map(el => el.getBoundingClientRect()) : [];
      const overlappingRatings = ratingItems.some((rect, index) => ratingItems.slice(index + 1).some(other => rect.width > 0 && other.width > 0 && rect.left < other.right - 1 && rect.right > other.left + 1 && rect.top < other.bottom - 1 && rect.bottom > other.top + 1));
      setCompact(media.matches && (overflow || collision || overlappingRatings || !!(ratings && ratings.scrollWidth > ratings.clientWidth + 1)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(host); observer.observe(content);
    const mutation = new MutationObserver(measure);
    mutation.observe(content, { childList: true, subtree: true, characterData: true });
    media.addEventListener("change", measure);
    void document.fonts.ready.then(() => { if (host.isConnected) measure(); });
    measure();
    return () => { observer.disconnect(); mutation.disconnect(); media.removeEventListener("change", measure); };
  }, []);
  return <div ref={root} className="relative flex min-w-0 flex-1" data-feed-compact={compact}>
    <div ref={probe} inert={compact || undefined} aria-hidden={compact || undefined} className={compact ? "feed-info-probe" : "flex min-w-0 flex-1"}>{normal}</div>
    {compact ? <div className="absolute inset-0 flex min-w-0 flex-col p-3 sm:p-3.5">
      <div className="min-w-0 shrink-0">{title}</div>
      <AutoReturnHorizontalScroll className="feed-info-panels mt-1.5 flex min-h-0 flex-1 snap-x snap-mandatory" aria-label="Información y controles">
        <section className="w-full shrink-0 snap-start space-y-1.5" aria-label="Datos de la producción">{metadata}</section>
        <section className="feed-compact-controls w-full shrink-0 snap-start" aria-label="Controles y calificaciones">{controls}</section>
      </AutoReturnHorizontalScroll>
    </div> : null}
  </div>;
}
