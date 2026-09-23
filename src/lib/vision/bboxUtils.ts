export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Convert pixel rect to normalized 0.0–1.0 full-frame coordinates (D-10). */
export function pixelRectToNormalized(
  rect: PixelRect,
  frameW: number,
  frameH: number,
): NormalizedRect {
  return {
    x: rect.x / frameW,
    y: rect.y / frameH,
    width: rect.width / frameW,
    height: rect.height / frameH,
  };
}

/** Deterministic anomaly id from tier index and normalized bbox. */
export function stableAnomalyId(tierIndex: number, bbox: NormalizedRect): string {
  const hash = `${tierIndex}-${bbox.x.toFixed(3)}-${bbox.y.toFixed(3)}-${bbox.width.toFixed(3)}-${bbox.height.toFixed(3)}`;
  return `anomaly-${hash}`;
}
