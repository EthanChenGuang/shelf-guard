import type { CV } from '@techstark/opencv-js/dist/src/types/opencv';
import { DetectedAnomaly } from '../types';
import { pixelRectToNormalized, stableAnomalyId } from '../lib/vision/bboxUtils';
import { classifyContourType, isLightingShift } from '../lib/vision/classifyContour';
import { computeComplianceStats } from '../lib/vision/complianceStats';
import { toleranceToDiffParams } from '../lib/vision/toleranceParams';
import { rasterFromImageBitmap, type RasterFrame } from '../lib/vision/rasterFrame';
import type { InspectionAnalysisResult } from '../lib/vision/resultTypes';
import { alignCapture, CLIPPED, mapRectToCapture, matchIllumination, matchPhotometry, warpToBaseline } from './alignment';

const MAX_ANOMALIES = 32;
/** Same offset the illumination model uses, so dark regions do not produce wild gains. */
const ILLUM_OFFSET = 10;
const MAX_BITMAP_WIDTH = 1080;
const MAX_BITMAP_HEIGHT = 1920;
const STANDARD_COUNT_FALLBACK = 24;

let cvInstance: CV | null = null;

async function loadOpenCvModule(): Promise<CV> {
  if (import.meta.env.VITEST) {
    const { loadCvForVitest } = await import('./opencvLoader.vitest');
    return loadCvForVitest();
  }

  const { loadOpenCvInWorker } = await import('./opencvLoader.browser');
  return loadOpenCvInWorker();
}

async function getCv(): Promise<CV> {
  if (cvInstance) return cvInstance;
  cvInstance = await loadOpenCvModule();
  return cvInstance;
}

function validateAnalyzePayload(data: Record<string, unknown>): void {
  const tol = Number(data.toleranceValue);
  if (!Number.isFinite(tol) || tol < 0 || tol > 100) {
    throw new Error('toleranceValue must be between 0 and 100');
  }
}

function rasterToMat(cv: CV, frame: RasterFrame): InstanceType<CV['Mat']> {
  const data = new Uint8ClampedArray(frame.data);
  const imageData = new ImageData(data, frame.width, frame.height);
  return cv.matFromImageData(imageData);
}

const FOREGROUND_MIN = 35;

/** Centroid of foreground pixels within a contour mask. */
function foregroundCentroidFromMask(
  cv: CV,
  gray: InstanceType<CV['Mat']>,
  mask: InstanceType<CV['Mat']>,
): { x: number; y: number } {
  const binary = new cv.Mat();
  const masked = new cv.Mat();
  try {
    cv.threshold(gray, binary, FOREGROUND_MIN, 255, cv.THRESH_BINARY);
    cv.bitwise_and(binary, mask, masked);
    const moments = cv.moments(masked, true);
    if (moments.m00 <= 0) {
      return { x: 0, y: 0 };
    }
    return { x: moments.m10 / moments.m00, y: moments.m01 / moments.m00 };
  } finally {
    binary.delete();
    masked.delete();
  }
}

const BACKDROP_DISTANCE = 45;
/** A coarse color covering at least this share of the photo is part of the shelf back. */
const BACKDROP_MIN_SHARE = 0.02;
/** Horizontal runs at least this wide are shelf boards or shadows, not products. */
const BOARD_RUN_FRACTION = 0.5;
/** Vertical gaps up to this share of the frame height (a label as dark/light as the back) are bridged. */
const LABEL_BRIDGE_FRACTION = 0.06;
const MIN_PRODUCT_SIDE_FRACTION = 0.025;

/**
 * Colors of the shelf back, most common first: every coarse color that covers a sizeable share
 * of the baseline, so a lighting gradient across the frame stays "back". No brightness-polarity
 * assumption, so light and dark shelves both work.
 */
