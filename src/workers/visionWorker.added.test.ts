/**
 * @vitest-environment node
 *
 * Items put down between shots must be reported as added. Set ADDED_SEEDS=6 for the full sweep.
 */
import { ImageData } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { analyzeFrame, getCv } from './visionWorker';
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
import { makeDeskScene, relight, renderDesk } from '../test/deskScene';
import type { DetectedAnomaly } from '../types';

globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;

const SEEDS = Number(process.env.ADDED_SEEDS ?? 3);
const TOLERANCE = 50;
const SIZES = [
  [1080, 1920],
  [1080, 810],
];
const DESK_CONTRASTS = [35, 50, 70, 100];

type Rect = { x: number; y: number; w: number; h: number };

function overlaps(a: DetectedAnomaly, r: Rect, w: number, h: number): boolean {
  const b = a.boundingBox;
  const ax = b.x * w;
  const ay = b.y * h;
  const aw = b.width * w;
  const ah = b.height * h;
  const ix = Math.max(0, Math.min(ax + aw, r.x + r.w) - Math.max(ax, r.x));
  const iy = Math.max(0, Math.min(ay + ah, r.y + r.h) - Math.max(ay, r.y));
  return ix * iy > 0.2 * Math.min(aw * ah, r.w * r.h);
}

function typesOver(anomalies: DetectedAnomaly[], r: Rect, w: number, h: number): Set<DetectedAnomaly['type']> {
  return new Set(anomalies.filter((a) => overlaps(a, r, w, h)).map((a) => a.type));
}

describe('items added between shots', () => {
  it('reports products added to light and dark shelves as ADDED, not MISSING', async () => {
    const cv = await getCv();
    const wrong: string[] = [];
    for (const [W, H] of SIZES) {
      for (const light of [true, false]) {
        for (let seed = 1; seed <= SEEDS; seed += 1) {
          const scene = makeShelfScene(W, H, seed, light);
          const pick = mulberry32(seed * 131);
          const added: number[] = [];
          while (added.length < 2) {
            const i = Math.floor(pick() * scene.products.length);
            if (!added.includes(i)) added.push(i);
          }
          const motion = randomHandheld(seed, 1);
          const toC = handheldMatrix(motion, W, H);
          const baseline = await jpegRoundTrip(renderShelf(scene, added));
          const shot = await simulateHandheld(cv, renderShelf(scene), motion, seed + 500);
          const result = analyzeFrame(cv, shot, baseline, { width: W, height: H }, TOLERANCE);
          const where = `${W}x${H} ${light ? 'light' : 'dark'} seed ${seed}`;
          for (const i of added) {
            const types = typesOver(result.anomalies, mapRect(toC, scene.products[i]), W, H);
            if (!types.has('ADDED') || types.has('MISSING')) wrong.push(`${where} product ${i}: ${[...types]}`);
          }
          if (result.missingCount !== 0) wrong.push(`${where}: missingCount ${result.missingCount}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  }, 600_000);

  it('reports a new object on the desk as ADDED, not MISSING', async () => {
    const cv = await getCv();
    const wrong: string[] = [];
    for (const [W, H] of SIZES) {
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        const scene = makeDeskScene(W, H, seed, DESK_CONTRASTS);
        const extra = scene.objects.length - 1;
        const withoutExtra = { ...scene, objects: scene.objects.slice(0, extra) };
        const motion = randomHandheld(seed, 1);
        const toC = handheldMatrix(motion, W, H);
        const baseline = await jpegRoundTrip(renderDesk(withoutExtra));
        const shot = relight(await simulateHandheld(cv, renderDesk(scene), motion, seed + 500), seed + 3);
        const result = analyzeFrame(cv, shot, baseline, { width: W, height: H }, TOLERANCE);
        const o = scene.objects[extra];
        const types = typesOver(result.anomalies, mapRect(toC, { x: o.x, y: o.y, w: o.w, h: o.h }), W, H);
        if (!types.has('ADDED') || types.has('MISSING')) wrong.push(`${W}x${H} seed ${seed}: ${[...types]}`);
      }
    }
    expect(wrong).toEqual([]);
  }, 600_000);

  it('reports an object moved 2.5x its size as MOVED at both origin and destination', async () => {
    const cv = await getCv();
    const wrong: string[] = [];
    let evaluated = 0;
    for (const [W, H] of SIZES) {
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        const scene = makeDeskScene(W, H, seed, DESK_CONTRASTS);
        const i = scene.objects.findIndex((o) => o.contrast === 100);
        if (i < 0) continue;
        const o = scene.objects[i];
        const dist = 2.5 * Math.max(o.w, o.h);
        const rand = mulberry32(seed * 53);
        let dest: { x: number; y: number } | null = null;
        for (let t = 0; t < 60 && !dest; t += 1) {
          const ang = rand() * Math.PI * 2;
          const x = o.x + Math.cos(ang) * dist;
          const y = o.y + Math.sin(ang) * dist;
          if (x < W * 0.02 || x > W * 0.98 - o.w || y < H * 0.44 || y > H * 0.98 - o.h) continue;
          const clash = (p: Rect) => x < p.x + p.w && p.x < x + o.w && y < p.y + p.h && p.y < y + o.h;
          if (scene.objects.some((p) => clash(p))) continue;
          dest = { x, y };
        }
        if (!dest) continue;
        evaluated += 1;
        const motion = randomHandheld(seed, 1);
        const toC = handheldMatrix(motion, W, H);
        const baseline = await jpegRoundTrip(renderDesk(scene));
        const shot = relight(
          await simulateHandheld(cv, renderDesk(scene, { [i]: dest }), motion, seed + 500),
          seed + 3,
        );
        const result = analyzeFrame(cv, shot, baseline, { width: W, height: H }, TOLERANCE);
        const ends = {
          origin: mapRect(toC, { x: o.x, y: o.y, w: o.w, h: o.h }),
          destination: mapRect(toC, { x: dest.x, y: dest.y, w: o.w, h: o.h }),
        };
        for (const [name, rect] of Object.entries(ends)) {
          const types = typesOver(result.anomalies, rect, W, H);
          if (!types.has('MOVED') || types.has('MISSING') || types.has('ADDED')) {
            wrong.push(`${W}x${H} seed ${seed} ${name}: ${[...types]}`);
          }
        }
      }
    }
    expect(wrong).toEqual([]);
    expect(evaluated).toBeGreaterThanOrEqual(SEEDS);
  }, 600_000);
});
