// The ideal is a design constant, never a measurement cached during mounting.
export const DETAIL_VIDEO_REFERENCE = Object.freeze({ width: 320, height: 640 });
export const DETAIL_VIDEO_BASE = Object.freeze({
  width: DETAIL_VIDEO_REFERENCE.height * 9 / 16,
  height: DETAIL_VIDEO_REFERENCE.height,
});

export function fitDetailVideo(availableWidth: number, availableHeight: number) {
  if (!Number.isFinite(availableWidth) || !Number.isFinite(availableHeight) || availableWidth <= 0 || availableHeight <= 0) return null;
  const height = Math.min(DETAIL_VIDEO_BASE.height, availableHeight, availableWidth * 16 / 9);
  return { width: height * 9 / 16, height };
}

// Layout coordinates cancel the scroll offset; scrolling must not resize videos.
export function detailVideoAvailableHeight(viewportHeight: number, slotTop: number, viewportTop: number, scrollTop: number, bottomPadding: number) {
  return viewportHeight - (slotTop - viewportTop + scrollTop) - bottomPadding;
}
