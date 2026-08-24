"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "../../hooks/useI18n";
import { getMyProfile } from "../../lib/profile-feed/adapters";
import { getOnboardingStates, onboardingQueueKey, updateOnboardingState } from "../../lib/onboarding/api";
import { commonTourCopy, getTourDefinitions } from "../../lib/onboarding/tours";
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
    const anchorX = useDesktopPlacement && callout.anchor === "start" ? rect.left + Math.min(rect.width * 0.2, 30) : rect.left + rect.width / 2;
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

function GuidedTour({ tour, initialStep, onStep, onSkip, onFinish }: { tour: TourDefinition; initialStep: number; onStep: (n: number) => void; onSkip: () => void; onFinish: () => void }) {
  const { locale } = useI18n();
  const labels = commonTourCopy(locale);
  const mobile = typeof window !== "undefined" && matchMedia("(max-width: 767px)").matches;
  const available = useMemo(() => typeof document === "undefined" ? tour.steps : tour.steps.filter((step) => !step.optional || document.querySelector(step.target)), [tour]);
  const [index, setIndex] = useState(Math.min(initialStep, Math.max(available.length - 1, 0)));
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [callouts, setCallouts] = useState<CalloutGeometry[]>([]);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ left: 16, top: 16 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lockedCardRef = useRef<HTMLElement | null>(null);
  const hasDedicatedFinalScreen = tour.id === "feed" && !mobile;
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
    const lockToCard = tour.id === "feed" && index >= 5;
    const target = resolveStepElement(step.spotlightTarget ?? step.target, lockToCard);
    if (!target) {
      const timer = window.setTimeout(() => index < available.length - 1 ? setIndex((current) => current + 1) : onFinish(), 0);
      return () => window.clearTimeout(timer);
    }
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const update = () => {
      const targetRect = target.getBoundingClientRect();
      setRect(targetRect);
      const tooltipRect = tooltipRef.current?.getBoundingClientRect();
      setTooltipPosition(chooseTooltipPosition(targetRect, tooltipRect?.width ?? 420, tooltipRect?.height ?? 250));
      setCallouts(buildCalloutGeometries(step.callouts ?? [], (selector) => resolveStepElement(selector, lockToCard), tour.id === "feed" && !mobile));
    };
    const timer = window.setTimeout(update, 350);
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(target);
    if (tooltipRef.current) resizeObserver.observe(tooltipRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.clearTimeout(timer); resizeObserver.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [available.length, index, isFeedFinal, mobile, onFinish, resolveStepElement, step, tour.id]);

  const move = (next: number) => { setCallouts([]); setIndex(next); if (next < available.length) onStep(next); };
  if (isFeedFinal) return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl border border-white/20 bg-zinc-950 p-6 shadow-2xl"><h2 className="text-xl font-bold">{tour.finalTitle}</h2><p className="mt-3 text-zinc-300">{tour.finalBody}</p><div className="mt-6 flex justify-between"><button type="button" onClick={() => move(available.length - 1)} className="rounded-full border border-white/25 px-4 py-2 text-sm">{labels.back}</button><button type="button" onClick={onFinish} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold">{labels.finish}</button></div></div></div>;
  if (!step || !rect) return null;
  return <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true">
    <div className="fixed rounded-xl" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: "0 0 0 9999px rgba(0,0,0,.82)", pointerEvents: "none", transition: "left 450ms ease-in-out, top 450ms ease-in-out, width 450ms ease-in-out, height 450ms ease-in-out" }} />
    <div className="fixed inset-0" onClick={(event) => event.preventDefault()} />
    {callouts.map((geometry, calloutIndex) => <TourCallout key={`${step.target}-${calloutIndex}`} geometry={geometry} markerId={`tour-callout-arrow-${index}-${calloutIndex}`} />)}
    <div ref={tooltipRef} className="fixed z-[10004] w-[min(92vw,420px)] rounded-2xl border border-white/20 bg-zinc-950 p-5 shadow-2xl" style={tooltipPosition}>
      <button type="button" aria-label={labels.close} onClick={onSkip} className="absolute right-4 top-3 text-xl">×</button><p className="text-xs text-blue-300">{index + 1} / {available.length}</p><h2 className="mt-1 pr-7 text-lg font-bold">{step.title}</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-300">{mobile && step.mobileBody ? step.mobileBody : step.body}</p>
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
  const handleSkip = useCallback(() => { void closeWithStatus("skipped"); }, [closeWithStatus]);
  const handleFinish = useCallback(() => { void closeWithStatus("completed"); }, [closeWithStatus]);
  const handleStart = useCallback(() => { if (state?.status === "pending") void persist("in_progress", 0); setRunning(true); }, [persist, state?.status]);

  if (!tour || !state || !ready || !["pending", "in_progress"].includes(state.status)) return null;
  if (isClosing) return null;
  if (!running) return <TourWelcomeModal title={tour.welcomeTitle} body={tour.welcomeBody} resume={state.status === "in_progress"} onSkip={handleSkip} onStart={handleStart} />;
  return <GuidedTour tour={tour} initialStep={state.currentStep ?? 0} onStep={handleStep} onSkip={handleSkip} onFinish={handleFinish} />;
}
