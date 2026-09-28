/**
 * @vitest-environment node
 *
 * The live preview often can't use the baseline's (ultra-wide) lens, so the ghost overlay is
 * placed by matching the preview against the baseline instead of being stretched over it.
 */
import { ImageData } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { fitGhost, getCv } from './visionWorker';
import { makeShelfScene, mulberry32, renderShelf } from '../test/syntheticShelf';
import { rasterFromRgba, type RasterFrame } from '../lib/vision/rasterFrame';

globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;

async function crop(frame: RasterFrame, x: number, y: number, w: number, h: number, outW: number, outH: number) {
  const cv = await getCv();
  const src = cv.matFromImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height));
  const roi = src.roi(new cv.Rect(x, y, w, h));
  const out = new cv.Mat();
  try {
    cv.resize(roi, out, new cv.Size(outW, outH), 0, 0, cv.INTER_AREA);
    return rasterFromRgba(outW, outH, new Uint8ClampedArray(out.data));
  } finally {
    src.delete();
    roi.delete();
    out.delete();
  }
}

function apply(h: number[], x: number, y: number): [number, number] {
  const d = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
}

describe('fitGhost', () => {
  it('places an ultra-wide baseline inside a narrower (1x) live preview', async () => {
    const cv = await getCv();
    const baseline = renderShelf(makeShelfScene(480, 640, 3, true));
    // The 1x lens sees the middle half of what the ultra-wide saw.
    const live = await crop(baseline, 120, 160, 240, 320, 360, 480);
    const h = fitGhost(cv, baseline, live);
    expect(h).not.toBeNull();
    const [cx, cy] = apply(h!, 0.5, 0.5);
    expect(cx).toBeCloseTo(0.5, 1);
    expect(cy).toBeCloseTo(0.5, 1);
    const [tx, ty] = apply(h!, 0.25, 0.25);
    expect(tx).toBeCloseTo(0, 1);
    expect(ty).toBeCloseTo(0, 1);
  }, 60_000);

  it('is close to identity when the preview matches the baseline framing', async () => {
    const cv = await getCv();
    const baseline = renderShelf(makeShelfScene(480, 640, 5, false));
    const h = fitGhost(cv, baseline, await crop(baseline, 0, 0, 480, 640, 360, 480));
    expect(h).not.toBeNull();
    for (const [x, y] of [[0.1, 0.1], [0.9, 0.2], [0.5, 0.9]]) {
      const [u, v] = apply(h!, x, y);
      expect(u).toBeCloseTo(x, 1);
      expect(v).toBeCloseTo(y, 1);
    }
  }, 60_000);

  it('returns null when the preview shows something else', async () => {
    const cv = await getCv();
    const baseline = renderShelf(makeShelfScene(480, 640, 3, true));
    const rand = mulberry32(42);
    const noise = new Uint8ClampedArray(360 * 480 * 4).map((_, i) => (i % 4 === 3 ? 255 : rand() * 255));
    expect(fitGhost(cv, baseline, rasterFromRgba(360, 480, noise))).toBeNull();
  }, 60_000);
});