function backdropPalette(planes: Mat[]): number[][] {
  const data = planes.map((p) => p.data as Uint8Array);
  const n = data[0].length;
  const bins = new Map<number, number>();
  for (let i = 0; i < n; i += 1) {
    const key = ((data[0][i] >> 4) << 8) | ((data[1][i] >> 4) << 4) | (data[2][i] >> 4);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  let modeKey = 0;
  let modeCount = -1;
  const keys: number[] = [];
  for (const [key, count] of bins) {
    if (count > modeCount) {
      modeKey = key;
      modeCount = count;
    }
    if (count >= n * BACKDROP_MIN_SHARE) keys.push(key);
  }
  const ordered = [modeKey, ...keys.filter((k) => k !== modeKey)];
  return ordered.map((k) => [((k >> 8) & 15) * 16 + 8, ((k >> 4) & 15) * 16 + 8, (k & 15) * 16 + 8]);
}

/** Per 6-bit-per-channel color: bit 1 = shelf back, bit 2 = unlike the dominant back color. */
function backdropLookup(palette: number[][]): Uint8Array {
  const lut = new Uint8Array(1 << 18);
  const t2 = BACKDROP_DISTANCE * BACKDROP_DISTANCE;
  for (let key = 0; key < lut.length; key += 1) {
    const rgb = [((key >> 12) << 2) + 2, (((key >> 6) & 63) << 2) + 2, ((key & 63) << 2) + 2];
    let flags = 0;
    for (let p = 0; p < palette.length; p += 1) {
      const c = palette[p];
      const d0 = rgb[0] - c[0];
      const d1 = rgb[1] - c[1];
      const d2 = rgb[2] - c[2];
      if (d0 * d0 + d1 * d1 + d2 * d2 <= t2) {
        flags |= 1;
        break;
      }
      if (p === 0) flags |= 2;
    }
    lut[key] = flags;
  }
  return lut;
}

/** Set every horizontal run of 255s at least `minRun` long in `src` to 255 in `dst`. */
function markLongRows(src: Uint8Array, dst: Uint8Array, rows: number, cols: number, minRun: number): void {
  for (let y = 0; y < rows; y += 1) {
    const row = y * cols;
    let start = -1;
    for (let x = 0; x <= cols; x += 1) {
      const on = x < cols && src[row + x] !== 0;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= minRun) dst.fill(255, row + start, row + x);
        start = -1;
      }
    }
  }
}

/** Fill vertical gaps shorter than `maxGap` that have 255 above and below (a 1xN closing). */
function bridgeColumns(mask: Uint8Array, rows: number, cols: number, maxGap: number): void {
  for (let x = 0; x < cols; x += 1) {
    let lastOn = -1;
    for (let y = 0; y < rows; y += 1) {
      if (mask[y * cols + x] === 0) continue;
      if (lastOn >= 0 && y - lastOn - 1 > 0 && y - lastOn - 1 < maxGap) {
        for (let g = lastOn + 1; g < y; g += 1) mask[g * cols + x] = 255;
      }
      lastOn = y;
    }
  }
}

/** 255 where a pixel belongs to an object in front of the shelf back (boards stripped). */
function objectMask(cv: CV, planes: Mat[], lookup: Uint8Array): Mat {
  const rows = planes[0].rows;
  const cols = planes[0].cols;
  const n = rows * cols;
  const mask = new cv.Mat(rows, cols, cv.CV_8UC1, new cv.Scalar(0));
  const cleanKernel = cv.getStructuringElement(
    cv.MORPH_RECT,
    new cv.Size(oddKernel(Math.min(rows, cols) * 0.006), oddKernel(Math.min(rows, cols) * 0.006)),
  );
  try {
    // Mat.data views into WASM memory go stale when a later allocation grows the heap: take them
    // only after every Mat above exists.
    const [r, g, b] = planes.map((p) => p.data as Uint8Array);
    const out = mask.data;
    // Anything unlike the dominant back color; its full-width runs are boards and shadows, even
    // when a board is common enough to be in the palette.
    const notDominant = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) {
      const flags = lookup[((r[i] >> 2) << 12) | ((g[i] >> 2) << 6) | (b[i] >> 2)];
      if (!(flags & 1)) out[i] = 255;
      if (flags & 2) notDominant[i] = 255;
    }
    // Strip boards after bridging, so a bridge across a board is cut again by its rows.
    bridgeColumns(out, rows, cols, oddKernel(rows * LABEL_BRIDGE_FRACTION));
    const boards = new Uint8Array(n);
    markLongRows(notDominant, boards, rows, cols, Math.max(3, Math.round(cols * BOARD_RUN_FRACTION)));
    for (let i = 0; i < n; i += 1) if (boards[i]) out[i] = 0;
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, cleanKernel);
    return mask;
  } finally {
    cleanKernel.delete();
  }
}

