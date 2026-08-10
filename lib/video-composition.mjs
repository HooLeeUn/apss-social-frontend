/** @typedef {{ x: number, y: number, width: number, height: number }} VideoRect */

/**
 * Returns the centered source rectangle that fills a target without distortion.
 * @param {number} sourceWidth
 * @param {number} sourceHeight
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @returns {VideoRect}
 */
export function getCoverSourceRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio;
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / targetRatio;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}

/**
 * Returns the centered destination rectangle that contains a full source frame.
 * @param {number} sourceWidth
 * @param {number} sourceHeight
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @returns {VideoRect}
 */
export function getContainDestinationRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

/**
 * Computes both layers for the fixed-size reaction canvas.
 * @param {number} sourceWidth
 * @param {number} sourceHeight
 * @param {number} targetWidth
 * @param {number} targetHeight
 */
export function getVideoFrameComposition(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  return {
    backgroundMode: sourceHeight > sourceWidth ? "black" : "camera",
    backgroundSource: getCoverSourceRect(sourceWidth, sourceHeight, targetWidth, targetHeight),
    foregroundDestination: getContainDestinationRect(sourceWidth, sourceHeight, targetWidth, targetHeight),
  };
}

/**
 * Selects the most visible playable video while retaining the current one for
 * near-equal ratios to avoid play/pause flicker.
 * @param {Map<string, number>} ratios
 * @param {string | null} currentId
 * @param {number} minimumRatio
 * @param {number} hysteresis
 */
export function selectDominantVideo(ratios, currentId, minimumRatio, hysteresis) {
  let bestId = null;
  let bestRatio = minimumRatio;
  for (const [id, ratio] of ratios) {
    if (ratio >= bestRatio) {
      bestId = id;
      bestRatio = ratio;
    }
  }
  if (!bestId) return null;
  const currentRatio = currentId ? ratios.get(currentId) ?? 0 : 0;
  if (currentId && currentRatio >= minimumRatio && bestId !== currentId && bestRatio < currentRatio + hysteresis) return currentId;
  return bestId;
}
