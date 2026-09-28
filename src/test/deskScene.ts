import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { rasterFromRgba, type RasterFrame } from '../lib/vision/rasterFrame';
import { mulberry32 } from './syntheticShelf';

export interface DeskObject {
  x: number;
  y: number;
  w: number;
  h: number;
  /** RGB distance between the object's color and the desk under it. */
  contrast: number;
  shape: 'rect' | 'round' | 'ellipse';
  seed: number;
}

export interface DeskScene {
  width: number;
  height: number;
  seed: number;
  deskColor: [number, number, number];
  objects: DeskObject[];
}

/**
 * A cluttered, real-world-like scene: grained desk, static clutter (monitor with text, papers,
 * a leafy plant), and loose objects of controlled contrast that can be moved between shots.
 */
export function makeDeskScene(width: number, height: number, seed: number, contrasts: number[]): DeskScene {
  const rand = mulberry32(seed);
  const deskColor: [number, number, number] = rand() < 0.5 ? [150, 118, 86] : [92, 94, 100];
  const objects: DeskObject[] = [];
  const minDim = Math.min(width, height);
  let attempts = 0;
  while (objects.length < contrasts.length && attempts < 500) {
    attempts += 1;
    const w = minDim * (0.08 + rand() * 0.1);
    const h = minDim * (0.06 + rand() * 0.1);
    const x = width * 0.04 + rand() * (width * 0.92 - w);
    const y = height * 0.45 + rand() * (height * 0.5 - h);
    const pad = minDim * 0.03;
    if (objects.some((o) => x < o.x + o.w + pad && o.x < x + w + pad && y < o.y + o.h + pad && o.y < y + h + pad)) continue;
    const shapes = ['rect', 'round', 'ellipse'] as const;
    objects.push({ x, y, w, h, contrast: contrasts[objects.length], shape: shapes[Math.floor(rand() * 3)], seed: seed * 100 + objects.length });
  }
  return { width, height, seed, deskColor, objects };
}

/** A color at exactly `contrast` RGB distance from `base`, in a random direction. */
function colorAtDistance(base: [number, number, number], contrast: number, rand: () => number): [number, number, number] {
  for (let tries = 0; tries < 50; tries += 1) {
    const d = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
    const n = Math.hypot(d[0], d[1], d[2]) || 1;
    const c = base.map((v, i) => Math.round(v + (d[i] / n) * contrast)) as [number, number, number];
    if (c.every((v) => v >= 0 && v <= 255)) return c;
  }
  return base.map((v) => Math.max(0, Math.min(255, v + (v > 127 ? -contrast : contrast)))) as [number, number, number];
}

function shapePath(ctx: SKRSContext2D, o: { x: number; y: number; w: number; h: number; shape: DeskObject['shape'] }) {
  ctx.beginPath();
  if (o.shape === 'ellipse') {
    ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
  } else if (o.shape === 'round') {
    ctx.roundRect(o.x, o.y, o.w, o.h, Math.min(o.w, o.h) * 0.25);
  } else {
    ctx.rect(o.x, o.y, o.w, o.h);
  }
}

