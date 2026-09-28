/**
 * @vitest-environment node
 *
 * The whole photo is compared — there are no tier bands, so a change anywhere in the frame
 * (including the bottom fifth that the old default split lines never examined) must be found.
 */
import { ImageData } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { analyzeFrame, getCv } from './visionWorker';
import { jpegRoundTrip, makeShelfScene, renderShelf, type ShelfProduct } from '../test/syntheticShelf';
import type { DetectedAnomaly } from '../types';

globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;

const W = 1080;
const H = 1920;
const FRAME = { width: W, height: H };
const TOLERANCE = 50;

function overlaps(a: DetectedAnomaly, p: ShelfProduct): boolean {
  const b = a.boundingBox;
  const ax = b.x * W;
  const ay = b.y * H;
  const aw = b.width * W;
  const ah = b.height * H;
  const ix = Math.max(0, Math.min(ax + aw, p.x + p.w) - Math.max(ax, p.x));
  const iy = Math.max(0, Math.min(ay + ah, p.y + p.h) - Math.max(ay, p.y));
  return ix * iy > 0.25 * Math.min(aw * ah, p.w * p.h);
}

async function compare(seed: number, lightBack: boolean, removed: number[]) {
  const cv = await getCv();
  const scene = makeShelfScene(W, H, seed, lightBack);
  const baseline = await jpegRoundTrip(renderShelf(scene));
  const capture = await jpegRoundTrip(renderShelf(scene, removed));
  return { scene, result: analyzeFrame(cv, capture, baseline, FRAME, TOLERANCE) };
}

function expectExactlyRemoved(scene: ReturnType<typeof makeShelfScene>, result: ReturnType<typeof analyzeFrame>, removed: number[]) {
  const active = result.anomalies.filter((a) => !a.dismissed);
  for (const i of removed) {
    expect(active.some((a) => a.type === 'MISSING' && overlaps(a, scene.products[i]))).toBe(true);
  }
  expect(active.filter((a) => !removed.some((i) => overlaps(a, scene.products[i])))).toEqual([]);
  expect(result.missingCount).toBe(removed.length);
}

describe('whole-frame comparison', () => {
  const cases: Array<[string, number, boolean, number]> = [];
  for (const lightBack of [true, false]) {
    for (let shelf = 0; shelf < 4; shelf += 1) {
      cases.push([`shelf ${shelf + 1} of 4, ${lightBack ? 'light' : 'dark'} back`, 3, lightBack, shelf]);
    }
  }

  it.each(cases)('finds two products removed from %s', async (_label, seed, lightBack, shelf) => {
    const scene = makeShelfScene(W, H, seed, lightBack);
    const onShelf = scene.products.map((p, i) => ({ p, i })).filter(({ p }) => p.tier === shelf);
    const removed = [onShelf[0].i, onShelf[2].i];
    const { result } = await compare(seed, lightBack, removed);
    expectExactlyRemoved(scene, result, removed);
  }, 120_000);

  it.each([1, 2, 3])('keeps same-column removals on adjacent shelves apart (seed %i)', async (seed) => {
    const scene = makeShelfScene(W, H, seed, true);
    let best: { a: number; b: number; overlap: number } | null = null;
    scene.products.forEach((a, i) => {
      scene.products.forEach((b, j) => {
        if (b.tier !== a.tier + 1) return;
        const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        if (overlap / Math.min(a.w, b.w) >= 0.5 && (!best || overlap > best.overlap)) {
          best = { a: i, b: j, overlap };
        }
      });
    });
    expect(best).not.toBeNull();
    const removed = [best!.a, best!.b];
    const { result } = await compare(seed, true, removed);
    expectExactlyRemoved(scene, result, removed);
  }, 120_000);

  it.each([
    [1, true],
    [2, false],
    [3, true],
  ])('counts the products on the whole shelf and reports nothing when unchanged (seed %i)', async (seed, lightBack) => {
    const { scene, result } = await compare(seed as number, lightBack as boolean, []);
    expect(result.anomalies.filter((a) => !a.dismissed)).toEqual([]);
    expect(Math.abs(result.standardCount - scene.products.length)).toBeLessThanOrEqual(1);
  }, 120_000);
});
