import { describe, expect, it } from 'vitest';
import { ghostMatrix, toCssMatrix3d } from './ghostFit';

function apply(m: number[], x: number, y: number): [number, number] {
  const d = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / d, (m[3] * x + m[4] * y + m[5]) / d];
}

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe('ghostMatrix', () => {
  it('stretches the baseline over the whole view when frame and view share an aspect ratio', () => {
    const m = ghostMatrix(IDENTITY, { width: 1080, height: 1920 }, { width: 720, height: 1280 }, { width: 360, height: 640 });
    expect(apply(m, 0, 0)).toEqual([0, 0]);
    const [x, y] = apply(m, 1080, 1920);
    expect(x).toBeCloseTo(360);
    expect(y).toBeCloseTo(640);
  });

  it('follows the object-cover crop of a landscape video shown in a portrait view', () => {
    // 640x480 video covering a 360x640 view: scaled to 853.3x640, centred, 246.7px cut per side.
    const m = ghostMatrix(IDENTITY, { width: 800, height: 600 }, { width: 640, height: 480 }, { width: 360, height: 640 });
    const [x0, y0] = apply(m, 0, 0);
    expect(x0).toBeCloseTo(-246.67, 1);
    expect(y0).toBeCloseTo(0);
    const [x1] = apply(m, 800, 600);
    expect(x1).toBeCloseTo(606.67, 1);
  });

  it('shrinks an ultra-wide baseline so its middle half fills a 1x view', () => {
    const halfZoom = [2, 0, -0.5, 0, 2, -0.5, 0, 0, 1];
    const m = ghostMatrix(halfZoom, { width: 1000, height: 1000 }, { width: 500, height: 500 }, { width: 400, height: 400 });
    const [x, y] = apply(m, 250, 250);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    const [x2, y2] = apply(m, 750, 750);
    expect(x2).toBeCloseTo(400);
    expect(y2).toBeCloseTo(400);
  });
});

describe('toCssMatrix3d', () => {
  it('lays a 2D homography out column-major for matrix3d', () => {
    expect(toCssMatrix3d([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe('matrix3d(1,4,0,7,2,5,0,8,0,0,1,0,3,6,0,9)');
  });
});
