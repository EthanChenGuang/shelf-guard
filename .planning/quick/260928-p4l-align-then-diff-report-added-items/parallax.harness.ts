/**
 * @vitest-environment node
 */
import { ImageData } from '@napi-rs/canvas';
import { it } from 'vitest';
import { analyzeFrame, getCv } from './visionWorker';
import { jpegRoundTrip, randomHandheld, simulateHandheld } from '../test/syntheticShelf';
import { makeDeskScene, relight, renderDesk } from '../test/deskScene';
import { rasterFromRgba, type RasterFrame } from '../lib/vision/rasterFrame';
globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;
/** Near layer (desk, below the horizon) shifted/zoomed relative to the far layer: depth parallax. */
function parallax(f: RasterFrame, horizon: number, dx: number, zoom: number): RasterFrame {
  const { width: W, height: H } = f; const src = f.data; const out = new Uint8ClampedArray(src);
  const cx = W / 2, cy = H;
  for (let y = Math.floor(horizon * H); y < H; y++) for (let x = 0; x < W; x++) {
    const t = (y - horizon * H) / (H - horizon * H); // parallax grows toward the camera
    const sx = Math.round(cx + (x - cx) / (1 + zoom * t) - dx * t), sy = Math.round(cy + (y - cy) / (1 + zoom * t));
    if (sx < 0 || sx >= W || sy < horizon * H || sy >= H) continue;
    const i = (y * W + x) * 4, j = (sy * W + sx) * 4; out[i] = src[j]; out[i + 1] = src[j + 1]; out[i + 2] = src[j + 2];
  }
  return rasterFromRgba(W, H, out);
}
it('parallax', async () => {
  const cv = await getCv();
  for (const [dxPct, zoom] of [[0, 0], [0.005, 0.01], [0.01, 0.02], [0.02, 0.04], [0.03, 0.06]]) {
    let fp = 0, conf = 0, strong = 0; const n = 8;
    for (let seed = 1; seed <= n; seed++) {
      const [W, H] = seed % 2 ? [1080, 1920] : [1080, 810];
      const scene = makeDeskScene(W, H, seed, [35, 50, 70, 100]);
      const base = await jpegRoundTrip(renderDesk(scene));
      const shot = parallax(renderDesk(scene), 0.42, dxPct * W, zoom);
      const r = analyzeFrame(cv, relight(await simulateHandheld(cv, shot, randomHandheld(seed, 1), seed), seed), base, { width: W, height: H }, 50);
      fp += r.anomalies.length; conf += r.anomalies.filter((a) => a.score >= 0.85).length;
    }
    console.log(`PARALLAX shift ${(dxPct * 100).toFixed(1)}% zoom ${(zoom * 100).toFixed(0)}%: false alarms ${fp} in ${n} unchanged scenes (${conf} at >=85% confidence)`);
  }
}, 900000);
