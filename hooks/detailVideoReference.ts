// Original player sizing rule, present before useDetailVideoSpace was added
// (9749fc0, app/movies/[id]/page.tsx: VIDEO_COMMENT_CARD_VIDEO_HEIGHT).
// Restore that rule rather than deriving a new size from mount-time geometry.
export const DETAIL_VIDEO_HEIGHT = "clamp(14rem, 36dvh, 18rem)";
export const DETAIL_VIDEO_WIDTH = `min(100%, calc(${DETAIL_VIDEO_HEIGHT} * 0.5625))`;
