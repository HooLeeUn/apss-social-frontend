"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "../../hooks/useI18n";
import { getMyProfile } from "../../lib/profile-feed/adapters";
import { getOnboardingStates, onboardingQueueKey, updateOnboardingState } from "../../lib/onboarding/api";
import { commonTourCopy, getTourDefinitions } from "../../lib/onboarding/tours";
import { onboardingPrepareStepEventName } from "../../lib/onboarding/types";
import type { OnboardingState, OnboardingStatus, TourDefinition, TourStepDefinition } from "../../lib/onboarding/types";

type PendingUpdate = { status: OnboardingStatus; currentStep: number | null };
type TooltipPosition = { left: number; top: number };
type CalloutPlacement = "top" | "bottom" | "left" | "right";
type CalloutGeometry = {
  rect: DOMRect;
  label?: string;
  placement: CalloutPlacement;
  anchorX: number;
  labelBox: { left: number; top: number; width: number; height: number } | null;
};
const FEED_CARD_SELECTOR = '[data-tour="feed-card"]';

function TourWelcomeModal({ title, body, resume, onSkip, onStart }: { title: string; body: string; resume: boolean; onSkip: () => void; onStart: () => void }) {
  const { locale } = useI18n();
  const labels = commonTourCopy(locale);
  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="tour-welcome-title">
    <div className="relative w-full max-w-md rounded-2xl border border-white/20 bg-zinc-950 p-6 shadow-2xl">
      <button type="button" aria-label={labels.close} onClick={onSkip} className="absolute right-4 top-3 text-xl text-zinc-300">×</button>
      <h2 id="tour-welcome-title" className="pr-8 text-xl font-bold text-white">{resume ? labels.resumeTitle : title}</h2>
      <p className="mt-3 leading-6 text-zinc-300">{resume ? labels.resumeBody : body}</p>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onSkip} className="rounded-full border border-white/25 px-4 py-2 text-sm">{labels.skip}</button><button type="button" onClick={onStart} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white">{resume ? labels.continue : labels.start}</button></div>
    </div>
  </div>;
}

