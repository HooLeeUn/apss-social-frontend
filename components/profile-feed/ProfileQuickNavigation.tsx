"use client";

import { type PointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import MyListIcon from "../MyListIcon";

type QuickNavigationItem = {
  label: string;
  icon: ReactNode;
  onNavigate: () => void;
  tourTarget?: string;
};

interface ProfileQuickNavigationProps {
  ariaLabel: string;
  items: QuickNavigationItem[];
  pendingFriendRequestsCount: number;
  forceVisible?: boolean;
  visible?: boolean;
  showBackToTop?: boolean;
  onBackToTop?: () => void;
  backToTopLabel?: string;
}

const LONG_PRESS_DELAY = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;

function LineIcon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function RecommendationsIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons/Ticket.png" alt="" className="pointer-events-none h-7 w-[34px] object-contain" />
  );
}

export const profileQuickNavigationIcons = {
  following: <LineIcon><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M3.5 20c.4-4.2 2.2-6.4 5.5-6.4s5.1 2.2 5.5 6.4M14 14.2c3.6-.7 5.8 1.3 6.4 4.8" /></LineIcon>,
  friends: <LineIcon><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></LineIcon>,
  activity: <LineIcon><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" /></LineIcon>,
  list: <MyListIcon />,
  recommendations: <RecommendationsIcon />,
  followingActivity: <LineIcon><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M6 3l2 3m3-3 2 3m3-3 2 3" /></LineIcon>,
};

export default function ProfileQuickNavigation({
  ariaLabel,
  items,
  pendingFriendRequestsCount,
  forceVisible = false,
  visible = true,
  showBackToTop = false,
  onBackToTop,
  backToTopLabel = "Volver arriba",
}: ProfileQuickNavigationProps) {
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    longPressed: boolean;
  } | null>(null);
  const suppressNextClickRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  const cancelLongPress = useCallback(() => {
    clearLongPressTimer();
    pointerGestureRef.current = null;
    setTooltipIndex(null);
  }, [clearLongPressTimer]);

  useEffect(() => {
    const dismissTooltip = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-profile-quick-navigation-item]")) cancelLongPress();
    };
    document.addEventListener("pointerdown", dismissTooltip, true);
    return () => {
      document.removeEventListener("pointerdown", dismissTooltip, true);
      clearLongPressTimer();
    };
  }, [cancelLongPress, clearLongPressTimer]);

  const startLongPress = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (event.pointerType === "mouse" || !event.isPrimary) return;
    cancelLongPress();
    suppressNextClickRef.current = false;
    pointerGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      longPressed: false,
    };
    longPressTimerRef.current = setTimeout(() => {
      const gesture = pointerGestureRef.current;
      if (!gesture || gesture.moved) return;
      gesture.longPressed = true;
      setTooltipIndex(index);
      longPressTimerRef.current = null;
    }, LONG_PRESS_DELAY);
  };

  const trackLongPress = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) <= LONG_PRESS_MOVE_THRESHOLD) return;
    gesture.moved = true;
    suppressNextClickRef.current = true;
    clearLongPressTimer();
    setTooltipIndex(null);
  };

  const finishLongPress = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    suppressNextClickRef.current = gesture.moved || gesture.longPressed;
    cancelLongPress();
  };

  return (
    <nav aria-label={ariaLabel} className={`profile-quick-navigation fixed inset-x-4 z-[60] xl:hidden bottom-[calc(0.5rem+env(safe-area-inset-bottom))] transition-transform duration-300 ease-out motion-reduce:transition-none ${visible || forceVisible ? "translate-y-0" : "pointer-events-none translate-y-[calc(100%+2rem+env(safe-area-inset-bottom))]"}`}>
      {showBackToTop && onBackToTop ? (
        <button type="button" aria-label={backToTopLabel} onClick={onBackToTop} className="absolute bottom-[calc(100%+0.35rem)] left-1/2 flex h-7 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-white/10 bg-zinc-950/65 text-sm text-white/60 shadow-lg backdrop-blur transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
          ↑
        </button>
      ) : null}
      <div className="overflow-visible rounded-full border border-white/15 bg-zinc-950/85 px-2 py-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="w-full touch-pan-x touch-pan-y overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-full min-w-[264px] justify-between">
          {items.map((item, index) => (
            <button key={item.label} type="button" aria-label={item.label} title={item.label}
              data-profile-quick-navigation-item
              data-tour-mobile={item.tourTarget}
              className="relative flex h-11 min-h-11 min-w-11 flex-1 shrink-0 items-center justify-center rounded-full text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-300"
              onClick={() => {
                if (suppressNextClickRef.current) {
                  suppressNextClickRef.current = false;
                  return;
                }
                setTooltipIndex(null);
                item.onNavigate();
              }}
              onPointerDown={(event) => startLongPress(event, index)}
              onPointerMove={trackLongPress}
              onPointerUp={finishLongPress}
              onPointerCancel={cancelLongPress}
              onPointerLeave={trackLongPress}
            >
              {tooltipIndex === index ? (
                <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+0.65rem)] left-1/2 z-20 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-center text-xs font-medium text-white shadow-xl">
                  {item.label}
                </span>
              ) : null}
              {item.icon}
              {index === 1 && pendingFriendRequestsCount > 0 ? (
                <span className="pointer-events-none absolute right-1 top-0 z-10 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-400 px-1 text-[10px] font-bold leading-none text-zinc-950 shadow-[0_6px_18px_rgba(59,130,246,0.35)]">
                  {pendingFriendRequestsCount}
                </span>
              ) : null}
            </button>
          ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
