import type { DetectedAnomaly } from '../../types';

export interface ContourRegionStats {
  /** Mean gradient magnitude in the region — how much product detail is present. */
  baselineTexture: number;
  captureTexture: number;
  /** |region mean - surrounding ring mean| — how much the region stands out from the shelf. */
  baselineContrast: number;
  captureContrast: number;
}

const TEXTURE_RATIO = 1.6;
const TEXTURE_MIN_DELTA = 4;
const CONTRAST_RATIO = 1.5;
const CONTRAST_MIN_DELTA = 12;
/** Decisive tier: a strong cue in one direction outweighs a marginal cue in the other. */
const DECISIVE_RATIO_FACTOR = 1.25;
const DECISIVE_DELTA_FACTOR = 2;

/** Photo `a` shows clearly more detail or stands out clearly more than photo `b` in the region. */
function clearlyExceeds(texA: number, texB: number, conA: number, conB: number, ratio = 1, delta = 1): boolean {
  return (
    (texA > texB * TEXTURE_RATIO * ratio && texA - texB > TEXTURE_MIN_DELTA * delta) ||
    (conA > conB * CONTRAST_RATIO * ratio && conA - conB > CONTRAST_MIN_DELTA * delta)
  );
}

/**
 * Symmetric in the two photos, with no brightness-polarity assumption: something that vanished is
 * MISSING, something that appeared is ADDED, and anything present in both photos or changed in
 * place is MOVED.
 */
export function classifyContourType(stats: ContourRegionStats): DetectedAnomaly['type'] {
  const { baselineTexture: texB, captureTexture: texC, baselineContrast: conB, captureContrast: conC } = stats;
  for (const [ratio, delta] of [
    [DECISIVE_RATIO_FACTOR, DECISIVE_DELTA_FACTOR],
    [1, 1],
  ]) {
    const vanished = clearlyExceeds(texB, texC, conB, conC, ratio, delta);
    const appeared = clearlyExceeds(texC, texB, conC, conB, ratio, delta);
    if (vanished && !appeared) return 'MISSING';
    if (appeared && !vanished) return 'ADDED';
    if (vanished && appeared) return 'MOVED';
  }
  return 'MOVED';
}

const MOVE_PAIR_MAX_AREA_RATIO = 2;
const MOVE_PAIR_MAX_COLOR_DISTANCE = 35;
const MOVE_PAIR_MAX_DISTANCE_SIZES = 4;

export interface PairableRegion {
  type: DetectedAnomaly['type'];
  area: number;
  center: { x: number; y: number };
  /** Longer side of the region's bounding box. */
  size: number;
  /** Mean RGB inside the region in each photo. */
  baselineColor: number[];
  captureColor: number[];
}

/**
 * An object moved between shots leaves a MISSING region where it was and an ADDED one where it
 * went. Pair them one-to-one, nearest first, and report both ends as MOVED. Returns the final
 * types in input order.
 */
export function pairMovedRegions(regions: PairableRegion[]): Array<DetectedAnomaly['type']> {
  const types = regions.map((r) => r.type);
  const pairs: Array<{ i: number; j: number; distance: number }> = [];
  regions.forEach((gone, i) => {
    if (gone.type !== 'MISSING') return;
    regions.forEach((came, j) => {
      if (came.type !== 'ADDED') return;
      const areaRatio = Math.max(gone.area, came.area) / Math.max(1, Math.min(gone.area, came.area));
      const colorDistance = Math.hypot(...gone.baselineColor.map((v, ch) => v - (came.captureColor[ch] ?? 0)));
      const distance = Math.hypot(gone.center.x - came.center.x, gone.center.y - came.center.y);
      if (
        areaRatio <= MOVE_PAIR_MAX_AREA_RATIO &&
        colorDistance < MOVE_PAIR_MAX_COLOR_DISTANCE &&
        distance <= MOVE_PAIR_MAX_DISTANCE_SIZES * Math.max(gone.size, came.size)
      ) {
        pairs.push({ i, j, distance });
      }
    });
  });
  pairs.sort((a, b) => a.distance - b.distance);
  const used = new Set<number>();
  for (const { i, j } of pairs) {
    if (used.has(i) || used.has(j)) continue;
    used.add(i);
    used.add(j);
    types[i] = 'MOVED';
    types[j] = 'MOVED';
  }
  return types;
}

const WEAK_DIFF_FACTOR = 1.5;
const MAX_LIGHTING_MISMATCH = 0.16;

/** |a - b| relative to the stronger of the two vectors. */
function mismatch(a: number[], b: number[]): number {
  return Math.hypot(...a.map((v, i) => v - b[i])) / Math.max(Math.hypot(...a), Math.hypot(...b), 1);
}

/**
 * A faint difference is only an object change if the region's color relation to its
 * surroundings changed — it stood out and now blends in, or stands out differently. When the
 * relation is unchanged, or merely scaled by the region's own brightness change (`gain`,
 * capture/baseline), the area just got brighter or darker along with its surroundings — a
 * highlight such as white paper or a sunlit wall under a different exposure — and that is
 * lighting. `relationB/C` are per-channel region-minus-surroundings means.
 */
export function isLightingShift(
  relationB: number[],
  relationC: number[],
  gain: number,
  meanDiff: number,
  diffThreshold: number,
): boolean {
  if (meanDiff >= diffThreshold * WEAK_DIFF_FACTOR) return false;
  const scaled = relationB.map((v) => v * gain);
  return Math.min(mismatch(relationB, relationC), mismatch(scaled, relationC)) < MAX_LIGHTING_MISMATCH;
}