interface ObjectMap {
  /** CV_32S: 0 = shelf back, otherwise the id of the object the pixel belongs to. */
  labels: Mat;
  /** Objects big enough to be a product. */
  productCount: number;
}

/** Label the separate objects in `mask` (consumed) and count the product-sized ones. */
function labelObjects(cv: CV, mask: Mat): ObjectMap {
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const centroids = new cv.Mat();
  try {
    const n = cv.connectedComponentsWithStats(mask, labels, stats, centroids, 8, cv.CV_32S);
    const minSide = mask.cols * MIN_PRODUCT_SIDE_FRACTION;
    let productCount = 0;
    for (let i = 1; i < n; i += 1) {
      const w = stats.intAt(i, cv.CC_STAT_WIDTH);
      const h = stats.intAt(i, cv.CC_STAT_HEIGHT);
      if (w >= minSide && h >= minSide) productCount += 1;
    }
    return { labels, productCount };
  } finally {
    mask.delete();
    stats.delete();
    centroids.delete();
  }
}

type Mat = InstanceType<CV['Mat']>;

const REFERENCE_AREA = 1080 * 1920;
/** Smallest reportable change, as a fraction of the frame (half of a small object moved aside). */
const MIN_REGION_FRACTION = 0.001;

function oddKernel(n: number): number {
  const k = Math.max(3, Math.round(n));
  return k % 2 === 0 ? k + 1 : k;
}

/**
 * Per-pixel difference that forgives small residual misalignment: a pixel only counts as
 * changed if it falls outside the other image's local min/max range, in both directions.
 */
function tolerantDiff(cv: CV, a: Mat, b: Mat, kernelSize: number): Mat {
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize));
  const aMax = new cv.Mat();
  const aMin = new cv.Mat();
  const bMax = new cv.Mat();
  const bMin = new cv.Mat();
  const t1 = new cv.Mat();
  const t2 = new cv.Mat();
  const dA = new cv.Mat();
  const dB = new cv.Mat();
  const out = new cv.Mat();
  try {
    cv.dilate(a, aMax, kernel);
    cv.erode(a, aMin, kernel);
    cv.dilate(b, bMax, kernel);
    cv.erode(b, bMin, kernel);
    cv.subtract(a, bMax, t1);
    cv.subtract(bMin, a, t2);
    cv.max(t1, t2, dA);
    cv.subtract(b, aMax, t1);
    cv.subtract(aMin, b, t2);
    cv.max(t1, t2, dB);
    cv.min(dA, dB, out);
    return out;
  } finally {
    kernel.delete();
    aMax.delete();
    aMin.delete();
    bMax.delete();
    bMin.delete();
    t1.delete();
    t2.delete();
    dA.delete();
    dB.delete();
  }
}

/** 1 where a plane is blown out (at/near 255), widened to cover the 5x5 blur applied later. */
function clippedMask(cv: CV, plane: Mat): Uint8Array {
  const bin = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  try {
    cv.threshold(plane, bin, CLIPPED - 1, 1, cv.THRESH_BINARY);
    cv.dilate(bin, bin, kernel);
    return new Uint8Array(bin.data);
  } finally {
    bin.delete();
    kernel.delete();
  }
}

const CLIPPED_FLOOR_QUANTILE = 0.1;

