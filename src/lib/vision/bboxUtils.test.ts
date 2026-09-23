import { describe, expect, it } from 'vitest';
import { INITIAL_MOCK_ANOMALIES } from '../constants';
import { pixelRectToNormalized, stableAnomalyId } from './bboxUtils';

const FRAME_W = 1080;
const FRAME_H = 1920;

describe('bboxUtils', () => {
  describe('pixelRectToNormalized', () => {
    it('returns 0.0–1.0 coordinates for known rects', () => {
      const normalized = pixelRectToNormalized(
        { x: 540, y: 960, width: 108, height: 192 },
        FRAME_W,
        FRAME_H,
      );
      expect(normalized).toEqual({
        x: 0.5,
        y: 0.5,
        width: 0.1,
        height: 0.1,
      });
    });

    it('matches INITIAL_MOCK_ANOMALIES bbox fractions within 0.001', () => {
      for (const anomaly of INITIAL_MOCK_ANOMALIES) {
        const { boundingBox } = anomaly;
        const pixelRect = {
          x: boundingBox.x * FRAME_W,
          y: boundingBox.y * FRAME_H,
          width: boundingBox.width * FRAME_W,
          height: boundingBox.height * FRAME_H,
        };
        const roundTrip = pixelRectToNormalized(pixelRect, FRAME_W, FRAME_H);
        expect(roundTrip.x).toBeCloseTo(boundingBox.x, 3);
        expect(roundTrip.y).toBeCloseTo(boundingBox.y, 3);
        expect(roundTrip.width).toBeCloseTo(boundingBox.width, 3);
        expect(roundTrip.height).toBeCloseTo(boundingBox.height, 3);
      }
    });
  });

  describe('stableAnomalyId', () => {
    it('is deterministic for same tier and bbox', () => {
      const bbox = { x: 0.32, y: 0.37, width: 0.28, height: 0.09 };
      const first = stableAnomalyId(1, bbox);
      const second = stableAnomalyId(1, bbox);
      expect(first).toBe(second);
      expect(first).toMatch(/^anomaly-/);
    });
  });
});
