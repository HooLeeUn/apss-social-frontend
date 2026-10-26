interface Bounds { left: number; top: number; width: number; height: number }

export function mentionPopupPosition(anchor: Bounds, viewport: Bounds, desiredHeight: number) {
  const margin = 8;
  const gap = 8;
  const leftEdge = viewport.left + margin;
  const topEdge = viewport.top + margin;
  const rightEdge = viewport.left + viewport.width - margin;
  const bottomEdge = viewport.top + viewport.height - margin;
  const width = Math.max(1, Math.min(anchor.width, rightEdge - leftEdge));
  const below = Math.max(0, bottomEdge - (anchor.top + anchor.height) - gap);
  const above = Math.max(0, anchor.top - gap - topEdge);
  const opensAbove = below < desiredHeight && above > below;
  const maxHeight = Math.max(1, Math.min(208, opensAbove ? above : below, viewport.height - margin * 2));
  const height = Math.min(desiredHeight, maxHeight);
  return {
    left: Math.max(leftEdge, Math.min(anchor.left, rightEdge - width)),
    top: Math.max(topEdge, Math.min(opensAbove ? anchor.top - gap - height : anchor.top + anchor.height + gap, bottomEdge - height)),
    width,
    maxHeight,
  };
}
