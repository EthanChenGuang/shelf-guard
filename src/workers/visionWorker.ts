import type { CV } from '@techstark/opencv-js/dist/src/types/opencv';
import { DetectedAnomaly } from '../types';
import { pixelRectToNormalized, stableAnomalyId } from '../lib/vision/bboxUtils';
import { classifyContourType } from '../lib/vision/classifyContour';
import { computeComplianceStats } from '../lib/vision/complianceStats';
import { toleranceToDiffParams } from '../lib/vision/toleranceParams';
import { tierBoundsFromSplits, validateSplitYPercentages } from '../lib/vision/tierGeometry';
import { rasterFromImageBitmap, type RasterFrame } from '../lib/vision/rasterFrame';
import type { InspectionAnalysisResult } from '../lib/vision/resultTypes';
import { alignCapture, mapRectToCapture, matchPhotometry, warpToBaseline } from './alignment';

const MAX_ANOMALIES_PER_TIER = 8;
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
  const { splitYPercentages, toleranceValue } = data;
  if (!validateSplitYPercentages(splitYPercentages)) {
    throw new Error(
      'splitYPercentages must be 4 monotonically increasing values in (0, 1]',
    );
  }
  const tol = Number(toleranceValue);
  if (!Number.isFinite(tol) || tol < 0 || tol > 100) {
    throw new Error('toleranceValue must be between 0 and 100');
  }
}

function rasterToMat(cv: CV, frame: RasterFrame): InstanceType<CV['Mat']> {
  const data = new Uint8ClampedArray(frame.data);
  const imageData = new ImageData(data, frame.width, frame.height);
  return cv.matFromImageData(imageData);
}

function cropMat(
  cv: CV,
  source: InstanceType<CV['Mat']>,
  rect: { x: number; y: number; width: number; height: number },
): InstanceType<CV['Mat']> {
  const roi = new cv.Rect(rect.x, rect.y, rect.width, rect.height);
  return source.roi(roi);
}

const FOREGROUND_MIN = 35;

/** Centroid of foreground pixels within a contour mask (tier-local coordinates). */
function foregroundCentroidFromMask(
  cv: CV,
  gray: InstanceType<CV['Mat']>,
  mask: InstanceType<CV['Mat']>,
  offset: { x: number; y: number },
): { x: number; y: number } {
  const binary = new cv.Mat();
  const masked = new cv.Mat();
  try {
    cv.threshold(gray, binary, FOREGROUND_MIN, 255, cv.THRESH_BINARY);
    cv.bitwise_and(binary, mask, masked);
    const moments = cv.moments(masked, true);
    if (moments.m00 <= 0) {
      return { x: offset.x, y: offset.y };
    }
    return {
      x: offset.x + moments.m10 / moments.m00,
      y: offset.y + moments.m01 / moments.m00,
    };
  } finally {
    binary.delete();
    masked.delete();
  }
}

const BACKDROP_DISTANCE = 45;
const PRODUCT_COLUMN_FILL = 0.4;
const MIN_PRODUCT_WIDTH_FRACTION = 0.025;
const MAX_PRODUCT_GAP_FRACTION = 0.006;

/**
 * Count products in one tier: estimate the back-panel color as the tier's dominant color, mark
 * pixels clearly unlike it, then count runs of columns that are mostly "not back panel".
 * Works for light and dark shelves alike (no brightness-polarity assumption).
 */