/**
 * How bright the baseline is where the capture is blown out — mostly unchanged background, so a
 * low percentile is the tone from which the capture saturates.
 */
function clippedFloor(base: Uint8Array, clipC: Uint8Array, valid: Uint8Array): number {
  const hist = new Uint32Array(256);
  let total = 0;
  for (let i = 0; i < base.length; i += 1) {
    if (!clipC[i] || !valid[i]) continue;
    hist[base[i]] += 1;
    total += 1;
  }
  let seen = 0;
  for (let v = 0; v < 256; v += 1) {
    seen += hist[v];
    if (seen > total * CLIPPED_FLOOR_QUANTILE) return v;
  }
  return 255;
}

/**
 * A blown-out pixel only says "at least this bright", so it is evidence of change only where the
 * other photo is darker than that floor. Elsewhere the two are made to agree.
 */
function reconcileClipping(
  base: Uint8Array,
  cap: Uint8Array,
  clipB: Uint8Array,
  clipC: Uint8Array,
  capFloor: number,
): void {
  for (let i = 0; i < cap.length; i += 1) {
    if (clipC[i]) cap[i] = base[i] >= capFloor ? base[i] : capFloor;
    if (clipB[i] && cap[i] > base[i]) cap[i] = base[i];
  }
}

/**
 * Blurred R/G/B planes of both photos in the baseline frame, with each capture plane
 * exposure-matched to the baseline plane, plus the baseline relit to the capture's lighting.
 */
function alignedColorPlanes(
  cv: CV,
  baselineRgba: Mat,
  captureRgba: Mat,
  alignment: ReturnType<typeof alignCapture>,
): { base: Mat[]; baseLit: Mat[]; cap: Mat[] } {
  const bCh = new cv.MatVector();
  const cCh = new cv.MatVector();
  const blur = new cv.Size(5, 5);
  const base: Mat[] = [];
  const baseLit: Mat[] = [];
  const cap: Mat[] = [];
  try {
    cv.split(baselineRgba, bCh);
    cv.split(captureRgba, cCh);
    for (let ch = 0; ch < 3; ch += 1) {
      const b = new cv.Mat();
      cv.GaussianBlur(bCh.get(ch), b, blur, 0);
      const c = warpToBaseline(cv, cCh.get(ch), alignment);
      const clipB = clippedMask(cv, bCh.get(ch));
      const clipC = clippedMask(cv, c);
      matchPhotometry(cv, b, c, alignment.valid);
      cv.GaussianBlur(c, c, blur, 0);
      const lit = b.clone();
      const clipped = new Uint8Array(clipB.length);
      for (let i = 0; i < clipped.length; i += 1) clipped[i] = clipB[i] | clipC[i];
      matchIllumination(cv, lit, c, alignment.valid, clipped);
      reconcileClipping(lit.data, c.data, clipB, clipC, clippedFloor(lit.data, clipC, alignment.valid.data));
      base.push(b);
      baseLit.push(lit);
      cap.push(c);
    }
    return { base, baseLit, cap };
  } finally {
    bCh.delete();
    cCh.delete();
  }
}

/**
 * RGB distance of the per-plane tolerant diffs: a color change registers at its full strength
 * instead of only its largest single-channel component.
 */
function colorTolerantDiff(cv: CV, base: Mat[], cap: Mat[], kernelSize: number): Mat {
  const per = base.map((b, ch) => tolerantDiff(cv, b, cap[ch], kernelSize));
  const out = new cv.Mat(base[0].rows, base[0].cols, cv.CV_8UC1, new cv.Scalar(0));
  try {
    const o = out.data;
    const [r, g, bl] = per.map((m) => m.data);
    for (let i = 0; i < o.length; i += 1) {
      const d = Math.sqrt(r[i] * r[i] + g[i] * g[i] + bl[i] * bl[i]);
      o[i] = d > 255 ? 255 : d;
    }
    return out;
  } finally {
    per.forEach((m) => m.delete());
  }
}