function drawBackground(ctx: SKRSContext2D, scene: DeskScene) {
  const { width, height, deskColor } = scene;
  const rand = mulberry32(scene.seed ^ 0x51ed);
  // Wall
  ctx.fillStyle = '#d9d4cb';
  ctx.fillRect(0, 0, width, height * 0.42);
  // Monitor with changing-free static text
  ctx.fillStyle = '#16181c';
  ctx.fillRect(width * 0.18, height * 0.06, width * 0.6, height * 0.3);
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = `hsl(${Math.floor(rand() * 360)} 50% ${55 + rand() * 30}%)`;
    ctx.fillRect(width * (0.2 + rand() * 0.05), height * (0.08 + i * 0.0065), width * (0.1 + rand() * 0.4), height * 0.003);
  }
  // Leafy plant (fine texture, a classic source of false positives)
  for (let i = 0; i < 160; i += 1) {
    ctx.fillStyle = `hsl(${100 + rand() * 40} 45% ${22 + rand() * 25}%)`;
    ctx.beginPath();
    ctx.ellipse(width * (0.86 + (rand() - 0.5) * 0.18), height * (0.2 + (rand() - 0.5) * 0.25), width * 0.02, width * 0.008, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Desk with grain and a lighting falloff
  const g = ctx.createLinearGradient(0, height * 0.42, width, height);
  g.addColorStop(0, `rgb(${deskColor.map((v) => v + 12).join(',')})`);
  g.addColorStop(1, `rgb(${deskColor.map((v) => v - 12).join(',')})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, height * 0.42, width, height * 0.58);
  ctx.strokeStyle = 'rgba(40,25,10,0.12)';
  for (let i = 0; i < 120; i += 1) {
    const y = height * 0.42 + rand() * height * 0.58;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(width * 0.3, y + (rand() - 0.5) * 30, width * 0.6, y + (rand() - 0.5) * 30, width, y + (rand() - 0.5) * 30);
    ctx.stroke();
  }
  // Static paper sheet with text
  ctx.fillStyle = '#f1efe8';
  ctx.fillRect(width * 0.02, height * 0.43, width * 0.22, height * 0.05);
  ctx.fillStyle = '#333';
  for (let i = 0; i < 6; i += 1) ctx.fillRect(width * 0.03, height * (0.435 + i * 0.007), width * 0.18 * (0.5 + rand() * 0.5), height * 0.002);
}

function drawObject(ctx: SKRSContext2D, scene: DeskScene, o: DeskObject, at: { x: number; y: number }) {
  const rand = mulberry32(o.seed);
  const color = colorAtDistance(scene.deskColor, o.contrast, rand);
  const placed = { ...o, ...at };
  // Soft contact shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = Math.min(o.w, o.h) * 0.15;
  ctx.shadowOffsetY = Math.min(o.w, o.h) * 0.06;
  ctx.fillStyle = `rgb(${color.join(',')})`;
  shapePath(ctx, placed);
  ctx.fill();
  ctx.restore();
  // Mild shading so the object is not perfectly flat
  const shade = ctx.createLinearGradient(placed.x, placed.y, placed.x + o.w, placed.y + o.h);
  shade.addColorStop(0, 'rgba(255,255,255,0.08)');
  shade.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = shade;
  shapePath(ctx, placed);
  ctx.fill();
}

/** Render with each object at its own position, or at `moved[i]` when given. */
export function renderDesk(scene: DeskScene, moved: Record<number, { x: number; y: number }> = {}): RasterFrame {
  const { width, height } = scene;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  drawBackground(ctx, scene);
  scene.objects.forEach((o, i) => drawObject(ctx, scene, o, moved[i] ?? { x: o.x, y: o.y }));
  const img = ctx.getImageData(0, 0, width, height);
  return rasterFromRgba(width, height, new Uint8ClampedArray(img.data));
}

/** Uneven re-lighting between shots: a smooth brightness ramp plus a white-balance shift. */
export function relight(frame: RasterFrame, seed: number, strength = 1): RasterFrame {
  const rand = mulberry32(seed * 131 + 7);
  const wb = [1 + (rand() - 0.5) * 0.12 * strength, 1 + (rand() - 0.5) * 0.06 * strength, 1 + (rand() - 0.5) * 0.12 * strength];
  const ramp = 0.12 * strength;
  const angle = rand() * Math.PI * 2;
  const out = new Uint8ClampedArray(frame.data);
  const { width, height } = frame;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = ((x / width - 0.5) * Math.cos(angle) + (y / height - 0.5) * Math.sin(angle));
      const gain = 1 + t * ramp;
      const i = (y * width + x) * 4;
      for (let k = 0; k < 3; k += 1) out[i + k] = out[i + k] * gain * wb[k];
    }
  }
  return rasterFromRgba(width, height, out);
}
