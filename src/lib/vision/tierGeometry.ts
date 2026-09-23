export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Validate monotonic split bands in (0, 1] — shared by worker and IndexedDB load. */
export function validateSplitYPercentages(
  splitYPercentages: unknown,
): splitYPercentages is [number, number, number, number] {
  if (!Array.isArray(splitYPercentages) || splitYPercentages.length !== 4) {
    return false;
  }
  let prev = 0;
  for (let i = 0; i < splitYPercentages.length; i += 1) {
    const v = splitYPercentages[i];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= prev || v > 1) {
      return false;
    }
    prev = v;
  }
  return true;
}

/** Compute pixel crop rect for a tier band with optional horizontal inset (D-16). */
export function tierBoundsFromSplits(
  splitYPercentages: [number, number, number, number],
  imageDimensions: { width: number; height: number },
  tierIndex: 0 | 1 | 2 | 3,
  edgeInsetPct = 0.02,
): PixelRect {
  const { width, height } = imageDimensions;
  const topPct = tierIndex === 0 ? 0 : splitYPercentages[tierIndex - 1];
  const bottomPct = splitYPercentages[tierIndex];
  const insetX = Math.round(width * edgeInsetPct);
  const y = Math.round(topPct * height);
  const bottom = Math.round(bottomPct * height);
  return {
    x: insetX,
    y,
    width: Math.max(1, width - 2 * insetX),
    height: Math.max(1, bottom - y),
  };
}
