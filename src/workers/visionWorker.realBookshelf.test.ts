/**
 * @vitest-environment node
 *
 * Real hand-held re-shoot of a bookshelf: the camera moved a little between the shots and one
 * book was taken out. The book has a white top band and a busy photo cover and stood in front of
 * a plain light-gray shelf back, so where it was, the capture is flat gray that lies inside the
 * cover's local tone range — a change a per-pixel tolerant diff barely sees.
 */
import { createCanvas, ImageData, loadImage } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MIN_CONFIDENCE, meetsMinConfidence } from '../lib/vision/confidence';
import { analyzeFrame, getCv } from './visionWorker';
import type { DetectedAnomaly } from '../types';

globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;

const load = (name: string) => loadImage(fileURLToPath(new URL(`../test/fixtures/${name}.jpg`, import.meta.url)));

function raster(img: Awaited<ReturnType<typeof load>>, width: number, height: number) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return { width, height, data: new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data) };
}

/** Where the removed book stood, in pixels. */
const BOOK = { x: 303, y: 481, w: 93, h: 74 };

function overlapsBook(a: DetectedAnomaly, width: number, height: number): boolean {
  const b = a.boundingBox;
  const ix = Math.max(0, Math.min((b.x + b.width) * width, BOOK.x + BOOK.w) - Math.max(b.x * width, BOOK.x));
  const iy = Math.max(0, Math.min((b.y + b.height) * height, BOOK.y + BOOK.h) - Math.max(b.y * height, BOOK.y));
  return ix * iy > 0.3 * BOOK.w * BOOK.h;
}

describe('hand-held re-shoot of a bookshelf with one book taken out', () => {
  it('reports the missing book and nothing else', async () => {
    const cv = await getCv();
    const baselineImage = await load('bookshelf-baseline');
    const { width, height } = baselineImage;
    const baseline = raster(baselineImage, width, height);
    const capture = raster(await load('bookshelf-removed'), width, height);
    const { anomalies } = analyzeFrame(cv, capture, baseline, { width, height }, 50);

    const book = anomalies.find((a) => overlapsBook(a, width, height));
    expect(book?.type).toBe('MISSING');
    expect(meetsMinConfidence(book!, DEFAULT_MIN_CONFIDENCE)).toBe(true);
    expect(anomalies.filter((a) => a !== book)).toEqual([]);
  }, 60000);

  it('reports nothing when the baseline is compared with itself', async () => {
    const cv = await getCv();
    const baselineImage = await load('bookshelf-baseline');
    const { width, height } = baselineImage;
    const baseline = raster(baselineImage, width, height);
    expect(analyzeFrame(cv, baseline, baseline, { width, height }, 50).anomalies).toEqual([]);
  }, 60000);
});
