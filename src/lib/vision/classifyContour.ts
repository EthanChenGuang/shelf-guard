export interface ContourRegionStats {
  baselineMean: number;
  captureMean: number;
  baselineCentroid: { x: number; y: number };
  captureCentroid: { x: number; y: number };
  /** Mean gradient magnitude in the region — how much product detail is present. */
  baselineTexture?: number;
  captureTexture?: number;
  /** |region mean - surrounding ring mean| — how much the region stands out from the shelf. */
  baselineContrast?: number;
  captureContrast?: number;
}

const VOID_DELTA_THRESHOLD = 12;
const FOREGROUND_MIN = 35;
const TEXTURE_RATIO = 1.6;
const TEXTURE_MIN_DELTA = 4;
const CONTRAST_RATIO = 1.5;
const CONTRAST_MIN_DELTA = 12;

/** Classify a diff contour as MISSING, MOVED, or unclassified (D-07, D-08). */
export function classifyContourType(
  stats: ContourRegionStats,
  displacementThresholdPx: number,
): 'MISSING' | 'MOVED' | null {
  const voidDelta = stats.baselineMean - stats.captureMean;
  const dx = stats.captureCentroid.x - stats.baselineCentroid.x;
  const dy = stats.captureCentroid.y - stats.baselineCentroid.y;
  const displacement = Math.hypot(dx, dy);
  const bothForeground =
    stats.baselineMean > FOREGROUND_MIN && stats.captureMean > FOREGROUND_MIN;

  if (
    voidDelta > VOID_DELTA_THRESHOLD &&
    stats.baselineMean > FOREGROUND_MIN &&
    stats.captureMean < stats.baselineMean - VOID_DELTA_THRESHOLD / 2
  ) {
    return 'MISSING';
  }

  const texB = stats.baselineTexture;
  const texC = stats.captureTexture;
  const hasTexture = texB !== undefined && texC !== undefined;
  // A removed product leaves plain shelf back: detail drops regardless of back-panel brightness.
  if (hasTexture && texB > texC * TEXTURE_RATIO && texB - texC > TEXTURE_MIN_DELTA) {
    return 'MISSING';
  }

  const conB = stats.baselineContrast;
  const conC = stats.captureContrast;
  const hasContrast = conB !== undefined && conC !== undefined;
  // The region stood out from the shelf before and now blends into it: the product is gone.
  if (hasContrast && conB > conC * CONTRAST_RATIO && conB - conC > CONTRAST_MIN_DELTA) {
    return 'MISSING';
  }

  // D-08: both bands keep foreground but it shifted
  if (bothForeground && displacement > displacementThresholdPx) {
    return 'MOVED';
  }

  // Detail appeared where the baseline had none: an item placed out of position.
  if (hasTexture && texC > texB * TEXTURE_RATIO && texC - texB > TEXTURE_MIN_DELTA) {
    return 'MOVED';
  }
  if (hasContrast && conC > conB * CONTRAST_RATIO && conC - conB > CONTRAST_MIN_DELTA) {
    return 'MOVED';
  }
  // Region already passed the aligned change detector: report it rather than drop it.
  if (hasContrast) {
    return conB >= conC ? 'MISSING' : 'MOVED';
  }

  return null;
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

/** Prefer MISSING when both heuristics could apply (D-09). */
export function dedupeAnomalyTypes(
  missingCandidate: boolean,
  movedCandidate: boolean,
): 'MISSING' | 'MOVED' | null {
  if (missingCandidate) return 'MISSING';
  if (movedCandidate) return 'MOVED';
  return null;
}
