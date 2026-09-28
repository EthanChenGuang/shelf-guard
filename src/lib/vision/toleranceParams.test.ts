import { describe, expect, it } from 'vitest';
import { legacyToleranceToNumber, toleranceToDiffParams } from './toleranceParams';

describe('toleranceParams', () => {
  describe('toleranceToDiffParams', () => {
    it('maps strict end (0) per D-12', () => {
      expect(toleranceToDiffParams(0)).toEqual({
        diffThreshold: 12,
        minContourArea: 200,
        displacementThresholdPx: 8,
      });
    });

    it('maps mid slider (50) per D-12', () => {
      expect(toleranceToDiffParams(50)).toEqual({
        diffThreshold: 20,
        minContourArea: 700,
        displacementThresholdPx: 22,
      });
    });

    it('maps loose end (100) per D-12', () => {
      expect(toleranceToDiffParams(100)).toEqual({
        diffThreshold: 28,
        minContourArea: 1200,
        displacementThresholdPx: 35,
      });
    });

    it('flags fainter color changes the stricter the tolerance', () => {
      const strict = toleranceToDiffParams(25);
      const normal = toleranceToDiffParams(50);
      const loose = toleranceToDiffParams(75);
      expect(strict.diffThreshold).toBeLessThan(normal.diffThreshold);
      expect(normal.diffThreshold).toBeLessThan(loose.diffThreshold);
    });

    it('clamps out-of-range inputs to 0–100', () => {
      expect(toleranceToDiffParams(-10)).toEqual(toleranceToDiffParams(0));
      expect(toleranceToDiffParams(150)).toEqual(toleranceToDiffParams(100));
    });
  });

  describe('legacyToleranceToNumber', () => {
    it('maps legacy enum to slider values per D-11', () => {
      expect(legacyToleranceToNumber('strict')).toBe(25);
      expect(legacyToleranceToNumber('normal')).toBe(50);
      expect(legacyToleranceToNumber('loose')).toBe(75);
    });
  });
});
