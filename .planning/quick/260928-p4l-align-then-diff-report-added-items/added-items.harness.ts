/**
 * @vitest-environment node
 */
import { ImageData } from '@napi-rs/canvas';
import { it } from 'vitest';
import { analyzeFrame, getCv } from './visionWorker';
import { handheldMatrix, jpegRoundTrip, makeShelfScene, mapRect, mulberry32, randomHandheld, renderShelf, simulateHandheld } from '../test/syntheticShelf';
import { makeDeskScene, relight, renderDesk } from '../test/deskScene';
globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;
type R = { x: number; y: number; w: number; h: number };
const hit = (b: { x: number; y: number; width: number; height: number }, r: R, W: number, H: number) => {
  const ax = b.x * W, ay = b.y * H, aw = b.width * W, ah = b.height * H;
  const ix = Math.max(0, Math.min(ax + aw, r.x + r.w) - Math.max(ax, r.x)), iy = Math.max(0, Math.min(ay + ah, r.y + r.h) - Math.max(ay, r.y));
  return ix * iy > 0.2 * Math.min(aw * ah, r.w * r.h);
};
it('added items', async () => {
  const cv = await getCv();
  const tally: Record<string, number> = {};
  const bump = (k: string) => (tally[k] = (tally[k] ?? 0) + 1);
  // Shelf: products present only in the capture ("added") — baseline rendered without them.
  for (const [W, H] of [[1080, 1920], [1080, 810]]) for (const light of [true, false]) for (let seed = 1; seed <= 6; seed++) {
    const scene = makeShelfScene(W, H, seed, light);
    const pick = mulberry32(seed * 131); const added: number[] = [];
    while (added.length < 2) { const i = Math.floor(pick() * scene.products.length); if (!added.includes(i)) added.push(i); }
    const motion = randomHandheld(seed, 1); const toC = handheldMatrix(motion, W, H);
    const base = await jpegRoundTrip(renderShelf(scene, added));
    const r = analyzeFrame(cv, await simulateHandheld(cv, renderShelf(scene), motion, seed + 500), base, { width: W, height: H }, 50);
    for (const i of added) { const a = r.anomalies.find((x) => hit(x.boundingBox, mapRect(toC, scene.products[i]), W, H)); bump(`shelf-${light ? 'light' : 'dark'} added → ${a ? a.type : 'NOT FOUND'}`); }
  }
  // Desk: a new object put down where there was only desk.
  for (const [W, H] of [[1080, 1920], [1080, 810]]) for (let seed = 1; seed <= 6; seed++) {
    const scene = makeDeskScene(W, H, seed, [35, 50, 70, 100]);
    const extra = scene.objects.length - 1;
    const withoutExtra = { ...scene, objects: scene.objects.slice(0, extra) };
    const motion = randomHandheld(seed, 1); const toC = handheldMatrix(motion, W, H);
    const base = await jpegRoundTrip(renderDesk(withoutExtra));
    const r = analyzeFrame(cv, relight(await simulateHandheld(cv, renderDesk(scene), motion, seed + 500), seed + 3), base, { width: W, height: H }, 50);
    const o = scene.objects[extra];
    const a = r.anomalies.find((x) => hit(x.boundingBox, mapRect(toC, { x: o.x, y: o.y, w: o.w, h: o.h }), W, H));
    bump(`desk c${o.contrast} added → ${a ? a.type : 'NOT FOUND'}`);
  }
  console.log('TALLY', JSON.stringify(tally, null, 1));
}, 900000);
