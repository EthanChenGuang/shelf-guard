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

/** Prefer MISSING when both heuristics could apply (D-09). */
export function dedupeAnomalyTypes(
  missingCandidate: boolean,
  movedCandidate: boolean,
): 'MISSING' | 'MOVED' | null {
  if (missingCandidate) return 'MISSING';
  if (movedCandidate) return 'MOVED';
  return null;
}