/** Per-channel mean color inside `mask` minus inside `ring`. */
function colorRelation(cv: CV, planes: Mat[], mask: Mat, ring: Mat): number[] {
  return planes.map((plane) => (cv.mean(plane, mask)[0] ?? 0) - (cv.mean(plane, ring)[0] ?? 0));
}

/** Gradient magnitude map (8-bit) used to tell "product detail" from plain shelf back. */
function textureMap(cv: CV, gray: Mat): Mat {
  const gx = new cv.Mat();
  const gy = new cv.Mat();
  const ax = new cv.Mat();
  const ay = new cv.Mat();
  const out = new cv.Mat();
  try {
    cv.Sobel(gray, gx, cv.CV_16S, 1, 0, 3);
    cv.Sobel(gray, gy, cv.CV_16S, 0, 1, 3);
    cv.convertScaleAbs(gx, ax);
    cv.convertScaleAbs(gy, ay);
    cv.addWeighted(ax, 0.5, ay, 0.5, 0, out);
    return out;
  } finally {
    gx.delete();
    gy.delete();
    ax.delete();
    ay.delete();
  }
}

function regionStats(cv: CV, grayB: Mat, grayC: Mat, mask: Mat) {
  return {
    baselineMean: cv.mean(grayB, mask)[0] ?? 0,
    captureMean: cv.mean(grayC, mask)[0] ?? 0,
    baselineCentroid: foregroundCentroidFromMask(cv, grayB, mask),
    captureCentroid: foregroundCentroidFromMask(cv, grayC, mask),
  };
}

interface FrameInputs {
  colorB: Mat[];
  colorC: Mat[];
  grayB: Mat;
  grayC: Mat;
  diff: Mat;
  texB: Mat;
  texC: Mat;
  valid: Mat;
  objectsB: Mat;
  objectsC: Mat;
}

type Rect = { x: number; y: number; width: number; height: number };

type Fragment = { label: number; area: number; rect: Rect; objectB: number; objectC: number };

/** Most common non-zero object id under the fragment's pixels (0 if it covers only shelf back). */
function dominantObject(fragLabels: Int32Array, objects: Int32Array, cols: number, f: Omit<Fragment, 'objectB' | 'objectC'>): number {
  const votes = new Map<number, number>();
  for (let y = f.rect.y; y < f.rect.y + f.rect.height; y += 1) {
    for (let x = f.rect.x; x < f.rect.x + f.rect.width; x += 1) {
      const i = y * cols + x;
      if (fragLabels[i] !== f.label || objects[i] === 0) continue;
      votes.set(objects[i], (votes.get(objects[i]) ?? 0) + 1);
    }
  }
  let best = 0;
  let bestVotes = 0;
  for (const [id, n] of votes) {
    if (n > bestVotes) {
      best = id;
      bestVotes = n;
    }
  }
  return best;
}

/**
 * Merge diff fragments of one product: a removed item often splits into pieces around its label.
 * Pieces are merged only when they share columns and lie on the same object, so products
 * stacked on adjacent shelves stay separate.
 */
function groupFragments(fragments: Fragment[]): Fragment[][] {
  const parent = fragments.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < fragments.length; i += 1) {
    for (let j = i + 1; j < fragments.length; j += 1) {
      const a = fragments[i];
      const b = fragments[j];
      const overlapX = Math.min(a.rect.x + a.rect.width, b.rect.x + b.rect.width) - Math.max(a.rect.x, b.rect.x);
      const sameObject =
        (a.objectB !== 0 && a.objectB === b.objectB) || (a.objectC !== 0 && a.objectC === b.objectC);
      if (sameObject && overlapX >= 0.5 * Math.min(a.rect.width, b.rect.width)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Fragment[]>();
  fragments.forEach((f, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), f]);
  });
  return [...groups.values()];
}

