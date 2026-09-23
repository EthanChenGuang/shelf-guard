import { describe, expect, it } from 'vitest';
import { classifyContourType, dedupeAnomalyTypes } from './classifyContour';

describe('classifyContour', () => {
  describe('classifyContourType', () => {
    it('returns MISSING for void heuristic (D-07)', () => {
      const type = classifyContourType(
        {
          baselineMean: 180,
          captureMean: 40,
          baselineCentroid: { x: 100, y: 100 },
          captureCentroid: { x: 100, y: 100 },
        },
        15,
      );
      expect(type).toBe('MISSING');
    });

    it('returns MOVED when both bands have foreground and centroids diverge (D-08)', () => {
      const type = classifyContourType(
        {
          baselineMean: 180,
          captureMean: 170,
          baselineCentroid: { x: 100, y: 100 },
          captureCentroid: { x: 140, y: 100 },
        },
        15,
      );
      expect(type).toBe('MOVED');
    });

    it('returns null when displacement is below threshold', () => {
      const type = classifyContourType(
        {
          baselineMean: 180,
          captureMean: 170,
          baselineCentroid: { x: 100, y: 100 },
          captureCentroid: { x: 105, y: 100 },
        },
        15,
      );
      expect(type).toBeNull();
    });
  });

  describe('dedupeAnomalyTypes', () => {
    it('prefers MISSING when both heuristics apply (D-09)', () => {
      expect(dedupeAnomalyTypes(true, true)).toBe('MISSING');
      expect(dedupeAnomalyTypes(false, true)).toBe('MOVED');
      expect(dedupeAnomalyTypes(false, false)).toBeNull();
    });
  });
});
