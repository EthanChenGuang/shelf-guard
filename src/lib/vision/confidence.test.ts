import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIN_CONFIDENCE,
  MIN_CONFIDENCE_CEIL,
  MIN_CONFIDENCE_FLOOR,
  anomalyConfidence,
  meetsMinConfidence,
} from './confidence';

describe('confidence', () => {
  it('exposes the default and slider range', () => {
    expect(DEFAULT_MIN_CONFIDENCE).toBe(85);
    expect(MIN_CONFIDENCE_FLOOR).toBe(50);
    expect(MIN_CONFIDENCE_CEIL).toBe(99);
  });

  describe('anomalyConfidence', () => {
    it('rates a removed-product-like region near certain', () => {
      expect(anomalyConfidence(0.013, 7.7)).toBeGreaterThanOrEqual(0.99);
    });

    it('rates a clearly visible move above the default threshold', () => {
      expect(anomalyConfidence(0.0056, 2.24)).toBeGreaterThanOrEqual(0.85);
    });

    it('rates a shadow/glare/parallax distractor below the default threshold', () => {
      expect(anomalyConfidence(0.0019, 1.51)).toBeLessThan(0.85);
    });

    it('increases strictly with area at fixed strength', () => {
      const values = [0.001, 0.003, 0.01, 0.03].map((a) => anomalyConfidence(a, 2));
      for (let i = 1; i < values.length; i += 1) expect(values[i]).toBeGreaterThan(values[i - 1]);
    });

    it('increases strictly with strength at fixed area', () => {
      const values = [1, 1.5, 2, 3].map((s) => anomalyConfidence(0.003, s));
      for (let i = 1; i < values.length; i += 1) expect(values[i]).toBeGreaterThan(values[i - 1]);
    });

    it('returns 0 for non-positive or NaN inputs', () => {
      expect(anomalyConfidence(0, 2)).toBe(0);
      expect(anomalyConfidence(-0.01, 2)).toBe(0);
      expect(anomalyConfidence(0.01, 0)).toBe(0);
      expect(anomalyConfidence(0.01, -1)).toBe(0);
      expect(anomalyConfidence(Number.NaN, 2)).toBe(0);
      expect(anomalyConfidence(0.01, Number.NaN)).toBe(0);
    });
  });

  describe('meetsMinConfidence', () => {
    it('includes scores at the threshold and excludes those below', () => {
      expect(meetsMinConfidence({ score: 0.85 }, 85)).toBe(true);
      expect(meetsMinConfidence({ score: 0.84 }, 85)).toBe(false);
    });

    it('passes any score at threshold 0', () => {
      expect(meetsMinConfidence({ score: 0 }, 0)).toBe(true);
      expect(meetsMinConfidence({ score: 0.01 }, 0)).toBe(true);
    });
  });
});
