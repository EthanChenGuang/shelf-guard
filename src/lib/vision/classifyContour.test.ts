import { describe, expect, it } from 'vitest';
import { classifyContourType, isLightingShift, pairMovedRegions, type PairableRegion } from './classifyContour';

describe('classifyContour', () => {
  describe('classifyContourType', () => {
    it('returns MISSING when contrast vanished', () => {
      expect(
        classifyContourType({ baselineTexture: 10, captureTexture: 10, baselineContrast: 40, captureContrast: 5 }),
      ).toBe('MISSING');
    });

    it('returns MISSING when texture vanished', () => {
      expect(
        classifyContourType({ baselineTexture: 20, captureTexture: 6, baselineContrast: 10, captureContrast: 10 }),
      ).toBe('MISSING');
    });

    it('returns ADDED when contrast appeared (mirror of the vanished case)', () => {
      expect(
        classifyContourType({ baselineTexture: 10, captureTexture: 10, baselineContrast: 5, captureContrast: 40 }),
      ).toBe('ADDED');
    });

    it('returns ADDED when texture appeared (mirror of the vanished case)', () => {
      expect(
        classifyContourType({ baselineTexture: 6, captureTexture: 20, baselineContrast: 10, captureContrast: 10 }),
      ).toBe('ADDED');
    });

    it('returns MOVED when the region is present in both photos', () => {
      expect(
        classifyContourType({ baselineTexture: 15, captureTexture: 14, baselineContrast: 30, captureContrast: 28 }),
      ).toBe('MOVED');
    });

    it('returns MOVED when texture vanished but contrast appeared', () => {
      expect(
        classifyContourType({ baselineTexture: 20, captureTexture: 6, baselineContrast: 5, captureContrast: 40 }),
      ).toBe('MOVED');
    });

    it('lets a strong cue in one direction outweigh a marginal cue in the other, symmetrically', () => {
      // Hand-held fixture: a removed product's contrast vanished, the bare back shows a little more detail.
      expect(
        classifyContourType({ baselineTexture: 6.2, captureTexture: 11.2, baselineContrast: 90, captureContrast: 15 }),
      ).toBe('MISSING');
      expect(
        classifyContourType({ baselineTexture: 11.2, captureTexture: 6.2, baselineContrast: 15, captureContrast: 90 }),
      ).toBe('ADDED');
    });
  });

  describe('pairMovedRegions', () => {
    const region = (
      type: PairableRegion['type'],
      x: number,
      overrides: Partial<PairableRegion> = {},
    ): PairableRegion => ({
      type,
      area: 10_000,
      center: { x, y: 100 },
      size: 100,
      baselineColor: [120, 80, 60],
      captureColor: [125, 84, 58],
      ...overrides,
    });

    it('relabels a MISSING and a matching ADDED region as MOVED', () => {
      expect(pairMovedRegions([region('MISSING', 100), region('ADDED', 350)])).toEqual(['MOVED', 'MOVED']);
    });

    it('does not pair regions whose areas differ by more than 2x', () => {
      expect(pairMovedRegions([region('MISSING', 100), region('ADDED', 350, { area: 30_000 })])).toEqual([
        'MISSING',
        'ADDED',
      ]);
    });

    it('does not pair regions whose colours differ', () => {
      // RGB distance 60 between baseline colour of MISSING and capture colour of ADDED.
      expect(
        pairMovedRegions([region('MISSING', 100), region('ADDED', 350, { captureColor: [180, 80, 60] })]),
      ).toEqual(['MISSING', 'ADDED']);
    });

    it('does not pair regions more than 4 sizes apart', () => {
      expect(pairMovedRegions([region('MISSING', 100), region('ADDED', 600)])).toEqual(['MISSING', 'ADDED']);
    });

    it('pairs one MISSING with only the nearest eligible ADDED region', () => {
      expect(pairMovedRegions([region('ADDED', 400), region('MISSING', 100), region('ADDED', 250)])).toEqual([
        'ADDED',
        'MOVED',
        'MOVED',
      ]);
    });

    it('never pairs two MISSING or two ADDED regions', () => {
      expect(pairMovedRegions([region('MISSING', 100), region('MISSING', 250)])).toEqual(['MISSING', 'MISSING']);
      expect(pairMovedRegions([region('ADDED', 100), region('ADDED', 250)])).toEqual(['ADDED', 'ADDED']);
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
