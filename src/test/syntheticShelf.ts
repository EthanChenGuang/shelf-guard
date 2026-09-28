import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import type { CV } from '@techstark/opencv-js/dist/src/types/opencv';
import { rasterFromRgba, type RasterFrame } from '../lib/vision/rasterFrame';

export interface ShelfProduct {
  tier: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ShelfScene {
  width: number;
  height: number;
  splits: [number, number, number, number];
  products: ShelfProduct[];
  seed: number;
  lightBack: boolean;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lay out a 4-tier shelf with varied, textured products. */
export function makeShelfScene(
  width: number,
  height: number,
  seed: number,
  lightBack: boolean,
  splits: [number, number, number, number] = [0.27, 0.5, 0.73, 0.95],
): ShelfScene {
  const rand = mulberry32(seed);
  const products: ShelfProduct[] = [];
  for (let tier = 0; tier < 4; tier += 1) {
    const top = (tier === 0 ? 0.04 : splits[tier - 1]) * height;
    const bottom = splits[tier] * height - height * 0.015;
    let x = width * (0.03 + rand() * 0.02);
    while (x < width * 0.92) {
      const w = width * (0.08 + rand() * 0.07);
      const h = (bottom - top) * (0.55 + rand() * 0.35);
      if (x + w > width * 0.97) break;
      products.push({ tier, x, y: bottom - h, w, h });
      x += w + width * (0.015 + rand() * 0.03);
    }
  }
  return { width, height, splits, products, seed, lightBack };
}

function drawProduct(ctx: SKRSContext2D, p: ShelfProduct, rand: () => number): void {
  const hue = Math.floor(rand() * 360);
  const sat = 45 + Math.floor(rand() * 45);
  const light = 30 + Math.floor(rand() * 40);
  const grad = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
  grad.addColorStop(0, `hsl(${hue} ${sat}% ${light - 12}%)`);
  grad.addColorStop(0.45, `hsl(${hue} ${sat}% ${light + 10}%)`);
  grad.addColorStop(1, `hsl(${hue} ${sat}% ${light - 18}%)`);
  ctx.fillStyle = grad;
  if (rand() < 0.4) {
    // bottle: neck + body
    const neckW = p.w * 0.35;
    ctx.fillRect(p.x + (p.w - neckW) / 2, p.y, neckW, p.h * 0.25);
    ctx.fillRect(p.x, p.y + p.h * 0.22, p.w, p.h * 0.78);
  } else {
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // label panel with stripes and text
  ctx.fillStyle = `hsl(${(hue + 180) % 360} 30% ${rand() < 0.5 ? 90 : 15}%)`;
  const ly = p.y + p.h * (0.4 + rand() * 0.15);
  const lh = p.h * 0.28;
  ctx.fillRect(p.x + p.w * 0.1, ly, p.w * 0.8, lh);
  ctx.fillStyle = `hsl(${(hue + 90) % 360} 70% 45%)`;
  for (let i = 0; i < 3; i += 1) {
    ctx.fillRect(p.x + p.w * 0.12, ly + lh * (0.15 + i * 0.28), p.w * (0.3 + rand() * 0.45), lh * 0.1);
  }
  ctx.fillStyle = '#111';
  ctx.font = `bold ${Math.max(8, Math.round(p.w * 0.16))}px sans-serif`;
  ctx.fillText(String.fromCharCode(65 + Math.floor(rand() * 26)) + Math.floor(rand() * 90 + 10), p.x + p.w * 0.14, ly + lh * 0.95);
}

/** Render the scene, skipping `removed` product indices. */
export function renderShelf(scene: ShelfScene, removed: number[] = []): RasterFrame {
  const { width, height } = scene;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const back = ctx.createLinearGradient(0, 0, width, height);
  if (scene.lightBack) {
    back.addColorStop(0, '#e9e5dc');
    back.addColorStop(1, '#cfc9bc');
  } else {
    back.addColorStop(0, '#2a2622');
    back.addColorStop(1, '#171412');
  }
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, width, height);
  // Back-panel grain so empty slots are not perfectly flat.
  const grain = mulberry32(scene.seed ^ 0x9e3779b9);
  ctx.strokeStyle = scene.lightBack ? 'rgba(120,100,80,0.10)' : 'rgba(255,240,220,0.06)';
  for (let i = 0; i < 90; i += 1) {
    const y = grain() * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + (grain() - 0.5) * 40);
    ctx.stroke();
  }
  for (let tier = 0; tier < 4; tier += 1) {
    const y = scene.splits[tier] * height;
    ctx.fillStyle = scene.lightBack ? '#8d7355' : '#6b5134';
    ctx.fillRect(0, y - height * 0.015, width, height * 0.025);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, y + height * 0.01, width, height * 0.006);
  }
  scene.products.forEach((p, i) => {
    const rand = mulberry32(scene.seed * 1000 + i);
    if (!removed.includes(i)) drawProduct(ctx, p, rand);
  });
  const img = ctx.getImageData(0, 0, width, height);
  return rasterFromRgba(width, height, new Uint8ClampedArray(img.data));
}

