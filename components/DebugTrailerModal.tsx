"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ComponentProps } from "react";
import type { Movie } from "../lib/movies";
import { hasTrailerExternalOnlyFallback } from "../lib/trailerFallbackCache";
import { buildTrailerDebugReport, getFirstTrailerFallbackWrite, getTrailerDebugFallbackReason, getTrailerDebugSnapshot, getTrailerDebugTimeline, prepareTrailerPlayerDiagnostics, recordTrailerDebugEvent, startTrailerDebugTimeline, subscribeTrailerDebugTimeline, TRAILER_DEBUG, trailerDebugLog } from "../lib/trailerDebug";
import TrailerModal from "./TrailerModal";

type Props = ComponentProps<typeof TrailerModal> & {
  movieId?: Movie["id"] | null;
  movieTitle?: string | null;
  interaction: "hover" | "long-press";
};

type ViewState = "loading" | "iframe" | "fallback" | "closed" | "unavailable";

export default function DebugTrailerModal({ movieId = null, movieTitle = null, interaction, ...props }: Props) {
  const firstRender = useRef(true);
  const wasOpen = useRef(false);
  const lastDomState = useRef<ViewState>(props.open ? "loading" : "closed");
  const previousFlags = useRef({ loading: props.loading, error: props.error ?? false, open: props.open });
  const [view, setView] = useState<{ currentState: ViewState; reason: string }>({ currentState: props.open ? "loading" : "closed", reason: "Initial render" });
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const timeline = useSyncExternalStore(subscribeTrailerDebugTimeline, getTrailerDebugTimeline, getTrailerDebugTimeline);
  const snapshot = getTrailerDebugSnapshot(movieId);
  const videoId = snapshot?.videoId ?? null;
  const device = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? "mobile" : "desktop";
  const available = snapshot?.normalizedResponse && typeof snapshot.normalizedResponse === "object" && "available" in snapshot.normalizedResponse
    ? snapshot.normalizedResponse.available
    : Boolean(props.trailerUrl);
  const firstFallbackWrite = getFirstTrailerFallbackWrite();

  useLayoutEffect(() => {
    if (!TRAILER_DEBUG) return;
    prepareTrailerPlayerDiagnostics();
    if (props.open && !wasOpen.current) startTrailerDebugTimeline();
    if (!props.open && wasOpen.current) recordTrailerDebugEvent("Modal closed", "DebugTrailerModal.tsx · modal lifecycle (~line 37)");
    wasOpen.current = props.open;
  }, [props.open]);

  useEffect(() => {
    const previous = previousFlags.current;
    const current = { loading: props.loading, error: props.error ?? false, open: props.open };
    for (const key of ["loading", "error", "open"] as const) {
      const next = current[key];
      if (previous[key] !== next) recordTrailerDebugEvent(`${key}: ${previous[key]} → ${next}`, "DebugTrailerModal.tsx · props observation (~line 42)", key === "error" && next ? "error" : "normal");
    }
    previousFlags.current = current;
  }, [props.error, props.loading, props.open]);

  useEffect(() => {
    trailerDebugLog(firstRender.current ? "TrailerModal first render / initial state" : "TrailerModal render", {
      initialState: firstRender.current ? view : undefined,
      videoId,
      watchUrl: props.watchUrl,
      embedUrl: props.trailerUrl,
      available,
      externalOnly: props.externalOnly ?? false,
      isOpen: props.open,
      loading: props.loading,
      error: props.error ?? false,
      fallback: view.currentState === "fallback",
    });
    firstRender.current = false;
  });

  useEffect(() => {
    if (!TRAILER_DEBUG) return;
    const inspect = () => {
      const dialog = document.querySelector('[role="dialog"][aria-labelledby="trailer-modal-title"]');
      const iframe = dialog?.querySelector("iframe");
      const fallbackLink = Array.from(dialog?.querySelectorAll('a[target="_blank"]') ?? []).find((link) => !dialog?.querySelector("iframe") && link.textContent?.trim());
      let next: { currentState: ViewState; reason: string };
      if (!props.open) next = { currentState: "closed", reason: "Modal isOpen=false" };
      else if (props.loading) next = { currentState: "loading", reason: "loading=true" };
      else if (iframe) next = { currentState: "iframe", reason: "Rendering iframe because the existing TrailerModal rendered an iframe" };
      else if (fallbackLink) {
        const reason = props.externalOnly
          ? "Rendering YouTube fallback because externalOnly=true"
          : props.error
            ? "Rendering YouTube fallback after an existing modal error state"
            : "Rendering YouTube fallback because the existing TrailerModal selected its fallback branch (possible embed error or cached fallback)";
        next = { currentState: "fallback", reason };
      } else next = { currentState: "unavailable", reason: props.error ? "error=true" : props.unavailable ? "unavailable=true" : "No iframe or YouTube fallback rendered" };
      if (lastDomState.current !== next.currentState) {
        const previous = lastDomState.current;
        if (previous === "iframe") recordTrailerDebugEvent("iframe unmounted", "DebugTrailerModal.tsx · MutationObserver.inspect() (~line 79)");
        if (next.currentState === "iframe") recordTrailerDebugEvent("iframe rendered", "DebugTrailerModal.tsx · MutationObserver.inspect() (~line 80)", "positive");
        if (next.currentState === "fallback") {
          let fallback = getTrailerDebugFallbackReason();
          if (!fallback && props.externalOnly) fallback = "Fallback because externalOnly existing condition";
          if (!fallback && props.error) fallback = "Fallback because error state update";
          if (!fallback && props.trailerUrl && hasTrailerExternalOnlyFallback(props.trailerUrl, props.watchUrl)) fallback = "Fallback because cached fallback";
          if (!fallback && timeline.at(-1)?.elapsedMs && timeline.at(-1)!.elapsedMs >= 19_900) {
            recordTrailerDebugEvent("Timeout fired", "TrailerModal.tsx · ready timeout callback (~line 43)", "error");
            fallback = "Fallback because timeout";
          }
          recordTrailerDebugEvent(fallback ?? "Fallback because existing render condition", "DebugTrailerModal.tsx · MutationObserver.inspect() (~line 88)", "fallback");
        }
        recordTrailerDebugEvent(`currentState: ${previous} → ${next.currentState}`, "DebugTrailerModal.tsx · inspect()/setView() (~line 91)", next.currentState === "fallback" ? "fallback" : "normal");
        lastDomState.current = next.currentState;
      }
      setView((previous) => previous.currentState === next.currentState && previous.reason === next.reason ? previous : next);
    };
    inspect();
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => observer.disconnect();
  }, [props.error, props.externalOnly, props.loading, props.open, props.unavailable, props.trailerUrl, props.watchUrl, timeline]);

  useEffect(() => {
    if (!props.open) return;
    const names: Array<[keyof DocumentEventMap, string]> = [["touchstart", "TouchStart"], ["touchend", "TouchEnd"], ["pointerdown", "PointerDown"], ["pointerup", "PointerUp"], ["pointercancel", "PointerCancel"]];
    const removers = names.map(([name, label]) => {
      const handler = () => recordTrailerDebugEvent(label, "DebugTrailerModal.tsx · document capture listener (~line 108)");
      document.addEventListener(name, handler, { capture: true, passive: true });
      return () => document.removeEventListener(name, handler, { capture: true });
    });
    return () => removers.forEach((remove) => remove());
  }, [props.open]);

  useEffect(() => {
    trailerDebugLog("TrailerModal state changed / render decision", { ...view, interaction, device });
  }, [device, interaction, view]);

  const panelColor = view.currentState === "loading" ? "#a16207" : view.currentState === "iframe" ? "#166534" : "#991b1b";
  const reportGeneral = { movie: movieTitle ?? snapshot?.title ?? movieId, movieId, videoId, available, externalOnly: props.externalOnly ?? false, watchUrl: props.watchUrl, embedUrl: props.trailerUrl, interaction, device, currentState: view.currentState };
  const copyDebugReport = async () => {
    const report = buildTrailerDebugReport(reportGeneral);
    try {
      await navigator.clipboard.writeText(report);
      setCopyFallback(null);
    } catch {
      setCopyFallback(report);
    }
  };

  return (
    <>
      <TrailerModal {...props} diagnosticContext={{ movieId, videoId, available, interaction, device }} />
      {TRAILER_DEBUG && (props.open || props.loading) ? (
        <aside style={{ position: "fixed", right: 8, bottom: 8, zIndex: 2147483647, width: "min(320px, calc(100vw - 16px))", height: "min(45vh, 420px)", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid white", borderRadius: 8, background: panelColor, color: "white", padding: 10, font: "10px/1.3 monospace", overflowWrap: "anywhere", boxShadow: "0 4px 20px #000" }} aria-label="Trailer debug overlay">
          <strong>TRAILER DEBUG</strong><br />
          <div style={{ flex: "0 0 auto", marginBottom: 6, border: "2px solid #fef08a", background: "rgba(0,0,0,.55)", padding: 5, color: "#fef08a" }}>
            <strong>FIRST FALLBACK WRITE</strong><br />
            {firstFallbackWrite ? <>
              time: {firstFallbackWrite.elapsedMs} ms<br />file: {firstFallbackWrite.sourceFile}<br />function: {firstFallbackWrite.sourceFunction}<br />
              previousState: {String(firstFallbackWrite.previousState)}<br />nextState: {String(firstFallbackWrite.requestedState)}<br />reason: {firstFallbackWrite.reason}<br />
              cache value: {String(firstFallbackWrite.cachedFallbackValue)}<br />error code: {String(firstFallbackWrite.errorCode)}<br />videoId: {String(firstFallbackWrite.videoId)}
            </> : "None captured"}
          </div>
          <button type="button" onClick={() => void copyDebugReport()} style={{ flex: "0 0 auto", marginBottom: 5, border: "1px solid white", borderRadius: 4, background: "#111", padding: "4px 6px", color: "white", fontWeight: 700 }}>COPY DEBUG REPORT</button>
          {copyFallback ? <textarea readOnly value={copyFallback} onFocus={(event) => event.currentTarget.select()} aria-label="Selectable trailer debug report" style={{ flex: "0 0 70px", width: "100%", resize: "none", background: "#111", color: "white", font: "9px monospace" }} /> : null}
          <div style={{ minHeight: 0, overflowY: "auto" }}>
          Movie: {movieTitle ?? snapshot?.title ?? String(movieId ?? "null")}<br />
          videoId: {String(videoId)}<br />
          available: {String(available)}<br />
          externalOnly: {String(props.externalOnly ?? false)}<br />
          watchUrl: {String(props.watchUrl)}<br />
          embedUrl: {String(props.trailerUrl)}<br />
          reason: {view.reason}<br />
          currentState: {view.currentState}<br />
          interaction: {interaction}<br />
          device: {device}
          <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,.55)", paddingTop: 7 }}>
            <strong>EVENT TIMELINE</strong>
            <div style={{ marginTop: 5, background: "rgba(0,0,0,.35)", padding: 5 }}>
              {timeline.map((event) => (
                <div key={event.id} style={{ marginBottom: 6, color: event.level === "positive" ? "#86efac" : event.level === "warning" ? "#fde047" : event.level === "error" ? "#fca5a5" : event.level === "fallback" ? "#ff5252" : "#d4d4d8" }}>
                  <strong>{event.elapsedMs} ms</strong><br />
                  {event.label}<br />
                  <span style={{ opacity: .8 }}>{event.source}</span>
                </div>
              ))}
            </div>
          </div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
