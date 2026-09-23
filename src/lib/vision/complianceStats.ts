import { DetectedAnomaly } from '../../types';

export interface ComplianceStats {
  complianceRate: number;
  actualCount: number;
  missingCount: number;
  displacedCount: number;
}

/** Shared compliance formula for worker output and App dismiss recalc. */
export function computeComplianceStats(
  anomalies: DetectedAnomaly[],
  standardCount: number,
): ComplianceStats {
  const missingCount = anomalies.filter((a) => a.type === 'MISSING' && !a.dismissed).length;
  const displacedCount = anomalies.filter((a) => a.type === 'MOVED' && !a.dismissed).length;
  const actualCount = standardCount - missingCount;
  const complianceRate = Math.max(70, Math.min(100, 100 - missingCount * 4 - displacedCount * 2));
  return { complianceRate, actualCount, missingCount, displacedCount };
}