function isVisible(element: Element): element is HTMLElement {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function chooseTooltipPosition(target: DOMRect, width: number, height: number): TooltipPosition {
  const margin = 16;
  const gap = 18;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spaces = {
    right: viewportWidth - target.right,
    left: target.left,
    bottom: viewportHeight - target.bottom,
    top: target.top,
  };
  const order: Array<keyof typeof spaces> = ["right", "left", "bottom", "top"];
  order.sort((a, b) => spaces[b] - spaces[a]);
  const side = order.find((candidate) => spaces[candidate] >= (candidate === "left" || candidate === "right" ? width : height) + gap) ?? order[0];
  let left = target.left + target.width / 2 - width / 2;
  let top = target.bottom + gap;
  if (side === "right") { left = target.right + gap; top = target.top + target.height / 2 - height / 2; }
  if (side === "left") { left = target.left - width - gap; top = target.top + target.height / 2 - height / 2; }
  if (side === "top") top = target.top - height - gap;
  return {
    left: Math.min(Math.max(margin, left), Math.max(margin, viewportWidth - width - margin)),
    top: Math.min(Math.max(margin, top), Math.max(margin, viewportHeight - height - margin)),
  };
}

function resolveVisible(selector: string, root: ParentNode = document): HTMLElement | null {
  return [...root.querySelectorAll(selector)].find(isVisible) ?? null;
}

function measureSpotlightRect(target: HTMLElement, selector: string, tourId: TourDefinition["id"], mobile: boolean): DOMRect {
  const targetRect = target.getBoundingClientRect();
  if (tourId !== "detail_movie" || mobile || selector !== '[data-tour-desktop="detail-info"]') return targetRect;
  const poster = resolveVisible('[data-tour-desktop="detail-trailer"]');
  if (!poster) return targetRect;
  const posterRect = poster.getBoundingClientRect();
  const left = Math.min(posterRect.left, targetRect.left);
  const top = Math.min(posterRect.top, targetRect.top);
  const right = Math.max(posterRect.right, targetRect.right);
  const bottom = Math.max(posterRect.bottom, targetRect.bottom);
  return new DOMRect(left, top, right - left, bottom - top);
}

function boxesOverlap(left: NonNullable<CalloutGeometry["labelBox"]>, right: NonNullable<CalloutGeometry["labelBox"]>) {
  return left.left < right.left + right.width && left.left + left.width > right.left && left.top < right.top + right.height && left.top + left.height > right.top;
}

function buildCalloutGeometries(callouts: NonNullable<TourStepDefinition["callouts"]>, resolve: (selector: string) => HTMLElement | null, useDesktopPlacement: boolean): CalloutGeometry[] {
  const margin = 8;
  const placedBoxes: NonNullable<CalloutGeometry["labelBox"]>[] = [];
  return callouts.flatMap<CalloutGeometry>((callout, index) => {
    const element = resolve(callout.target);
    if (!element) return [];
    const rect = element.getBoundingClientRect();
    const placement = useDesktopPlacement ? (callout.placement ?? "top") : "top";
    const anchorX = callout.anchor === "start" ? rect.left + Math.min(rect.width * 0.2, 30) : rect.left + rect.width / 2;
    if (!callout.label) return [{ rect, label: undefined, placement, anchorX, labelBox: null }];
    const width = Math.min(128, Math.max(54, callout.label.length * 7 + 18));
    const height = 26;
    let left = anchorX - width / 2;
    let top = placement === "bottom" ? rect.bottom + 28 : rect.top - height - 28;
    if (placement === "left") { left = rect.left - width - 28; top = rect.top + rect.height / 2 - height / 2; }
    if (placement === "right") { left = rect.right + 28; top = rect.top + rect.height / 2 - height / 2; }
    let box = { left: Math.min(Math.max(margin, left), window.innerWidth - width - margin), top: Math.min(Math.max(margin, top), window.innerHeight - height - margin), width, height };
    let attempts = 0;
    while (placedBoxes.some((placed) => boxesOverlap(box, placed)) && attempts < 6) {
      const direction = index % 2 === 0 ? -1 : 1;
      box = { ...box, top: Math.min(Math.max(margin, box.top + direction * (height + 8)), window.innerHeight - height - margin) };
      attempts += 1;
    }
    placedBoxes.push(box);
    return [{ rect, label: callout.label, placement, anchorX, labelBox: box }];
  });
}

function TourCallout({ geometry, markerId }: { geometry: CalloutGeometry; markerId: string }) {
  const { rect, label, placement, anchorX, labelBox } = geometry;
  if (!label || !labelBox) return <div className="pointer-events-none fixed z-[10003] -translate-x-1/2 text-blue-300" style={{ left: anchorX, top: Math.max(6, rect.top - 28) }}><svg aria-hidden="true" width="20" height="24" viewBox="0 0 20 24" fill="none" className="drop-shadow-[0_2px_4px_rgba(0,0,0,.8)]"><path d="M10 1v18M4 13l6 7 6-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>;
  const targetY = placement === "bottom" ? rect.bottom : placement === "top" ? rect.top : rect.top + rect.height / 2;
  const startX = placement === "left" ? labelBox.left + labelBox.width : placement === "right" ? labelBox.left : labelBox.left + labelBox.width / 2;
  const startY = placement === "bottom" ? labelBox.top : placement === "top" ? labelBox.top + labelBox.height : labelBox.top + labelBox.height / 2;
  const bendY = startY + (targetY - startY) * 0.55;
  return <>
    <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-[10002] h-full w-full overflow-visible text-blue-300"><defs><marker id={markerId} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7z" fill="currentColor" /></marker></defs><path d={`M ${startX} ${startY} Q ${startX} ${bendY} ${anchorX} ${targetY}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" markerEnd={`url(#${markerId})`} /></svg>
    <span className="pointer-events-none fixed z-[10003] whitespace-nowrap rounded-full border border-blue-300/70 bg-blue-950/95 px-2 py-1 text-center text-[11px] font-semibold text-blue-300 shadow-lg" style={{ left: labelBox.left, top: labelBox.top, width: labelBox.width }}>{label}</span>
  </>;
}

function TourStepIcon({ icon }: { icon: NonNullable<TourStepDefinition["icon"]> }) {
  const commonProps = { "aria-hidden": true, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, className: "h-5 w-5 shrink-0 text-blue-300" } as const;
  if (icon === "search") return <svg {...commonProps}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" strokeLinecap="round" /></svg>;
  if (icon === "filter") return <svg {...commonProps}><path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" strokeLinejoin="round" /></svg>;
  if (icon === "profile") return <svg {...commonProps}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" /></svg>;
  if (icon === "notifications") return <svg {...commonProps}><path d="M6 17h12l-2-3V9a4 4 0 0 0-8 0v5l-2 3Z" strokeLinejoin="round" /><path d="M10 20h4" strokeLinecap="round" /></svg>;
  if (icon === "menu") return <svg {...commonProps}><path d="M4 8h16v11H4zM4 8l3-4h4L8 8m3 0 3-4h4l-3 4" strokeLinejoin="round" /><path d="m10 12 5 2.5-5 2.5v-5Z" strokeLinejoin="round" /></svg>;
  if (icon === "productions") return <svg {...commonProps}><circle cx="9" cy="12" r="6" /><circle cx="9" cy="12" r="2" /><path d="M15 12h6v6h-9" strokeLinecap="round" strokeLinejoin="round" /><circle cx="7" cy="9" r=".7" fill="currentColor" stroke="none" /><circle cx="11" cy="10" r=".7" fill="currentColor" stroke="none" /><circle cx="10" cy="14" r=".7" fill="currentColor" stroke="none" /></svg>;
  if (icon === "favorite") return <svg {...commonProps}><path d="M20 8.5c0 5-8 10-8 10s-8-5-8-10a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8Z" strokeLinejoin="round" /></svg>;
  if (icon === "connections") return <svg {...commonProps}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M14 15c3.5-.7 5.7 1 6.5 4" strokeLinecap="round" /></svg>;
  if (icon === "activity") return <svg {...commonProps}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
  if (icon === "inbox") return <svg {...commonProps}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" strokeLinejoin="round" /></svg>;
  if (icon === "ratings") return <svg {...commonProps}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" strokeLinejoin="round" /></svg>;
  if (icon === "list") return <svg {...commonProps}><path d="M4 4h11l5 5-10 11-6-6V4Z" strokeLinejoin="round" /><circle cx="9" cy="9" r="1.5" /></svg>;
  if (icon === "recommendations") return <svg {...commonProps}><path d="M4 6h16l-2 13H6L4 6Z" strokeLinejoin="round" /><path d="m7 6 2-3h6l2 3M8 11h8M9 15h6" strokeLinecap="round" /></svg>;
  if (icon === "information") return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M12 10v7M12 7h.01" strokeLinecap="round" /></svg>;
  if (icon === "play") return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" strokeLinejoin="round" /></svg>;
  if (icon === "video") return <svg {...commonProps}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" strokeLinejoin="round" /></svg>;
  if (icon === "rec") return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></svg>;
  if (icon === "conversation" || icon === "comments") return <svg {...commonProps}><path d="M4 5h16v11H9l-5 4V5Z" strokeLinejoin="round" />{icon === "comments" ? <path d="M8 9h8M8 12h5" strokeLinecap="round" /> : null}</svg>;
  return <svg {...commonProps}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" strokeLinejoin="round" /><path d="m15 16 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function GuidedTour({ tour, initialStep, onStep, onSkip, onFinish }: { tour: TourDefinition; initialStep: number; onStep: (n: number) => void; onSkip: () => void; onFinish: () => void }) {
  const { locale } = useI18n();
  const labels = commonTourCopy(locale);
  const mobile = typeof window !== "undefined" && matchMedia(tour.id === "feed" ? "(max-width: 1023px)" : "(max-width: 767px)").matches;
  const sourceSteps = mobile && tour.mobileSteps ? tour.mobileSteps : !mobile && tour.desktopSteps ? tour.desktopSteps : tour.steps;
  const available = useMemo(() => typeof document === "undefined" ? sourceSteps : sourceSteps.filter((step) => !step.optional || document.querySelector(step.target)), [sourceSteps]);
  const [index, setIndex] = useState(Math.min(initialStep, Math.max(available.length - 1, 0)));
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [callouts, setCallouts] = useState<CalloutGeometry[]>([]);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ left: 16, top: 16 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lockedCardRef = useRef<HTMLElement | null>(null);
  const initialSpotlightRevealedRef = useRef(false);
  const initialRevealFrameRef = useRef<number | null>(null);
  const [initialSpotlightVisible, setInitialSpotlightVisible] = useState(false);
  const hasDedicatedFinalScreen = tour.id === "feed" || (tour.id === "detail_movie" && !mobile);
  const isFeedFinal = hasDedicatedFinalScreen && index === available.length;
  const step = available[index] as TourStepDefinition | undefined;

  const resolveStepElement = useCallback((selector: string, lockToCard: boolean) => {
    if (!lockToCard) return resolveVisible(selector);
    if (!lockedCardRef.current?.isConnected || !isVisible(lockedCardRef.current)) lockedCardRef.current = resolveVisible(FEED_CARD_SELECTOR);
    if (!lockedCardRef.current) return null;
    if (selector === FEED_CARD_SELECTOR) return lockedCardRef.current;
    return resolveVisible(selector, lockedCardRef.current);
  }, []);

  useEffect(() => {
    if (!step || isFeedFinal) return;
    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    let retryFrame = 0;
    let targetRetries = 0;
    let timer = 0;
    let resizeObserver: ResizeObserver | null = null;
    let update: (() => void) | null = null;
    const lockToCard = tour.id === "feed" && index >= 5;
    const setupTarget = () => {
      if (cancelled) return;
      const target = resolveStepElement(step.spotlightTarget ?? step.target, lockToCard);
      if (!target) {
        if (mobile && tour.id === "profile_feed") {
          if (targetRetries < 12) { targetRetries += 1; retryFrame = window.requestAnimationFrame(setupTarget); }
          else console.error(`Onboarding target not found after preparation: ${step.target}`);
          return;
        }
        timer = window.setTimeout(() => index < available.length - 1 ? setIndex((current) => current + 1) : onFinish(), 0);
        return;
      }
      if (mobile && tour.id === "feed" && lockToCard) {
        const targetRect = target.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportTop = viewport?.offsetTop ?? 0;
        const viewportHeight = viewport?.height ?? window.innerHeight;
        const safeAreaProbe = document.createElement("div");
        safeAreaProbe.style.cssText = "position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom)";
        document.body.appendChild(safeAreaProbe);
        const safeAreaBottom = Number.parseFloat(window.getComputedStyle(safeAreaProbe).paddingBottom) || 0;
        safeAreaProbe.remove();
        const bottomMargin = Math.max(72, viewportHeight * 0.1) + safeAreaBottom;
        const desiredTop = viewportTop + Math.max(12, viewportHeight - targetRect.height - bottomMargin);
        window.scrollBy({ top: targetRect.top - desiredTop, behavior: "smooth" });
      } else if (mobile && tour.id === "profile_feed" && step.mobileScroll === "below-tooltip") {
        const targetRect = target.getBoundingClientRect();
        const viewportTop = window.visualViewport?.offsetTop ?? 0;
        const tooltipHeight = tooltipRef.current?.getBoundingClientRect().height ?? 250;
        window.scrollBy({ top: targetRect.top - (viewportTop + tooltipHeight + 36), behavior: "smooth" });
      } else {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
      update = () => {
        const targetRect = measureSpotlightRect(target, step.spotlightTarget ?? step.target, tour.id, mobile);
        setRect(targetRect);
        if ((tour.id === "feed" || tour.id === "profile_feed" || !mobile && tour.id === "detail_movie") && index === 0 && !initialSpotlightRevealedRef.current) {
          initialSpotlightRevealedRef.current = true;
          setInitialSpotlightVisible(false);
          initialRevealFrameRef.current = window.requestAnimationFrame(() => setInitialSpotlightVisible(true));
        }
        const tooltipRect = tooltipRef.current?.getBoundingClientRect();
        const fixedMobileTooltip = mobile && (tour.id === "feed" && lockToCard || tour.id === "profile_feed" && step.mobileScroll === "below-tooltip");
        setTooltipPosition(fixedMobileTooltip ? { left: 16, top: (window.visualViewport?.offsetTop ?? 0) + 12 } : chooseTooltipPosition(targetRect, tooltipRect?.width ?? 420, tooltipRect?.height ?? 250));
        setCallouts(buildCalloutGeometries(step.callouts ?? [], (selector) => resolveStepElement(selector, lockToCard), tour.id === "feed" || mobile && tour.id === "profile_feed"));
      };
      timer = window.setTimeout(update, 350);
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(target);
      if (tour.id === "detail_movie" && !mobile && step.target === '[data-tour-desktop="detail-info"]') {
        const poster = resolveVisible('[data-tour-desktop="detail-trailer"]');
        if (poster) resizeObserver.observe(poster);
      }
      if (tooltipRef.current) resizeObserver.observe(tooltipRef.current);
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, true);
    };
    const prepareAction = mobile ? step.mobilePrepare : step.prepare;
    if (prepareAction) {
      window.dispatchEvent(new CustomEvent(onboardingPrepareStepEventName, { detail: { action: prepareAction } }));
      firstFrame = window.requestAnimationFrame(() => { secondFrame = window.requestAnimationFrame(setupTarget); });
    } else setupTarget();
    return () => { cancelled = true; window.clearTimeout(timer); window.cancelAnimationFrame(firstFrame); window.cancelAnimationFrame(secondFrame); window.cancelAnimationFrame(retryFrame); if (initialRevealFrameRef.current !== null) window.cancelAnimationFrame(initialRevealFrameRef.current); resizeObserver?.disconnect(); if (update) { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); } };
  }, [available.length, index, isFeedFinal, mobile, onFinish, resolveStepElement, step, tour.id]);

  const move = (next: number) => { setCallouts([]); setIndex(next); if (next < available.length) onStep(next); };
  if (isFeedFinal) return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl border border-white/20 bg-zinc-950 p-6 shadow-2xl"><h2 className="text-xl font-bold">{tour.finalTitle}</h2><p className="mt-3 text-zinc-300">{tour.finalBody}</p><div className="mt-6 flex justify-between"><button type="button" onClick={() => move(available.length - 1)} className="rounded-full border border-white/25 px-4 py-2 text-sm">{labels.back}</button><button type="button" onClick={onFinish} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold">{labels.finish}</button></div></div></div>;
  if (!step || !rect) return null;
  const isInitialFeedSpotlight = (tour.id === "feed" || tour.id === "profile_feed" || !mobile && tour.id === "detail_movie") && index === 0;
  return <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true">
    <div className="fixed rounded-xl" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12, backgroundColor: isInitialFeedSpotlight && !initialSpotlightVisible ? "rgba(0,0,0,.82)" : "rgba(0,0,0,0)", boxShadow: "0 0 0 9999px rgba(0,0,0,.82)", pointerEvents: "none", transition: "left 450ms ease-in-out, top 450ms ease-in-out, width 450ms ease-in-out, height 450ms ease-in-out, background-color 420ms ease-out" }} />
    <div className="fixed inset-0" onClick={(event) => event.preventDefault()} />
    {callouts.map((geometry, calloutIndex) => <TourCallout key={`${step.target}-${calloutIndex}`} geometry={geometry} markerId={`tour-callout-arrow-${index}-${calloutIndex}`} />)}
    <div ref={tooltipRef} className="fixed z-[10004] w-[min(92vw,420px)] rounded-2xl border border-white/20 bg-zinc-950 p-5 shadow-2xl" style={tooltipPosition}>
      <button type="button" aria-label={labels.close} onClick={onSkip} className="absolute right-4 top-3 text-xl">×</button><p className="text-xs text-blue-300">{index + 1} / {available.length}</p><div className="mt-1 flex items-center gap-2 pr-7">{(!mobile || tour.id === "feed" || tour.id === "profile_feed") && step.icon ? <TourStepIcon icon={step.icon} /> : null}<h2 className="text-lg font-bold">{step.title}</h2></div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-300">{mobile && step.mobileBody ? step.mobileBody : step.body}</p>
      <div className="mt-5 flex justify-between"><button type="button" disabled={index === 0} onClick={() => move(index - 1)} className="rounded-full border border-white/25 px-4 py-2 text-sm disabled:invisible">{labels.back}</button><button type="button" onClick={() => index === available.length - 1 && !hasDedicatedFinalScreen ? onFinish() : move(index + 1)} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold">{index === available.length - 1 && !hasDedicatedFinalScreen ? labels.finish : labels.next}</button></div>
    </div>
  </div>;
}

export default function OnboardingProvider() {
  const pathname = usePathname();
  const { locale } = useI18n();
  const definitions = useMemo(() => getTourDefinitions(locale), [locale]);
  const tour = definitions.find((item) => item.path(pathname));
  const tourId = tour?.id;
  const [state, setState] = useState<OnboardingState | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const persist = useCallback(async (status: OnboardingStatus, currentStep: number | null) => {
    if (!tourId || !state || !user) return;
    const key = onboardingQueueKey(user, tourId, state.version);
    const value: PendingUpdate = { status, currentStep };
    try { await updateOnboardingState(tourId, status, currentStep, state.version); localStorage.removeItem(key); }
    catch (error) { console.error("[Onboarding] Failed to update tour state; queued for retry.", error); localStorage.setItem(key, JSON.stringify(value)); }
    setState((old) => old ? { ...old, status, currentStep } : old);
  }, [state, tourId, user]);

  useEffect(() => {
    let cancelled = false;
    const reset = window.setTimeout(() => { setState(null); setReady(false); setRunning(false); setIsClosing(false); }, 0);
    if (!tourId) return () => window.clearTimeout(reset);
    Promise.all([getOnboardingStates(), getMyProfile()]).then(([states, profile]) => {
      if (cancelled) return;
      const identity = String(profile?.username || "authenticated");
      setUser(identity);
      const next = states.find((item) => item.tour === tourId) || null;
      setState(next);
      if (next) {
        const key = onboardingQueueKey(identity, tourId, next.version);
        const queued = localStorage.getItem(key);
        if (queued && navigator.onLine) {
          const value = JSON.parse(queued) as PendingUpdate;
          updateOnboardingState(tourId, value.status, value.currentStep, next.version).then(() => localStorage.removeItem(key)).catch((error) => console.error("[Onboarding] Failed to reconcile queued tour state.", error));
        }
      }
    }).catch((error) => console.error("[Onboarding] Failed to load tour state.", error));
    return () => { cancelled = true; window.clearTimeout(reset); };
  }, [pathname, tourId]);

  useEffect(() => {
    if (!tour || !state || !["pending", "in_progress"].includes(state.status)) return;
    const check = () => setReady(tour.readyTargets.every((selector) => document.querySelector(selector)));
    const initialCheck = window.setTimeout(check, 0);
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = window.setTimeout(check, 8000);
    return () => { observer.disconnect(); window.clearTimeout(timeout); window.clearTimeout(initialCheck); };
  }, [state, tour]);

  const handleStep = useCallback((step: number) => { void persist("in_progress", step); }, [persist]);
  const closeWithStatus = useCallback(async (status: "completed" | "skipped") => {
    setIsClosing(true);
    await persist(status, null);
    setRunning(false);
    setIsClosing(false);
  }, [persist]);
  const restoreDetailView = useCallback(() => {
    if (tourId !== "detail_movie" || !window.matchMedia("(min-width: 768px)").matches) return;
    window.dispatchEvent(new CustomEvent(onboardingPrepareStepEventName, { detail: { action: "detail-restore" } }));
  }, [tourId]);
  const restoreFeedMobilePanel = useCallback(() => {
    if (tourId !== "feed" || !window.matchMedia("(max-width: 1023px)").matches) return;
    window.dispatchEvent(new CustomEvent(onboardingPrepareStepEventName, { detail: { action: "feed-mobile-panel-release" } }));
  }, [tourId]);
  const restoreProfileMobileView = useCallback(() => {
    if (tourId !== "profile_feed" || !window.matchMedia("(max-width: 767px)").matches) return;
    window.dispatchEvent(new CustomEvent(onboardingPrepareStepEventName, { detail: { action: "profile-mobile-release" } }));
  }, [tourId]);
  const handleSkip = useCallback(() => {
    void (async () => {
      await closeWithStatus("skipped");
      restoreDetailView();
      restoreFeedMobilePanel();
      restoreProfileMobileView();
    })();
  }, [closeWithStatus, restoreDetailView, restoreFeedMobilePanel, restoreProfileMobileView]);
  const handleFinish = useCallback(() => {
    void (async () => {
      await closeWithStatus("completed");
      restoreDetailView();
      restoreFeedMobilePanel();
      restoreProfileMobileView();
      const shouldResetProfileDesktop = tourId === "profile_feed" && window.matchMedia("(min-width: 768px)").matches;
      const shouldResetProfileMobile = tourId === "profile_feed" && window.matchMedia("(max-width: 767px)").matches;
      const shouldResetFeedMobile = tourId === "feed" && window.matchMedia("(max-width: 1023px)").matches;
      if (shouldResetProfileDesktop || shouldResetProfileMobile || shouldResetFeedMobile) window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    })();
  }, [closeWithStatus, restoreDetailView, restoreFeedMobilePanel, restoreProfileMobileView, tourId]);
  const handleStart = useCallback(() => { if (state?.status === "pending") void persist("in_progress", 0); setRunning(true); }, [persist, state?.status]);

  if (!tour || !state || !ready || !["pending", "in_progress"].includes(state.status)) return null;
  if (isClosing) return null;
  if (!running) return <TourWelcomeModal title={tour.welcomeTitle} body={tour.welcomeBody} resume={state.status === "in_progress"} onSkip={handleSkip} onStart={handleStart} />;
  return <GuidedTour tour={tour} initialStep={state.currentStep ?? 0} onStep={handleStep} onSkip={handleSkip} onFinish={handleFinish} />;
}
