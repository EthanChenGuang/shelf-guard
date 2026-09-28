import type { DetectedAnomaly } from '../../types';

export const DEFAULT_MIN_CONFIDENCE = 85;
export const MIN_CONFIDENCE_FLOOR = 50;
export const MIN_CONFIDENCE_CEIL = 99;

/** Calibrated on real photos: removed products ~100%, visible moves ~90%+, shadows/glare/parallax ~41%, faint changes ~46%. */
export function anomalyConfidence(areaFraction: number, strength: number): number {
  if (!(areaFraction > 0) || !(strength > 0)) return 0;
  return 1 / (1 + Math.exp(-(1.2 * Math.log(areaFraction * 100) + 3.9 * Math.log(strength))));
}

export function meetsMinConfidence(anomaly: Pick<DetectedAnomaly, 'score'>, minConfidence: number): boolean {
  return anomaly.score * 100 >= minConfidence;
}
