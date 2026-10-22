// Minimum supported usable portrait viewport for normal mobile Detail.
export const DETAIL_VIDEO_REFERENCE = { width: 320, height: 640 } as const;

export function fitReferenceVideo(width: number, height: number) {
  const videoWidth = Math.max(0, Math.min(width, height * 9 / 16));
  return { width: videoWidth, height: videoWidth * 16 / 9 };
}

export async function measureDetailVideoReference(root: HTMLElement) {
  const source = root.closest<HTMLElement>("[data-mobile-detail-layout]");
  if (!source) return null;
  const frame = document.createElement("iframe");
  frame.title = "";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${DETAIL_VIDEO_REFERENCE.width}px;height:${DETAIL_VIDEO_REFERENCE.height}px;visibility:hidden;pointer-events:none;border:0`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) return null;
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
    if (!marker) return null;
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
    const availableHeight = DETAIL_VIDEO_REFERENCE.height - marker.getBoundingClientRect().top - safeBottom - 12;
    if (availableWidth <= 0 || availableHeight <= 0) throw new Error("Reference viewport leaves no space for a reaction video");
    return fitReferenceVideo(availableWidth, availableHeight);
  } finally {
    frame.remove();
  }
}