function countTierProducts(cv: CV, planes: Mat[], frameWidth: number): number {
  const data = planes.map((plane) => {
    // ROI views are strided; copyTo yields a packed buffer (roi().clone() does not in opencv.js).
    const copy = new cv.Mat();
    plane.copyTo(copy);
    const bytes = new Uint8Array(copy.data);
    copy.delete();
    return bytes;
  });
  const width = planes[0].cols;
  const height = planes[0].rows;
  if (width === 0 || height === 0) return 0;

  // Back panel = the most common coarse color in the tier's middle rows (products vary, the
  // panel doesn't; the top/bottom rows are dominated by shelf boards).
  const bins = new Map<number, number>();
  const midStart = Math.floor(height * 0.2) * width;
  const midEnd = Math.ceil(height * 0.8) * width;
  for (let i = midStart; i < midEnd; i += 1) {
    const key = ((data[0][i] >> 4) << 8) | ((data[1][i] >> 4) << 4) | (data[2][i] >> 4);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  let modeKey = 0;
  let modeCount = -1;
  for (const [key, n] of bins) {
    if (n > modeCount) {
      modeKey = key;
      modeCount = n;
    }
  }
  const backdrop = [((modeKey >> 8) & 15) * 16 + 8, ((modeKey >> 4) & 15) * 16 + 8, (modeKey & 15) * 16 + 8];

  const threshold2 = BACKDROP_DISTANCE * BACKDROP_DISTANCE;
  const productColumn: boolean[] = [];
  for (let x = 0; x < width; x += 1) {
    let filled = 0;
    for (let y = 0; y < height; y += 1) {
      const i = y * width + x;
      let d2 = 0;
      for (let ch = 0; ch < data.length; ch += 1) {
        const d = data[ch][i] - backdrop[ch];
        d2 += d * d;
      }
      if (d2 > threshold2) filled += 1;
    }
    productColumn.push(filled / height > PRODUCT_COLUMN_FILL);
  }

  const minWidth = frameWidth * MIN_PRODUCT_WIDTH_FRACTION;
  const maxGap = frameWidth * MAX_PRODUCT_GAP_FRACTION;
  let count = 0;
  let runStart = -1;
  let lastProduct = -Infinity;
  const closeRun = (end: number) => {
    if (runStart >= 0 && end - runStart >= minWidth) count += 1;
    runStart = -1;
  };
  for (let x = 0; x < width; x += 1) {
    if (!productColumn[x]) continue;
    if (runStart < 0) runStart = x;
    else if (x - lastProduct > maxGap) {
      closeRun(lastProduct + 1);
      runStart = x;
    }
    lastProduct = x;
  }
  closeRun(lastProduct + 1);
  return count;
}

type Mat = InstanceType<CV['Mat']>;

const REFERENCE_AREA = 1080 * 1920;
/** Smallest reportable change, as a fraction of the frame (a product is ~1% or more). */
const MIN_REGION_FRACTION = 0.0015;

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

/**
 * Blurred R/G/B planes of both photos in the baseline frame, with each capture plane
 * exposure-matched to the baseline plane.
 */
function alignedColorPlanes(
  cv: CV,
  baselineRgba: Mat,
  captureRgba: Mat,
  alignment: ReturnType<typeof alignCapture>,
): { base: Mat[]; cap: Mat[] } {
  const bCh = new cv.MatVector();
  const cCh = new cv.MatVector();
  const blur = new cv.Size(5, 5);
  const base: Mat[] = [];
  const cap: Mat[] = [];
  try {
    cv.split(baselineRgba, bCh);
    cv.split(captureRgba, cCh);
    for (let ch = 0; ch < 3; ch += 1) {
      const b = new cv.Mat();
      cv.GaussianBlur(bCh.get(ch), b, blur, 0);
      const c = warpToBaseline(cv, cCh.get(ch), alignment);
      matchPhotometry(cv, b, c, alignment.valid);
      cv.GaussianBlur(c, c, blur, 0);
      base.push(b);
      cap.push(c);
    }
    return { base, cap };
  } finally {
    bCh.delete();
    cCh.delete();
  }
}

/** Max over color planes of the tolerant diff, so hue-only changes still register. */
function colorTolerantDiff(cv: CV, base: Mat[], cap: Mat[], kernelSize: number): Mat {
  const out = new cv.Mat(base[0].rows, base[0].cols, cv.CV_8UC1, new cv.Scalar(0));
  for (let ch = 0; ch < base.length; ch += 1) {
    const d = tolerantDiff(cv, base[ch], cap[ch], kernelSize);
    cv.max(out, d, out);
    d.delete();
  }
  return out;
}

/** Euclidean RGB distance between the mean color inside `mask` and inside `ring`. */
function colorContrast(cv: CV, planes: Mat[], mask: Mat, ring: Mat): number {
  let sum = 0;
  for (const plane of planes) {
    const d = (cv.mean(plane, mask)[0] ?? 0) - (cv.mean(plane, ring)[0] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
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

type Fragment = { index: number; area: number; rect: { x: number; y: number; width: number; height: number } };

/**
 * Merge diff fragments that belong to one product: a removed item often splits into pieces
 * around its label, all sharing the same column within the tier.
 */
function groupFragments(fragments: Fragment[]): Fragment[][] {
  const parent = fragments.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < fragments.length; i += 1) {
    for (let j = i + 1; j < fragments.length; j += 1) {
      const a = fragments[i].rect;
      const b = fragments[j].rect;
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      if (overlapX >= 0.5 * Math.min(a.width, b.width)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Fragment[]>();
  fragments.forEach((f, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), f]);
  });
  return [...groups.values()];
}

function regionStats(cv: CV, grayB: Mat, grayC: Mat, mask: Mat) {
  return {
    baselineMean: cv.mean(grayB, mask)[0] ?? 0,
    captureMean: cv.mean(grayC, mask)[0] ?? 0,
    baselineCentroid: foregroundCentroidFromMask(cv, grayB, mask, { x: 0, y: 0 }),
    captureCentroid: foregroundCentroidFromMask(cv, grayC, mask, { x: 0, y: 0 }),
  };
}

interface TierInputs {
  colorB: Mat[];
  colorC: Mat[];
  grayB: Mat;
  grayC: Mat;
  diff: Mat;
  texB: Mat;
  texC: Mat;
  valid: Mat;
}

function diffTier(
  cv: CV,
  tier: TierInputs,
  tierIndex: 0 | 1 | 2 | 3,
  tierOffset: { x: number; y: number },
  frameSize: { width: number; height: number },
  params: ReturnType<typeof toleranceToDiffParams>,
  toCapture: (rect: { x: number; y: number; width: number; height: number }) => {
    x: number;
    y: number;
    width: number;
    height: number;
  },
): DetectedAnomaly[] {
  const { grayB, grayC, diff, texB, texC, valid, colorB, colorC } = tier;
  const binary = new cv.Mat();
  const cleaned = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
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
    cv.findContours(cleaned, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const fragments: Array<{ index: number; area: number; rect: { x: number; y: number; width: number; height: number } }> = [];
    for (let i = 0; i < contours.size(); i += 1) {
      const area = cv.contourArea(contours.get(i));
      if (area < minArea * 0.25) continue;
      const r = cv.boundingRect(contours.get(i));
      fragments.push({ index: i, area, rect: { x: r.x, y: r.y, width: r.width, height: r.height } });
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
          for (const f of group) cv.drawContours(mask, contours, f.index, new cv.Scalar(255), -1);
          cv.dilate(mask, ring, ringKernel);
          cv.subtract(ring, mask, ring);
          cv.bitwise_and(ring, valid, ring);

          const stats = regionStats(cv, grayB, grayC, mask);
          const hasRing = cv.countNonZero(ring) > 0;
          const type = classifyContourType(
            {
              ...stats,
              baselineTexture: cv.mean(texB, mask)[0] ?? 0,
              captureTexture: cv.mean(texC, mask)[0] ?? 0,
              baselineContrast: hasRing ? colorContrast(cv, colorB, mask, ring) : 0,
              captureContrast: hasRing ? colorContrast(cv, colorC, mask, ring) : 0,
            },
            params.displacementThresholdPx,
          );
          if (!type) continue;

          const x0 = Math.min(...group.map((f) => f.rect.x));
          const y0 = Math.min(...group.map((f) => f.rect.y));
          const x1 = Math.max(...group.map((f) => f.rect.x + f.rect.width));
          const y1 = Math.max(...group.map((f) => f.rect.y + f.rect.height));
          const captureRect = toCapture({
            x: tierOffset.x + x0,
            y: tierOffset.y + y0,
            width: x1 - x0,
            height: y1 - y0,
          });
          const bbox = pixelRectToNormalized(captureRect, frameSize.width, frameSize.height);
          candidates.push({
            area,
            anomaly: {
              id: stableAnomalyId(tierIndex, bbox),
              rowIndex: tierIndex,
              type,
              title: type === 'MISSING' ? `Tier ${tierIndex + 1} missing` : `Tier ${tierIndex + 1} moved`,
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
    return candidates.slice(0, MAX_ANOMALIES_PER_TIER).map((c) => c.anomaly);
  } finally {
    binary.delete();
    cleaned.delete();
    contours.delete();
    hierarchy.delete();
    openKernel.delete();
    closeKernel.delete();
  }
}

function analyzeAllTiers(
  cv: CV,
  captureFrame: RasterFrame,
  baselineFrame: RasterFrame,
  splitYPercentages: [number, number, number, number],
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
  let planes: { base: Mat[]; cap: Mat[] } | null = null;

  try {
    cv.cvtColor(baselineMat, rawB, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(captureMat, rawC, cv.COLOR_RGBA2GRAY);
    alignment = alignCapture(cv, rawB, rawC);
    const blur = new cv.Size(5, 5);
    cv.GaussianBlur(rawB, grayB, blur, 0);
    cv.GaussianBlur(alignment.alignedGray, grayC, blur, 0);
    const minDim = Math.min(frameSize.width, frameSize.height);
    planes = alignedColorPlanes(cv, baselineMat, captureMat, alignment);
    diff = colorTolerantDiff(cv, planes.base, planes.cap, oddKernel(minDim * 0.012));
    texB = textureMap(cv, grayB);
    texC = textureMap(cv, grayC);
    const inverse = alignment.inverse;
    const toCapture = (rect: { x: number; y: number; width: number; height: number }) =>
      mapRectToCapture(inverse, rect, frameSize);

    let standardCount = 0;
    const anomalies: DetectedAnomaly[] = [];

    for (let tierIndex = 0; tierIndex < 4; tierIndex += 1) {
      const bounds = tierBoundsFromSplits(
        splitYPercentages,
        frameSize,
        tierIndex as 0 | 1 | 2 | 3,
      );
      const tier: TierInputs = {
        grayB: cropMat(cv, grayB, bounds),
        grayC: cropMat(cv, grayC, bounds),
        diff: cropMat(cv, diff, bounds),
        texB: cropMat(cv, texB, bounds),
        texC: cropMat(cv, texC, bounds),
        valid: cropMat(cv, alignment.valid, bounds),
        colorB: planes.base.map((m) => cropMat(cv, m, bounds)),
        colorC: planes.cap.map((m) => cropMat(cv, m, bounds)),
      };
      try {
        standardCount += countTierProducts(cv, tier.colorB, frameSize.width);
        anomalies.push(
          ...diffTier(
            cv,
            tier,
            tierIndex as 0 | 1 | 2 | 3,
            { x: bounds.x, y: bounds.y },
            frameSize,
            params,
            toCapture,
          ),
        );
      } finally {
        [tier.grayB, tier.grayC, tier.diff, tier.texB, tier.texC, tier.valid, ...tier.colorB, ...tier.colorC].forEach((m) =>
          m.delete(),
        );
      }
    }

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
    planes?.cap.forEach((m) => m.delete());
  }
}

export type VisionWorkerRequest =
  | { requestId?: number; type: 'init' }
  | {
      requestId?: number;
      type: 'analyze';
      captureBitmap: ImageBitmap;
      baselineBitmap: ImageBitmap;
      splitYPercentages: [number, number, number, number];
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
      const result = analyzeAllTiers(
        cv,
        captureFrame,
        baselineFrame,
        data.splitYPercentages,
        frameSize,
        data.toleranceValue,
      );

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

export { analyzeAllTiers, getCv, validateAnalyzePayload };
