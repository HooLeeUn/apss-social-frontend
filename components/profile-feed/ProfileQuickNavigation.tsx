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
}

const MOVE_THRESHOLD = 10;
const LONG_PRESS_DELAY = 500;
const PROGRAMMATIC_SCROLL_SETTLE_DELAY = 180;
const PROGRAMMATIC_SCROLL_MAX_DELAY = 3000;
const PROFILE_FEED_SELECTOR = ".profile-feed-mobile-framing";
const INTERACTIVE_TARGET_SELECTOR = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "summary",
  "label",
  "[role='button']",
  "[role='link']",
  "[href]",
  "[contenteditable='true']",
  "[data-interactive='true']",
  "[tabindex]:not([tabindex='-1'])",
  "[class*='cursor-pointer']",
].join(",");

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
    <img src="/icons/Ticket.png" alt="" className="pointer-events-none h-7 w-7 object-contain" />
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

export default function ProfileQuickNavigation({ ariaLabel, items, pendingFriendRequestsCount, forceVisible = false }: ProfileQuickNavigationProps) {
  const [visible, setVisible] = useState(true);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const lastScrollY = useRef(0);
  const gesture = useRef<{ pointerId: number; x: number; y: number; moved: boolean; longPressed: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealGesture = useRef<{ pointerId: number; x: number; y: number; cancelled: boolean; triggered: boolean } | null>(null);
  const quickNavigationInProgress = useRef(false);
  const programmaticScrollSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticScrollFallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishQuickNavigation = useCallback(() => {
    quickNavigationInProgress.current = false;
    if (programmaticScrollSettleTimer.current) clearTimeout(programmaticScrollSettleTimer.current);
    if (programmaticScrollFallbackTimer.current) clearTimeout(programmaticScrollFallbackTimer.current);
    programmaticScrollSettleTimer.current = null;
    programmaticScrollFallbackTimer.current = null;
  }, []);

  const navigateAndHide = useCallback((action: () => void) => {
    finishQuickNavigation();
    quickNavigationInProgress.current = true;
    setVisible(false);
    action();
    programmaticScrollFallbackTimer.current = setTimeout(finishQuickNavigation, PROGRAMMATIC_SCROLL_MAX_DELAY);
  }, [finishQuickNavigation]);

  const clearLongPress = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const cancelGesture = useCallback(() => {
    const hadGesture = gesture.current !== null;
    clearLongPress();
    gesture.current = null;
    setTooltipIndex(null);
    if (hadGesture) suppressClick.current = true;
  }, [clearLongPress]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastScrollY.current = Math.max(window.scrollY, 0);
    const onScroll = () => {
      const next = Math.max(window.scrollY, 0);
      const delta = next - lastScrollY.current;
      if (Math.abs(delta) > 0) cancelGesture();
      if (quickNavigationInProgress.current) {
        if (programmaticScrollSettleTimer.current) clearTimeout(programmaticScrollSettleTimer.current);
        programmaticScrollSettleTimer.current = setTimeout(finishQuickNavigation, PROGRAMMATIC_SCROLL_SETTLE_DELAY);
      } else if (next < 80) setVisible(true);
      else if (delta > 8) setVisible(false);
      else if (delta < -8) setVisible(true);
      if (Math.abs(delta) > 8) lastScrollY.current = next;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [cancelGesture, finishQuickNavigation]);

  useEffect(() => () => {
    clearLongPress();
    finishQuickNavigation();
  }, [clearLongPress, finishQuickNavigation]);

  const clearRevealGesture = useCallback(() => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = null;
    revealGesture.current = null;
  }, []);

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 767px)");

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (!mobileViewport.matches || event.pointerType === "mouse" || !event.isPrimary) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(PROFILE_FEED_SELECTOR) || target.closest(INTERACTIVE_TARGET_SELECTOR)) return;

      clearRevealGesture();
      revealGesture.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        cancelled: false,
        triggered: false,
      };
      revealTimer.current = setTimeout(() => {
        const current = revealGesture.current;
        if (!current || current.cancelled || current.triggered) return;
        current.triggered = true;
        setVisible(true);
        revealTimer.current = null;
      }, LONG_PRESS_DELAY);
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const current = revealGesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > MOVE_THRESHOLD) {
        current.cancelled = true;
        clearRevealGesture();
      }
    };

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      if (revealGesture.current?.pointerId === event.pointerId) clearRevealGesture();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerup", handlePointerEnd);
    document.addEventListener("pointercancel", handlePointerEnd);
    document.addEventListener("scroll", clearRevealGesture, { capture: true, passive: true });
    document.addEventListener("visibilitychange", clearRevealGesture);

    return () => {
      clearRevealGesture();
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerEnd);
      document.removeEventListener("pointercancel", handlePointerEnd);
      document.removeEventListener("scroll", clearRevealGesture, true);
      document.removeEventListener("visibilitychange", clearRevealGesture);
    };
  }, [clearRevealGesture]);

  const start = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (event.pointerType === "mouse") return;
    clearLongPress();
    suppressClick.current = false;
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
    if (!current.moved && !current.longPressed) navigateAndHide(action);
  };

  return (
    <nav aria-label={ariaLabel} className={`fixed inset-x-4 z-[60] md:hidden bottom-[calc(1rem+env(safe-area-inset-bottom))] transition-transform duration-300 ease-out motion-reduce:transition-none ${visible || forceVisible ? "translate-y-0" : "pointer-events-none translate-y-[calc(100%+2rem+env(safe-area-inset-bottom))]"}`}>
      {tooltipIndex !== null ? (
        <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+0.65rem)] left-1/2 z-20 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-center text-xs font-medium text-white shadow-xl">
          {items[tooltipIndex]?.label}
        </span>
      ) : null}
      <div className="overflow-visible rounded-full border border-white/15 bg-zinc-950/85 px-2 py-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="w-full touch-pan-x touch-pan-y overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onScroll={cancelGesture}>
          <div className="flex w-full min-w-[264px] justify-between">
          {items.map((item, index) => (
            <button key={item.label} type="button" aria-label={item.label} title={item.label}
              data-tour-mobile={item.tourTarget}
              className="relative flex h-11 min-h-11 min-w-11 flex-1 shrink-0 items-center justify-center rounded-full text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-300"
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                navigateAndHide(item.onNavigate);
              }}
              onPointerDown={(event) => start(event, index)} onPointerMove={move}
              onPointerUp={(event) => finish(event, item.onNavigate)}
              onPointerCancel={cancelGesture}
              onPointerLeave={cancelGesture}
            >
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
