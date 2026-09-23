export interface ContourRegionStats {
  baselineMean: number;
  captureMean: number;
  baselineCentroid: { x: number; y: number };
  captureCentroid: { x: number; y: number };
}

const VOID_DELTA_THRESHOLD = 12;
const FOREGROUND_MIN = 35;

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

  // D-08 before void check when both bands retain foreground (D-09: MISSING only when void dominates)
  if (bothForeground && displacement > displacementThresholdPx) {
    return 'MOVED';
  }

  if (
    voidDelta > VOID_DELTA_THRESHOLD &&
    stats.baselineMean > FOREGROUND_MIN &&
    stats.captureMean < stats.baselineMean - VOID_DELTA_THRESHOLD / 2
  ) {
    return 'MISSING';
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
