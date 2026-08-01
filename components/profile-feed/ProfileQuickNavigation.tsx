"use client";

import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";

type QuickNavigationItem = {
  label: string;
  icon: ReactNode;
  onNavigate: () => void;
};

interface ProfileQuickNavigationProps {
  ariaLabel: string;
  items: QuickNavigationItem[];
}

const MOVE_THRESHOLD = 10;
const LONG_PRESS_DELAY = 500;

function LineIcon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export const profileQuickNavigationIcons = {
  following: <LineIcon><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M3.5 20c.4-4.2 2.2-6.4 5.5-6.4s5.1 2.2 5.5 6.4M14 14.2c3.6-.7 5.8 1.3 6.4 4.8" /></LineIcon>,
  friends: <LineIcon><path d="m3 12 4-4 3 2 2-1.5 2 1.5 3-2 4 4-3.2 3.2-2-1.7-3.8 3.7-3.8-3.7-2 1.7L3 12Z" /><path d="m9.2 13.5 2.8 2.7 2.8-2.7" /></LineIcon>,
  activity: <LineIcon><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" /></LineIcon>,
  list: <LineIcon><path d="M20 13 13 20l-9-9V4h7l9 9Z" /><circle cx="8" cy="8" r="1" /></LineIcon>,
  recommendations: <LineIcon><path d="M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Z" /><path d="M12 7v2M12 12v1M12 16v1" /></LineIcon>,
  followingActivity: <LineIcon><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M6 3l2 3m3-3 2 3m3-3 2 3" /></LineIcon>,
};

export default function ProfileQuickNavigation({ ariaLabel, items }: ProfileQuickNavigationProps) {
  const [visible, setVisible] = useState(true);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const lastScrollY = useRef(0);
  const gesture = useRef<{ pointerId: number; x: number; y: number; moved: boolean; longPressed: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  const clearLongPress = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastScrollY.current = Math.max(window.scrollY, 0);
    const onScroll = () => {
      clearLongPress();
      gesture.current = null;
      setTooltipIndex(null);
      const next = Math.max(window.scrollY, 0);
      const delta = next - lastScrollY.current;
      if (next < 80) setVisible(true);
      else if (delta > 8) setVisible(false);
      else if (delta < -8) setVisible(true);
      if (Math.abs(delta) > 8) lastScrollY.current = next;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => () => clearLongPress(), []);

  const start = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (event.pointerType === "mouse") return;
    clearLongPress();
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, longPressed: false };
    timer.current = setTimeout(() => {
      if (!gesture.current || gesture.current.moved) return;
      gesture.current.longPressed = true;
      setTooltipIndex(index);
    }, LONG_PRESS_DELAY);
  };

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > MOVE_THRESHOLD) {
      current.moved = true;
      clearLongPress();
      setTooltipIndex(null);
    }
  };

  const finish = (event: PointerEvent<HTMLButtonElement>, action: () => void) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    clearLongPress();
    gesture.current = null;
    setTooltipIndex(null);
    suppressClick.current = true;
    if (!current.moved && !current.longPressed) action();
  };

  const cancel = () => {
    if (gesture.current) suppressClick.current = true;
    clearLongPress();
    gesture.current = null;
    setTooltipIndex(null);
  };

  return (
    <nav aria-label={ariaLabel} className={`fixed inset-x-4 z-[60] md:hidden bottom-[calc(1rem+env(safe-area-inset-bottom))] transition-transform duration-300 ease-out motion-reduce:transition-none ${visible ? "translate-y-0" : "pointer-events-none translate-y-[calc(100%+2rem+env(safe-area-inset-bottom))]"}`}>
      <div className="overflow-visible rounded-full border border-white/15 bg-zinc-950/85 px-2 py-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {tooltipIndex !== null ? <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+0.65rem)] left-1/2 z-10 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-center text-xs font-medium text-white shadow-xl">{items[tooltipIndex]?.label}</span> : null}
        <div className="flex w-full min-w-max touch-pan-x justify-between gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, index) => (
            <button key={item.label} type="button" aria-label={item.label} title={item.label}
              className="relative flex h-11 min-h-11 min-w-11 flex-1 basis-11 shrink-0 items-center justify-center rounded-full text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-300"
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                item.onNavigate();
              }}
              onPointerDown={(event) => start(event, index)} onPointerMove={move}
              onPointerUp={(event) => finish(event, item.onNavigate)}
              onPointerCancel={cancel}
              onPointerLeave={cancel}
            >
              {item.icon}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
