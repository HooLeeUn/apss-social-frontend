"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type DesktopOverflowTickerProps = {
  children: ReactNode;
  className?: string;
};

export default function DesktopOverflowTicker({ children, className = "" }: DesktopOverflowTickerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const measure = () => {
      const distance = Math.max(content.scrollWidth - viewport.clientWidth, 0);
      viewport.style.setProperty("--ticker-distance", `${distance}px`);
      setOverflow(distance > 1);
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div ref={viewportRef} className={`desktop-overflow-ticker ${overflow ? "desktop-overflow-ticker--active" : ""} ${className}`}>
      <p ref={contentRef} className="desktop-overflow-ticker__content">
        {children}
      </p>
    </div>
  );
}
