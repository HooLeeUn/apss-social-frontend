// Normal mobile CSS gives the existing black slot definite width and height.
// Its container-query units select the largest 9:16 box that fits both axes.
// Outside that scoped layout, retain the existing width rule (e.g. recorder).
export const DETAIL_VIDEO_WIDTH = "var(--detail-video-fit-width, 100%)";
