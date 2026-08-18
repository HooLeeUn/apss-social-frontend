export const NOTIFICATION_VIDEO_TARGET_MAX_FRAMES = 24;

export interface NotificationVideoGeometry {
  containerTop: number;
  containerScrollTop: number;
  containerScrollHeight: number;
  containerClientHeight: number;
  cardTop: number;
  stickyBottom: number;
}

export function calculateNotificationVideoScrollTop(geometry: NotificationVideoGeometry, topGap = 8): number {
  const visibleTop = Math.max(geometry.containerTop, geometry.stickyBottom, 0) + topGap;
  const cardContentTop = geometry.cardTop - geometry.containerTop + geometry.containerScrollTop;
  const requestedScrollTop = cardContentTop - (visibleTop - geometry.containerTop);
  const maxScrollTop = Math.max(0, geometry.containerScrollHeight - geometry.containerClientHeight);
  return Math.min(maxScrollTop, Math.max(0, requestedScrollTop));
}

export function findNotificationVideoTargetOverFrames<T>({
  findTarget,
  requestFrame,
  onFound,
  onExhausted,
  maxFrames = NOTIFICATION_VIDEO_TARGET_MAX_FRAMES,
}: {
  findTarget: () => T | null;
  requestFrame: (callback: FrameRequestCallback) => number;
  onFound: (target: T) => void;
  onExhausted: () => void;
  maxFrames?: number;
}): () => void {
  let cancelled = false;
  let frameId: number | null = null;

  const find = (attempt: number) => {
    if (cancelled) return;
    const target = findTarget();
    if (target) {
      onFound(target);
      return;
    }
    if (attempt >= maxFrames) {
      onExhausted();
      return;
    }
    frameId = requestFrame(() => find(attempt + 1));
  };

  find(0);
  return () => {
    cancelled = true;
    if (frameId !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
  };
}
