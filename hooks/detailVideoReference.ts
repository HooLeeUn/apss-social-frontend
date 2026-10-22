// Fixed design reference for normal mobile Detail. Neither zoom nor the
// mounted DOM participates in this calibration.
export const DETAIL_VIDEO_REFERENCE = Object.freeze({ width: 320, height: 640 });

// Canonical reference layout: video starts at y=450 with a 12px bottom inset.
// Keep these design coordinates explicit instead of measuring a cloned page:
// a temporarily stable clone is not proof of a completed layout.
const REFERENCE_VIDEO_TOP = 450;
const REFERENCE_BOTTOM_INSET = 12;
const height = DETAIL_VIDEO_REFERENCE.height - REFERENCE_VIDEO_TOP - REFERENCE_BOTTOM_INSET;
export const DETAIL_VIDEO_BASE = Object.freeze({ width: height * 9 / 16, height });

// The reference is a design baseline, not a cap on the rendered rectangle.
// Keep the preceding UI and bottom clearance, then fit the largest 9:16 video
// inside the remaining viewport height and the actual parent's inline size.
// svh avoids resizing when Android browser controls appear/disappear. No DOM
// measurement, video metadata or mount-time calibration enters this formula.
const reservedHeight = DETAIL_VIDEO_REFERENCE.height - DETAIL_VIDEO_BASE.height;
export const DETAIL_VIDEO_WIDTH = `min(100%, calc(max(0px, 100svh - ${reservedHeight}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * 0.5625))`;
