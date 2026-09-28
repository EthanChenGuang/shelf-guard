import { describe, expect, it } from 'vitest';
import { classifyContourType, dedupeAnomalyTypes, isLightingShift } from './classifyContour';

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

  describe('isLightingShift', () => {
    it('treats a faint change whose color relation to the surroundings is unchanged as lighting', () => {
      // White paper, uniformly darker in the re-shoot: stands out from the desk just the same.
      expect(isLightingShift([70, 60, 30], [67, 58, 29], 1, 22, 20)).toBe(true);
    });

    it('treats a relation scaled by the region brightness change as lighting', () => {
      // 20% darker exposure: the paper-vs-desk contrast shrinks by the same factor.
      expect(isLightingShift([80, 70, 40], [64, 56, 32], 0.8, 22, 20)).toBe(true);
    });

    it('keeps a faint change where the region stood out and now blends in (object moved away)', () => {
      expect(isLightingShift([10, -8, 5], [1, 0, -1], 1, 22, 20)).toBe(false);
    });

    it('keeps a faint change whose contrast flipped direction even at a similar strength', () => {
      expect(isLightingShift([8, 6, -3], [4, -7, 5], 1, 25, 20)).toBe(false);
    });

    it('never discards a strong difference', () => {
      expect(isLightingShift([70, 60, 30], [67, 58, 29], 1, 45, 20)).toBe(false);
    });
  });
});
