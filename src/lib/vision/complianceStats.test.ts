import { describe, expect, it } from 'vitest';
import type { DetectedAnomaly } from '../../types';
import { computeComplianceStats } from './complianceStats';

function anomaly(id: string, type: DetectedAnomaly['type'], score: number, dismissed = false): DetectedAnomaly {
  return {
    id,
    type,
    title: id,
    score,
    dismissed,
    boundingBox: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
  };
}

const list = [
  anomaly('a', 'MISSING', 0.9),
  anomaly('b', 'MOVED', 0.85),
  anomaly('c', 'MISSING', 0.6),
  anomaly('d', 'MISSING', 0.95, true),
];

describe('computeComplianceStats', () => {
  it('counts every non-dismissed anomaly when no threshold is given', () => {
    expect(computeComplianceStats(list, 24)).toEqual({
      missingCount: 2,
      displacedCount: 1,
      addedCount: 0,
      actualCount: 22,
      complianceRate: 90,
    });
  });

  it('ignores anomalies below the confidence threshold', () => {
    expect(computeComplianceStats(list, 24, 85)).toEqual({
      missingCount: 1,
      displacedCount: 1,
      addedCount: 0,
      actualCount: 23,
      complianceRate: 94,
    });
  });

  it('counts added items on the shelf and charges them like a moved item', () => {
    expect(computeComplianceStats([...list, anomaly('e', 'ADDED', 0.9)], 24)).toEqual({
      missingCount: 2,
      displacedCount: 1,
      addedCount: 1,
      actualCount: 23,
      complianceRate: 88,
    });
  });
});