function diffRegions(
  cv: CV,
  frame: FrameInputs,
  frameSize: { width: number; height: number },
  params: ReturnType<typeof toleranceToDiffParams>,
  toCapture: (rect: Rect) => Rect,
): DetectedAnomaly[] {
  const { grayB, grayC, diff, texB, texC, valid, colorB, colorC, objectsB, objectsC } = frame;
  const binary = new cv.Mat();
  const cleaned = new cv.Mat();
  const fragLabels = new cv.Mat();
  const fragStats = new cv.Mat();
  const fragCentroids = new cv.Mat();
  const minDim = Math.min(frameSize.width, frameSize.height);
  const openKernel = cv.getStructuringElement(
    cv.MORPH_RECT,
    new cv.Size(oddKernel(minDim * 0.006), oddKernel(minDim * 0.006)),
  );
  const closeKernel = cv.getStructuringElement(
    cv.MORPH_RECT,
    new cv.Size(oddKernel(minDim * 0.02), oddKernel(minDim * 0.02)),
  );
  const frameArea = frameSize.width * frameSize.height;
  const minArea = Math.max(
    params.minContourArea * (frameArea / REFERENCE_AREA),
    frameArea * MIN_REGION_FRACTION,
  );

  try {
    cv.threshold(diff, binary, params.diffThreshold, 255, cv.THRESH_BINARY);
    cv.bitwise_and(binary, valid, binary);
    cv.morphologyEx(binary, cleaned, cv.MORPH_OPEN, openKernel);
    cv.morphologyEx(cleaned, cleaned, cv.MORPH_CLOSE, closeKernel);
    const n = cv.connectedComponentsWithStats(cleaned, fragLabels, fragStats, fragCentroids, 8, cv.CV_32S);

    const cols = grayB.cols;
    // A copy, not a view: the WASM heap may grow while the groups below allocate masks.
    const labelData = new Int32Array(fragLabels.data32S);
    const fragments: Fragment[] = [];
    for (let label = 1; label < n; label += 1) {
      const area = fragStats.intAt(label, cv.CC_STAT_AREA);
      if (area < minArea * 0.25) continue;
      const rect = {
        x: fragStats.intAt(label, cv.CC_STAT_LEFT),
        y: fragStats.intAt(label, cv.CC_STAT_TOP),
        width: fragStats.intAt(label, cv.CC_STAT_WIDTH),
        height: fragStats.intAt(label, cv.CC_STAT_HEIGHT),
      };
      const base = { label, area, rect };
      fragments.push({
        ...base,
        objectB: dominantObject(labelData, objectsB.data32S, cols, base),
        objectC: dominantObject(labelData, objectsC.data32S, cols, base),
      });
    }

    const candidates: Array<{ area: number; anomaly: DetectedAnomaly }> = [];
    const ringKernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(oddKernel(minDim * 0.03), oddKernel(minDim * 0.03)),
    );

    try {
      for (const group of groupFragments(fragments)) {
        const area = group.reduce((sum, f) => sum + f.area, 0);
        if (area < minArea) continue;

        const mask = new cv.Mat(grayB.rows, grayB.cols, cv.CV_8UC1, new cv.Scalar(0));
        const ring = new cv.Mat();
        try {
          const maskData = mask.data;
          for (const f of group) {
            for (let y = f.rect.y; y < f.rect.y + f.rect.height; y += 1) {
              for (let x = f.rect.x; x < f.rect.x + f.rect.width; x += 1) {
                if (labelData[y * cols + x] === f.label) maskData[y * cols + x] = 255;
              }
            }
          }
          cv.dilate(mask, ring, ringKernel);
          cv.subtract(ring, mask, ring);
          cv.bitwise_and(ring, valid, ring);

          const hasRing = cv.countNonZero(ring) > 0;
          const relationB = hasRing ? colorRelation(cv, colorB, mask, ring) : [0, 0, 0];
          const relationC = hasRing ? colorRelation(cv, colorC, mask, ring) : [0, 0, 0];
          const region = regionStats(cv, grayB, grayC, mask);
          const gain = (region.captureMean + ILLUM_OFFSET) / (region.baselineMean + ILLUM_OFFSET);
          if (hasRing && isLightingShift(relationB, relationC, gain, cv.mean(diff, mask)[0] ?? 0, params.diffThreshold)) {
            continue;
          }
          const type = classifyContourType(
            {
              ...region,
              baselineTexture: cv.mean(texB, mask)[0] ?? 0,
              captureTexture: cv.mean(texC, mask)[0] ?? 0,
              baselineContrast: Math.hypot(...relationB),
              captureContrast: Math.hypot(...relationC),
            },
            params.displacementThresholdPx,
          );
          if (!type) continue;

          const x0 = Math.min(...group.map((f) => f.rect.x));
          const y0 = Math.min(...group.map((f) => f.rect.y));
          const x1 = Math.max(...group.map((f) => f.rect.x + f.rect.width));
          const y1 = Math.max(...group.map((f) => f.rect.y + f.rect.height));
          const captureRect = toCapture({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
          const bbox = pixelRectToNormalized(captureRect, frameSize.width, frameSize.height);
          candidates.push({
            area,
            anomaly: {
              id: stableAnomalyId(bbox),
              type,
              title: type === 'MISSING' ? 'Missing' : 'Moved',
              score: Math.min(1, area / (minArea * 4)),
              boundingBox: bbox,
              dismissed: false,
              ...(type === 'MOVED' ? { displacementNote: 'detected shift' } : {}),
            },
          });
        } finally {
          mask.delete();
          ring.delete();
        }
      }
    } finally {
      ringKernel.delete();
    }

    candidates.sort((a, b) => b.area - a.area);
    return candidates.slice(0, MAX_ANOMALIES).map((c) => c.anomaly);
  } finally {
    binary.delete();
    cleaned.delete();
    fragLabels.delete();
    fragStats.delete();
    fragCentroids.delete();
    openKernel.delete();
    closeKernel.delete();
  }
}

function analyzeFrame(
  cv: CV,
  captureFrame: RasterFrame,
  baselineFrame: RasterFrame,
  frameSize: { width: number; height: number },
  toleranceValue: number,
): InspectionAnalysisResult {
  const params = toleranceToDiffParams(toleranceValue);
  const baselineMat = rasterToMat(cv, baselineFrame);
  const captureMat = rasterToMat(cv, captureFrame);
  const rawB = new cv.Mat();
  const rawC = new cv.Mat();
  const grayB = new cv.Mat();
  const grayC = new cv.Mat();
  let alignment: ReturnType<typeof alignCapture> | null = null;
  let diff: Mat | null = null;
  let texB: Mat | null = null;
  let texC: Mat | null = null;
  let planes: ReturnType<typeof alignedColorPlanes> | null = null;
  let objectsB: ObjectMap | null = null;
  let objectsC: ObjectMap | null = null;

  try {
    cv.cvtColor(baselineMat, rawB, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(captureMat, rawC, cv.COLOR_RGBA2GRAY);
    alignment = alignCapture(cv, rawB, rawC);
    const blur = new cv.Size(5, 5);
    cv.GaussianBlur(rawB, grayB, blur, 0);
    cv.GaussianBlur(alignment.alignedGray, grayC, blur, 0);
    matchIllumination(cv, grayB, grayC, alignment.valid);
    const minDim = Math.min(frameSize.width, frameSize.height);
    planes = alignedColorPlanes(cv, baselineMat, captureMat, alignment);
    diff = colorTolerantDiff(cv, planes.baseLit, planes.cap, oddKernel(minDim * 0.012));
    texB = textureMap(cv, grayB);
    texC = textureMap(cv, grayC);
    const inverse = alignment.inverse;
    const toCapture = (rect: Rect) => mapRectToCapture(inverse, rect, frameSize);

    const lookup = backdropLookup(backdropPalette(planes.base));
    objectsB = labelObjects(cv, objectMask(cv, planes.base, lookup));
    const captureObjects = objectMask(cv, planes.cap, lookup);
    cv.bitwise_and(captureObjects, alignment.valid, captureObjects);
    objectsC = labelObjects(cv, captureObjects);

    const anomalies = diffRegions(
      cv,
      {
        grayB,
        grayC,
        diff,
        texB,
        texC,
        valid: alignment.valid,
        colorB: planes.baseLit,
        colorC: planes.cap,
        objectsB: objectsB.labels,
        objectsC: objectsC.labels,
      },
      frameSize,
      params,
      toCapture,
    );
    let standardCount = objectsB.productCount;
    if (standardCount <= 0) standardCount = STANDARD_COUNT_FALLBACK;

    const stats = computeComplianceStats(anomalies, standardCount);
    return {
      anomalies,
      complianceRate: stats.complianceRate,
      standardCount,
      actualCount: stats.actualCount,
      displacedCount: stats.displacedCount,
      missingCount: stats.missingCount,
    };
  } finally {
    baselineMat.delete();
    captureMat.delete();
    rawB.delete();
    rawC.delete();
    grayB.delete();
    grayC.delete();
    diff?.delete();
    texB?.delete();
    texC?.delete();
    alignment?.alignedGray.delete();
    alignment?.valid.delete();
    alignment?.inverse?.delete();
    alignment?.forward?.delete();
    planes?.base.forEach((m) => m.delete());
    planes?.baseLit.forEach((m) => m.delete());
    planes?.cap.forEach((m) => m.delete());
    objectsB?.labels.delete();
    objectsC?.labels.delete();
  }
}

export type VisionWorkerRequest =
  | { requestId?: number; type: 'init' }
  | {
      requestId?: number;
      type: 'analyze';
      captureBitmap: ImageBitmap;
      baselineBitmap: ImageBitmap;
      toleranceValue: number;
    };

if (typeof self !== 'undefined' && 'onmessage' in self) {
  self.onmessage = async (event: MessageEvent<VisionWorkerRequest>) => {
    const data = event.data;
    const requestId = data?.requestId;
    if (data?.type === 'init') {
      try {
        await getCv();
        self.postMessage({ requestId, type: 'ready' });
      } catch (err) {
        self.postMessage({
          requestId,
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }
    if (data?.type !== 'analyze') return;

    try {
      validateAnalyzePayload(data as unknown as Record<string, unknown>);
      if (!(data.captureBitmap instanceof ImageBitmap) || !(data.baselineBitmap instanceof ImageBitmap)) {
        throw new Error('captureBitmap and baselineBitmap must be ImageBitmap instances');
      }
      if (
        data.captureBitmap.width !== data.baselineBitmap.width ||
        data.captureBitmap.height !== data.baselineBitmap.height
      ) {
        throw new Error(
          `Bitmap size mismatch: capture ${data.captureBitmap.width}x${data.captureBitmap.height}, ` +
            `baseline ${data.baselineBitmap.width}x${data.baselineBitmap.height}`,
        );
      }
      if (
        data.captureBitmap.width > MAX_BITMAP_WIDTH ||
        data.captureBitmap.height > MAX_BITMAP_HEIGHT
      ) {
        throw new Error('ImageBitmap dimensions exceed allowed maximum');
      }

      const cv = await getCv();
      const [captureFrame, baselineFrame] = await Promise.all([
        rasterFromImageBitmap(data.captureBitmap),
        rasterFromImageBitmap(data.baselineBitmap),
      ]);

      const frameSize = { width: captureFrame.width, height: captureFrame.height };
      const result = analyzeFrame(cv, captureFrame, baselineFrame, frameSize, data.toleranceValue);

      data.captureBitmap.close();
      data.baselineBitmap.close();
      self.postMessage({ requestId, type: 'result', payload: result });
    } catch (err) {
      try {
        data.captureBitmap?.close?.();
        data.baselineBitmap?.close?.();
      } catch {
        // ignore close errors
      }
      self.postMessage({
        requestId,
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

export { analyzeFrame, getCv, validateAnalyzePayload };
