// Minimum supported usable portrait viewport for normal mobile Detail.
export const DETAIL_VIDEO_REFERENCE = { width: 320, height: 640 } as const;

// Temporary diagnostics. Staging builds must explicitly identify their environment.
const diagnosticsEnabled = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_APP_ENV === "staging";
let diagnosticSequence = 0;
const diagnosticIds = new WeakMap<object, string>();

export function detailVideoDiagnosticId(owner?: object) {
  if (!diagnosticsEnabled) return "";
  if (owner) {
    const existing = diagnosticIds.get(owner);
    if (existing) return existing;
  }
  const id = `detail-video-${++diagnosticSequence}`;
  if (owner) diagnosticIds.set(owner, id);
  return id;
}

export function logDetailVideoCalibration(event: string, snapshot: () => Record<string, unknown>) {
  if (!diagnosticsEnabled) return;
  // Serialize now: DevTools must not display a later, mutated object value.
  // Diagnostic failures must never affect the measurement or saved geometry.
  try {
    console.info("[detail-video-calibration]", JSON.stringify({ timestamp: new Date().toISOString(), event, ...snapshot() }));
  } catch { /* Diagnostics only. */ }
}

export function fitReferenceVideo(width: number, height: number) {
  const videoWidth = Math.max(0, Math.min(width, height * 9 / 16));
  return { width: videoWidth, height: videoWidth * 16 / 9 };
}

export async function measureDetailVideoReference(root: HTMLElement, calibrationId = detailVideoDiagnosticId()) {
  logDetailVideoCalibration("measure-start", () => ({
    calibrationId,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    visualViewportWidth: window.visualViewport?.width ?? null,
    visualViewportHeight: window.visualViewport?.height ?? null,
    referenceWidth: DETAIL_VIDEO_REFERENCE.width,
    referenceHeight: DETAIL_VIDEO_REFERENCE.height,
  }));
  const source = root.closest<HTMLElement>("[data-mobile-detail-layout]");
  if (!source) {
    logDetailVideoCalibration("measure-unavailable", () => ({ calibrationId, reason: "missing-source" }));
    return null;
  }
  const frame = document.createElement("iframe");
  frame.title = "";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${DETAIL_VIDEO_REFERENCE.width}px;height:${DETAIL_VIDEO_REFERENCE.height}px;visibility:hidden;pointer-events:none;border:0`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) {
      logDetailVideoCalibration("measure-unavailable", () => ({ calibrationId, reason: "missing-reference-document" }));
      return null;
    }
    doc.open();
    doc.write("<!doctype html><html><head></head><body></body></html>");
    doc.close();
    // Resolve vw, dvh, media queries and wrapping in the reference viewport.
    const stylesReady: Promise<void>[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const style = doc.createElement("style");
        const css = Array.from(sheet.cssRules, rule => rule.cssText).join("\n").replace(
          /url\(\s*(['"]?)(.*?)\1\s*\)/g,
          (original, _quote, url: string) => url.startsWith("#") ? original : `url(${JSON.stringify(new URL(url, sheet.href ?? document.baseURI).href)})`,
        );
        style.textContent = sheet.media.mediaText ? `@media ${sheet.media.mediaText} {${css}}` : css;
        doc.head.appendChild(style);
      } catch {
        // Cross-origin stylesheet rules are not readable; load that stylesheet
        // normally in the isolated document and wait before measuring.
        if (!sheet.href) throw new Error("Cannot read reference layout styles");
        stylesReady.push(new Promise((resolve, reject) => {
          const link = doc.createElement("link");
          link.rel = "stylesheet";
          link.href = sheet.href!;
          link.onload = () => resolve();
          link.onerror = () => reject(new Error("Cannot load reference layout styles"));
          doc.head.appendChild(link);
        }));
      }
    }
    doc.documentElement.lang = document.documentElement.lang;
    doc.documentElement.className = document.documentElement.className;
    doc.body.className = document.body.className;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script,iframe,[role=dialog]").forEach(node => node.remove());
    clone.querySelectorAll("img").forEach(img => {
      img.removeAttribute("srcset");
      img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    });
    const first = clone.querySelector<HTMLVideoElement>("[data-video-comment-player]");
    const marker = first?.parentElement;
    if (!marker) {
      logDetailVideoCalibration("measure-unavailable", () => ({ calibrationId, reason: "missing-marker" }));
      return null;
    }
    // Measure only preceding content, with no previous video size or lock.
    marker.replaceChildren();
    marker.style.cssText = "width:0;height:0;flex-shrink:0";
    clone.querySelectorAll("video,audio,source").forEach(node => node.remove());
    doc.body.appendChild(clone);
    await Promise.all(stylesReady);
    marker.getBoundingClientRect(); // Start font loading for the laid-out clone.
    await doc.fonts.ready;
    const safe = doc.createElement("div");
    safe.style.paddingBottom = "env(safe-area-inset-bottom)";
    doc.body.appendChild(safe);
    const safeBottom = parseFloat(frame.contentWindow!.getComputedStyle(safe).paddingBottom) || 0;
    const availableWidth = marker.parentElement!.clientWidth;
    const markerRect = marker.getBoundingClientRect();
    const availableHeight = DETAIL_VIDEO_REFERENCE.height - markerRect.top - safeBottom - 12;
    logDetailVideoCalibration("reference-measured", () => ({
      calibrationId,
      referenceDocumentWidth: doc.documentElement.clientWidth,
      referenceDocumentHeight: doc.documentElement.clientHeight,
      referenceWindowWidth: frame.contentWindow?.innerWidth,
      referenceWindowHeight: frame.contentWindow?.innerHeight,
      markerTop: markerRect.top,
      markerWidth: markerRect.width,
      markerHeight: markerRect.height,
      markerParentClientWidth: availableWidth,
      availableHeight,
      safeBottom,
      limitingAxis: availableWidth <= availableHeight * 9 / 16 ? "width" : "height",
      referenceBodyClass: doc.body.className,
    }));
    if (availableWidth <= 0 || availableHeight <= 0) throw new Error("Reference viewport leaves no space for a reaction video");
    const result = fitReferenceVideo(availableWidth, availableHeight);
    logDetailVideoCalibration("fit-result", () => ({ calibrationId, availableWidth, availableHeight, result }));
    return result;
  } finally {
    frame.remove();
  }
}
