"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ActionsFloatingPanel from "./profile-feed/ActionsFloatingPanel";

const TICKER_SPEED_PX_PER_SECOND = 72;

type DesktopOverflowTickerProps = {
  children: ReactNode;
  className?: string;
  fullText?: string;
};

export default function DesktopOverflowTicker({ children, className = "", fullText }: DesktopOverflowTickerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const measure = () => {
      const distance = Math.max(content.scrollWidth - viewport.clientWidth, 0);
      viewport.style.setProperty("--ticker-distance", `${distance}px`);
      viewport.style.setProperty("--ticker-duration", `${distance / TICKER_SPEED_PX_PER_SECOND}s`);
      setOverflow(distance > 1);
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [children]);

  return (
    <>
    <div role={fullText && overflow ? "button" : undefined} tabIndex={fullText && overflow ? 0 : undefined} aria-label={fullText && overflow ? fullText : undefined} aria-expanded={fullText && overflow ? open : undefined} onClick={fullText && overflow ? (event) => { event.stopPropagation(); setOpen((value) => !value); } : undefined} onKeyDown={fullText && overflow ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen((value) => !value); } } : undefined} ref={viewportRef} className={`desktop-overflow-ticker ${overflow ? "desktop-overflow-ticker--active" : ""} ${className}`}>
      <p ref={contentRef} className="desktop-overflow-ticker__content">
        {children}
      </p>
    </div>
    {open && fullText ? <ActionsFloatingPanel anchorRef={viewportRef} onClose={close} label={fullText}><p className="max-w-[26rem] whitespace-pre-wrap">{fullText}</p></ActionsFloatingPanel> : null}
    </>
  );
}
