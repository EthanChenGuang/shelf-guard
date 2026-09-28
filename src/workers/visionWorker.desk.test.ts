/**
 * @vitest-environment node
 *
 * Real-world-like re-shoot: a cluttered desk (monitor text, a leafy plant, white paper), loose
 * objects of controlled contrast moved between shots, a hand-held camera, and uneven lighting /
 * white balance that a global exposure match cannot undo. Everything is analyzed in one run, so a
 * result that depends on what was analyzed before (e.g. stale WASM memory views) also fails here.
 * Set DESK_SEEDS=10 locally for a deeper sweep.
 */
import { ImageData } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { analyzeFrame, getCv } from './visionWorker';
import { handheldMatrix, jpegRoundTrip, mapRect, mulberry32, randomHandheld, simulateHandheld } from '../test/syntheticShelf';
import { makeDeskScene, relight, renderDesk, type DeskScene } from '../test/deskScene';
import type { DetectedAnomaly } from '../types';

globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;

const SEEDS = Number(process.env.DESK_SEEDS ?? 4);
const CONTRASTS = [25, 35, 50, 70, 100];
const MOVES = [0.5, 1, 2];
const TOLERANCE = 50;

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

/** Move every object by 0.5x, 1x or 2x its size to a free spot on the desk. */
function moveObjects(scene: DeskScene, seed: number): Record<number, { x: number; y: number }> {
  const { width: W, height: H } = scene;
  const rand = mulberry32(seed * 77);
  const moved: Record<number, { x: number; y: number }> = {};
  scene.objects.forEach((o, i) => {
    const dist = MOVES[(i + seed) % MOVES.length] * Math.max(o.w, o.h);
    for (let t = 0; t < 30; t += 1) {
      const ang = rand() * Math.PI * 2;
      const x = o.x + Math.cos(ang) * dist;
      const y = o.y + Math.sin(ang) * dist;
      if (x < W * 0.02 || x + o.w > W * 0.98 || y < H * 0.44 || y + o.h > H * 0.98) continue;
      if (scene.objects.some((p, j) => j !== i && x < p.x + p.w && p.x < x + o.w && y < p.y + p.h && p.y < y + o.h)) continue;
      moved[i] = { x, y };
      break;
    }
  });
  return moved;
}

describe('desk re-shoot with moved objects and uneven lighting', () => {
  it('finds moved objects down to low contrast without false alarms', async () => {
    const cv = await getCv();
    const found = new Map<number, [number, number]>();
    const falseAlarms: string[] = [];
    const misses: string[] = [];

    for (const [W, H] of [
      [1080, 1920],
      [1080, 810],
    ]) {
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        const scene = makeDeskScene(W, H, seed, CONTRASTS);
        const moved = moveObjects(scene, seed);
        const motion = randomHandheld(seed, 1);
        const toCapture = handheldMatrix(motion, W, H);
        const frame = { width: W, height: H };
        const baseline = await jpegRoundTrip(renderDesk(scene));

        const unchanged = relight(await simulateHandheld(cv, renderDesk(scene), motion, seed), seed);
        for (const a of analyzeFrame(cv, unchanged, baseline, frame, TOLERANCE).anomalies) {
          falseAlarms.push(`${W}x${H} seed ${seed} unchanged: ${JSON.stringify(a.boundingBox)}`);
        }

        const shot = relight(await simulateHandheld(cv, renderDesk(scene, moved), motion, seed + 500), seed + 3);
        const result = analyzeFrame(cv, shot, baseline, frame, TOLERANCE);
        const changed: Rect[] = [];
        scene.objects.forEach((o, i) => {
          if (!moved[i]) return;
          const from = mapRect(toCapture, { x: o.x, y: o.y, w: o.w, h: o.h });
          const to = mapRect(toCapture, { x: moved[i].x, y: moved[i].y, w: o.w, h: o.h });
          changed.push(from, to);
          const hit = result.anomalies.some((a) => overlaps(a, from, W, H) || overlaps(a, to, W, H));
          const [n, total] = found.get(o.contrast) ?? [0, 0];
          found.set(o.contrast, [n + (hit ? 1 : 0), total + 1]);
          if (!hit) misses.push(`${W}x${H} seed ${seed} contrast ${o.contrast} object ${i}`);
        });
        for (const a of result.anomalies) {
          if (!changed.some((c) => overlaps(a, c, W, H))) {
            falseAlarms.push(`${W}x${H} seed ${seed} moved: ${JSON.stringify(a.boundingBox)}`);
          }
        }
      }
    }

    const rate = (c: number) => {
      const [n, total] = found.get(c)!;
      return n / total;
    };
    expect(falseAlarms).toEqual([]);
    expect(misses.filter((m) => !/contrast (25|35) /.test(m))).toEqual([]);
    expect(rate(35)).toBeGreaterThanOrEqual(0.85);
    // Barely visible (RGB distance 25): sits at the noise floor of the normal tolerance.
    expect(rate(25)).toBeGreaterThanOrEqual(0.3);
  }, 600_000);
});
