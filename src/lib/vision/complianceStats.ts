import { DetectedAnomaly } from '../../types';
import { meetsMinConfidence } from './confidence';

export interface ComplianceStats {
  complianceRate: number;
  actualCount: number;
  missingCount: number;
  displacedCount: number;
  addedCount: number;
}

/** Shared compliance formula for worker output and the App's threshold-aware counts. */
export function computeComplianceStats(
  anomalies: DetectedAnomaly[],
  standardCount: number,
  minConfidence = 0,
): ComplianceStats {
  const counted = anomalies.filter((a) => !a.dismissed && meetsMinConfidence(a, minConfidence));
  const missingCount = counted.filter((a) => a.type === 'MISSING').length;
  const displacedCount = counted.filter((a) => a.type === 'MOVED').length;
  const addedCount = counted.filter((a) => a.type === 'ADDED').length;
  const actualCount = standardCount - missingCount + addedCount;
  const complianceRate = Math.max(
    70,
    Math.min(100, 100 - missingCount * 4 - displacedCount * 2 - addedCount * 2),
  );
  return { complianceRate, actualCount, missingCount, displacedCount, addedCount };
}
