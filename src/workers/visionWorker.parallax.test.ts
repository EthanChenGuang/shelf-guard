/**
 * @vitest-environment node
 *
 * Real hand-held re-shoot of a desk in front of a window: the camera moved a little between the
 * shots, so the window, the shelves and the desk edge shift against each other (parallax) in a
 * way no single homography undoes. Between the shots a cup and a mouse were moved to the left
 * and a charger was put where the cup stood.
 */
import { createCanvas, ImageData, loadImage } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MIN_CONFIDENCE, meetsMinConfidence } from '../lib/vision/confidence';
import { analyzeFrame, getCv } from './visionWorker';
import type { DetectedAnomaly } from '../types';

globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;

const load = (name: string) => loadImage(fileURLToPath(new URL(`../test/fixtures/${name}.jpg`, import.meta.url)));

/** RGBA raster of `img` stretched to width x height, as the app sizes a capture to its baseline. */
function raster(img: Awaited<ReturnType<typeof load>>, width: number, height: number) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return { width, height, data: new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data) };
}

/** Normalized center of an anomaly lies inside the normalized rect. */
function centeredIn(a: DetectedAnomaly, x0: number, y0: number, x1: number, y1: number): boolean {
  const cx = a.boundingBox.x + a.boundingBox.width / 2;
  const cy = a.boundingBox.y + a.boundingBox.height / 2;
  return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
}

describe('hand-held re-shoot of a scene with depth', () => {
  it('reports what changed on the desk and nothing along the depth edges', async () => {
    const cv = await getCv();
    const baselineImage = await load('desk-parallax-baseline');
    const { width, height } = baselineImage;
    const baseline = raster(baselineImage, width, height);
    const capture = raster(await load('desk-parallax-capture'), width, height);
    const { anomalies } = analyzeFrame(cv, capture, baseline, { width, height }, 48);
    const shown = anomalies.filter((a) => meetsMinConfidence(a, DEFAULT_MIN_CONFIDENCE));

    // The window, clock, shelves and monitors above the desk did not change.
    expect(shown.filter((a) => centeredIn(a, 0, 0, 1, 0.6))).toEqual([]);
    // The cup's old spot, now holding a charger, reads as the cup gone.
    expect(shown.find((a) => centeredIn(a, 0.25, 0.65, 0.33, 0.9))?.type).toBe('MISSING');
    // The mouse's old spot on the mouse pad.
    expect(shown.find((a) => centeredIn(a, 0.62, 0.8, 0.7, 0.92))?.type).toBe('MISSING');
    expect(shown).toHaveLength(2);
    // The mouse's new spot is still found, below the default confidence bar.
    expect(anomalies.find((a) => centeredIn(a, 0.06, 0.8, 0.15, 0.95))?.type).toBe('ADDED');
  }, 60000);
});
