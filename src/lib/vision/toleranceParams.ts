import { ToleranceLevel } from '../../types';

export interface DiffParams {
  diffThreshold: number;
  minContourArea: number;
  displacementThresholdPx: number;
}

/** Map slider 0–100 to OpenCV diff parameters (D-12). */
export function toleranceToDiffParams(toleranceValue: number): DiffParams {
  const clamped = Math.max(0, Math.min(100, toleranceValue));
  const t = clamped / 100;
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return {
    diffThreshold: lerp(60, 15),
    minContourArea: lerp(200, 1200),
    displacementThresholdPx: lerp(8, 35),
  };
}

/** Migrate legacy enum tolerance to numeric slider value (D-11). */
export function legacyToleranceToNumber(tol: ToleranceLevel): number {
  if (tol === 'strict') return 25;
  if (tol === 'loose') return 75;
  return 50;
}
