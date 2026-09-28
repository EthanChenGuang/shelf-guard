/**
 * @vitest-environment node
 *
 * Realistic re-shoot regression: the inspection photo is taken by hand, so it is rotated,
 * shifted, zoomed, re-exposed, noisy and JPEG-compressed relative to the baseline.
 * Set HANDHELD_SEEDS=12 / HANDHELD_STRENGTH=1.5 locally for a deeper or shakier sweep.
 */
import { ImageData } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { analyzeAllTiers, getCv } from './visionWorker';
import {
  handheldMatrix,
  jpegRoundTrip,
  makeShelfScene,
  mapRect,
  mulberry32,
  randomHandheld,
  renderShelf,
  simulateHandheld,
} from '../test/syntheticShelf';
import type { DetectedAnomaly } from '../types';

globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;

const SEEDS = Number(process.env.HANDHELD_SEEDS ?? 2);
const STRENGTH = Number(process.env.HANDHELD_STRENGTH ?? 1);
const TOLERANCE = 50;

function overlaps(
  a: DetectedAnomaly,
  p: { x: number; y: number; w: number; h: number },
  w: number,
  h: number,
): boolean {
  const b = a.boundingBox;
  const ax = b.x * w;
  const ay = b.y * h;
  const aw = b.width * w;
  const ah = b.height * h;
  const ix = Math.max(0, Math.min(ax + aw, p.x + p.w) - Math.max(ax, p.x));
  const iy = Math.max(0, Math.min(ay + ah, p.y + p.h) - Math.max(ay, p.y));
  return ix * iy > 0.25 * Math.min(aw * ah, p.w * p.h);
}

const cases: Array<[string, number, number, boolean, number]> = [];
for (const [label, w, h] of [
  ['portrait', 1080, 1920],
  ['landscape', 1080, 810],
] as const) {
  for (const lightBack of [true, false]) {
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      cases.push([`${label} ${lightBack ? 'light' : 'dark'} shelf #${seed}`, w, h, lightBack, seed]);
    }
  }
}

describe('hand-held re-shoot comparison', () => {
  it.each(cases)('%s', async (_label, w, h, lightBack, seed) => {
    const cv = await getCv();
    const scene = makeShelfScene(w, h, seed, lightBack);
    const pick = mulberry32(seed * 97);
    const removed: number[] = [];
    while (removed.length < 2) {
      const i = Math.floor(pick() * scene.products.length);
      if (!removed.includes(i)) removed.push(i);
    }
    const baseline = await jpegRoundTrip(renderShelf(scene));
    const motion = randomHandheld(seed, STRENGTH);
    const toCapture = handheldMatrix(motion, w, h);
    const truth = scene.products.map((p) => mapRect(toCapture, p));
    const frame = { width: w, height: h };

    const unchanged = await simulateHandheld(cv, renderShelf(scene), motion, seed);
    const same = analyzeAllTiers(cv, unchanged, baseline, scene.splits, frame, TOLERANCE);
    expect(same.anomalies.filter((a) => !a.dismissed)).toEqual([]);
    expect(Math.abs(same.standardCount - scene.products.length)).toBeLessThanOrEqual(1);

    const emptied = await simulateHandheld(cv, renderShelf(scene, removed), motion, seed + 500);
    const result = analyzeAllTiers(cv, emptied, baseline, scene.splits, frame, TOLERANCE);
    const active = result.anomalies.filter((a) => !a.dismissed);
    for (const i of removed) {
      expect(active.some((a) => a.type === 'MISSING' && overlaps(a, truth[i], w, h))).toBe(true);
    }
    expect(active.filter((a) => !removed.some((i) => overlaps(a, truth[i], w, h)))).toEqual([]);
    expect(result.missingCount).toBe(2);
  }, 120_000);
});