export interface HandheldParams {
  rotationDeg: number;
  scale: number;
  tx: number;
  ty: number;
  px: number;
  py: number;
  gain: number;
  gamma: number;
  noise: number;
  blur: number;
}

export function randomHandheld(seed: number, strength = 1): HandheldParams {
  const r = mulberry32(seed * 7919 + 13);
  const s = (range: number) => (r() * 2 - 1) * range * strength;
  return {
    rotationDeg: s(3),
    scale: 1 + s(0.05),
    tx: s(0.04),
    ty: s(0.04),
    px: s(0.00004),
    py: s(0.00004),
    gain: 1 + s(0.22),
    gamma: 1 + s(0.15),
    noise: 2 + r() * 3,
    blur: r() * 1.2,
  };
}

/** Row-major 3x3 homography taking baseline pixels to hand-held capture pixels. */
export function handheldMatrix(p: HandheldParams, width: number, height: number): number[] {
  const cx = width / 2;
  const cy = height / 2;
  const a = (p.rotationDeg * Math.PI) / 180;
  const c = Math.cos(a) * p.scale;
  const s = Math.sin(a) * p.scale;
  const tx = p.tx * width + cx - (c * cx - s * cy);
  const ty = p.ty * height + cy - (s * cx + c * cy);
  return [c, -s, tx, s, c, ty, p.px, p.py, 1];
}

/** Axis-aligned bounds of a rect after applying `h`. */
export function mapRect(h: number[], r: { x: number; y: number; w: number; h: number }) {
  const pts = [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x + r.w, r.y + r.h],
    [r.x, r.y + r.h],
  ].map(([x, y]) => {
    const d = h[6] * x + h[7] * y + h[8];
    return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
  });
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Re-shoot a rendered frame as if hand-held: homography, exposure, noise, blur, JPEG. */
export async function simulateHandheld(
  cv: CV,
  frame: RasterFrame,
  p: HandheldParams,
  seed: number,
): Promise<RasterFrame> {
  const { width, height } = frame;
  const src = cv.matFromImageData(new ImageData(new Uint8ClampedArray(frame.data), width, height));
  const dst = new cv.Mat();
  const H = cv.matFromArray(3, 3, cv.CV_64F, handheldMatrix(p, width, height));
  try {
    cv.warpPerspective(src, dst, H, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_REFLECT);
    if (p.blur > 0.3) cv.GaussianBlur(dst, dst, new cv.Size(0, 0), p.blur);
    const out = new Uint8ClampedArray(dst.data);
    const rand = mulberry32(seed * 31337 + 7);
    for (let i = 0; i < out.length; i += 4) {
      for (let k = 0; k < 3; k += 1) {
        const v = Math.pow(out[i + k] / 255, p.gamma) * 255 * p.gain;
        out[i + k] = v + (rand() + rand() + rand() - 1.5) * p.noise * 2;
      }
    }
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(out, width, height) as never, 0, 0);
    const jpeg = await loadImage(canvas.encodeSync('jpeg', 85));
    const back = createCanvas(width, height);
    const bctx = back.getContext('2d');
    bctx.drawImage(jpeg, 0, 0);
    return rasterFromRgba(width, height, new Uint8ClampedArray(bctx.getImageData(0, 0, width, height).data));
  } finally {
    src.delete();
    dst.delete();
    H.delete();
  }
}

/** Plain JPEG round-trip (the baseline photo is also a JPEG). */
export async function jpegRoundTrip(frame: RasterFrame): Promise<RasterFrame> {
  const { width, height } = frame;
  const canvas = createCanvas(width, height);
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), width, height) as never, 0, 0);
  const jpeg = await loadImage(canvas.encodeSync('jpeg', 90));
  const back = createCanvas(width, height);
  const ctx = back.getContext('2d');
  ctx.drawImage(jpeg, 0, 0);
  return rasterFromRgba(width, height, new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data));
}
