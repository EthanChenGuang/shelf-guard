import type { CV } from '@techstark/opencv-js/dist/src/types/opencv';
import { DetectedAnomaly } from '../types';
import { pixelRectToNormalized, stableAnomalyId } from '../lib/vision/bboxUtils';
import { classifyContourType } from '../lib/vision/classifyContour';
import { computeComplianceStats } from '../lib/vision/complianceStats';
import { toleranceToDiffParams } from '../lib/vision/toleranceParams';
import { tierBoundsFromSplits } from '../lib/vision/tierGeometry';
import { rasterFromImageBitmap, type RasterFrame } from '../lib/vision/rasterFrame';
import type { InspectionAnalysisResult } from '../lib/vision/resultTypes';

const MAX_ANOMALIES_PER_TIER = 8;
const MAX_BITMAP_WIDTH = 1080;
const MAX_BITMAP_HEIGHT = 1920;
const STANDARD_COUNT_FALLBACK = 24;

let cvInstance: CV | null = null;

async function resolveCvModule(
  cvModule: CV | Promise<CV> | { onRuntimeInitialized: () => void; Mat?: unknown },
): Promise<CV> {
  if (cvModule instanceof Promise) return cvModule;
  if ((cvModule as CV).Mat) return cvModule as CV;
  await new Promise<void>((resolve) => {
    (cvModule as { onRuntimeInitialized: () => void }).onRuntimeInitialized = () => resolve();
  });
  return cvModule as CV;
}

async function loadOpenCvModule(): Promise<CV> {
  if (import.meta.env.VITEST) {
    const { loadCvForVitest } = await import('./opencvLoader.vitest');
    return loadCvForVitest();
  }

  const imported = await import('@techstark/opencv-js');
  return resolveCvModule(imported.default as CV | Promise<CV> | { onRuntimeInitialized: () => void });
}

async function getCv(): Promise<CV> {
  if (cvInstance) return cvInstance;
  cvInstance = await loadOpenCvModule();
  return cvInstance;
}

function validateAnalyzePayload(data: Record<string, unknown>): void {
  const { splitYPercentages, imageDimensions, toleranceValue } = data;
  if (!Array.isArray(splitYPercentages) || splitYPercentages.length !== 4) {
    throw new Error('splitYPercentages must contain exactly 4 values');
  }
  const tol = Number(toleranceValue);
  if (!Number.isFinite(tol) || tol < 0 || tol > 100) {
    throw new Error('toleranceValue must be between 0 and 100');
  }
  const dims = imageDimensions as { width?: number; height?: number } | undefined;
  if (!dims || typeof dims.width !== 'number' || typeof dims.height !== 'number') {
    throw new Error('imageDimensions must include width and height');
  }
  if (dims.width <= 0 || dims.height <= 0 || dims.width > MAX_BITMAP_WIDTH || dims.height > MAX_BITMAP_HEIGHT) {
    throw new Error(`imageDimensions must be within 1..${MAX_BITMAP_WIDTH}x${MAX_BITMAP_HEIGHT}`);
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

function contourRegionStats(
  cv: CV,
  grayBaseline: InstanceType<CV['Mat']>,
  grayCapture: InstanceType<CV['Mat']>,
  contour: InstanceType<CV['Mat']>,
): {
  baselineMean: number;
  captureMean: number;
  baselineCentroid: { x: number; y: number };
  captureCentroid: { x: number; y: number };
} {
  const mask = new cv.Mat(grayBaseline.rows, grayBaseline.cols, cv.CV_8UC1, new cv.Scalar(0));
  const vec = new cv.MatVector();
  vec.push_back(contour);
  try {
    cv.drawContours(mask, vec, 0, new cv.Scalar(255), -1);
    const baselineMean = cv.mean(grayBaseline, mask)[0] ?? 0;
    const captureMean = cv.mean(grayCapture, mask)[0] ?? 0;
    const rect = cv.boundingRect(contour);
    const offset = { x: rect.x, y: rect.y };
    return {
      baselineMean,
      captureMean,
      baselineCentroid: foregroundCentroidFromMask(cv, grayBaseline, mask, offset),
      captureCentroid: foregroundCentroidFromMask(cv, grayCapture, mask, offset),
    };
  } finally {
    mask.delete();
    vec.delete();
  }
}

function countForegroundBlobs(
  cv: CV,
  gray: InstanceType<CV['Mat']>,
  minContourArea: number,
): number {
  const binary = new cv.Mat();
  const closed = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  try {
    cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
    cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel);
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let count = 0;
    for (let i = 0; i < contours.size(); i += 1) {
      const area = cv.contourArea(contours.get(i));
      if (area >= minContourArea) count += 1;
    }
    return count;
  } finally {
    binary.delete();
    closed.delete();
    contours.delete();
    hierarchy.delete();
    kernel.delete();
  }
}

function diffTier(
  cv: CV,
  baselineTier: InstanceType<CV['Mat']>,
  captureTier: InstanceType<CV['Mat']>,
  tierIndex: 0 | 1 | 2 | 3,
  tierOffset: { x: number; y: number },
  frameSize: { width: number; height: number },
  params: ReturnType<typeof toleranceToDiffParams>,
): DetectedAnomaly[] {
  const grayB = new cv.Mat();
  const grayC = new cv.Mat();
  const diff = new cv.Mat();
  const binary = new cv.Mat();
  const closed = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));

  try {
    cv.cvtColor(baselineTier, grayB, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(captureTier, grayC, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(grayB, grayB, new cv.Size(5, 5), 0);
    cv.GaussianBlur(grayC, grayC, new cv.Size(5, 5), 0);
    cv.absdiff(grayB, grayC, diff);
    cv.threshold(diff, binary, params.diffThreshold, 255, cv.THRESH_BINARY);
    cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel);
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const candidates: Array<{ area: number; anomaly: DetectedAnomaly }> = [];

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area < params.minContourArea) continue;

      const stats = contourRegionStats(cv, grayB, grayC, contour);
      const type = classifyContourType(stats, params.displacementThresholdPx);
      if (!type) continue;

      const rect = cv.boundingRect(contour);
      const fullFrameRect = {
        x: tierOffset.x + rect.x,
        y: tierOffset.y + rect.y,
        width: rect.width,
        height: rect.height,
      };
      const bbox = pixelRectToNormalized(fullFrameRect, frameSize.width, frameSize.height);
      const rowIndex = tierIndex;
      candidates.push({
        area,
        anomaly: {
          id: stableAnomalyId(rowIndex, bbox),
          rowIndex,
          type,
          title: type === 'MISSING' ? `Tier ${rowIndex + 1} missing` : `Tier ${rowIndex + 1} moved`,
          score: Math.min(1, area / (params.minContourArea * 4)),
          boundingBox: bbox,
          dismissed: false,
          ...(type === 'MOVED' ? { displacementNote: 'detected shift' } : {}),
        },
      });
    }

    if (!candidates.some((c) => c.anomaly.type === 'MOVED')) {
      const fullMask = new cv.Mat(grayB.rows, grayB.cols, cv.CV_8UC1, new cv.Scalar(255));
      try {
        const baselineCentroid = foregroundCentroidFromMask(cv, grayB, fullMask, { x: 0, y: 0 });
        const captureCentroid = foregroundCentroidFromMask(cv, grayC, fullMask, { x: 0, y: 0 });
        const tierStats = {
          baselineMean: cv.mean(grayB)[0] ?? 0,
          captureMean: cv.mean(grayC)[0] ?? 0,
          baselineCentroid,
          captureCentroid,
        };
        if (classifyContourType(tierStats, params.displacementThresholdPx) === 'MOVED') {
          let unionRect = { x: 0, y: 0, width: grayB.cols, height: grayB.rows };
          for (let j = 0; j < contours.size(); j += 1) {
            const r = cv.boundingRect(contours.get(j));
            if (j === 0) {
              unionRect = { x: r.x, y: r.y, width: r.width, height: r.height };
            } else {
              const x2 = Math.max(unionRect.x + unionRect.width, r.x + r.width);
              const y2 = Math.max(unionRect.y + unionRect.height, r.y + r.height);
              unionRect.x = Math.min(unionRect.x, r.x);
              unionRect.y = Math.min(unionRect.y, r.y);
              unionRect.width = x2 - unionRect.x;
              unionRect.height = y2 - unionRect.y;
            }
          }
          const fullFrameRect = {
            x: tierOffset.x + unionRect.x,
            y: tierOffset.y + unionRect.y,
            width: unionRect.width,
            height: unionRect.height,
          };
          const bbox = pixelRectToNormalized(fullFrameRect, frameSize.width, frameSize.height);
          candidates.push({
            area: params.minContourArea * 2,
            anomaly: {
              id: stableAnomalyId(tierIndex, bbox),
              rowIndex: tierIndex,
              type: 'MOVED',
              title: `Tier ${tierIndex + 1} moved`,
              score: 0.75,
              boundingBox: bbox,
              dismissed: false,
              displacementNote: 'detected shift',
            },
          });
        }
      } finally {
        fullMask.delete();
      }
    }

    candidates.sort((a, b) => b.area - a.area);
    return candidates.slice(0, MAX_ANOMALIES_PER_TIER).map((c) => c.anomaly);
  } finally {
    grayB.delete();
    grayC.delete();
    diff.delete();
    binary.delete();
    closed.delete();
    contours.delete();
    hierarchy.delete();
    kernel.delete();
  }
}

function analyzeAllTiers(
  cv: CV,
  captureFrame: RasterFrame,
  baselineFrame: RasterFrame,
  splitYPercentages: [number, number, number, number],
  imageDimensions: { width: number; height: number },
  toleranceValue: number,
): InspectionAnalysisResult {
  const params = toleranceToDiffParams(toleranceValue);
  const baselineMat = rasterToMat(cv, baselineFrame);
  const captureMat = rasterToMat(cv, captureFrame);

  try {
    let standardCount = 0;
    const anomalies: DetectedAnomaly[] = [];

    for (let tierIndex = 0; tierIndex < 4; tierIndex += 1) {
      const bounds = tierBoundsFromSplits(
        splitYPercentages,
        imageDimensions,
        tierIndex as 0 | 1 | 2 | 3,
      );
      const baselineTier = cropMat(cv, baselineMat, bounds);
      const captureTier = cropMat(cv, captureMat, bounds);
      const grayB = new cv.Mat();
      try {
        cv.cvtColor(baselineTier, grayB, cv.COLOR_RGBA2GRAY);
        standardCount += countForegroundBlobs(cv, grayB, params.minContourArea);
      } finally {
        grayB.delete();
      }

      try {
        const tierAnomalies = diffTier(
          cv,
          baselineTier,
          captureTier,
          tierIndex as 0 | 1 | 2 | 3,
          { x: bounds.x, y: bounds.y },
          imageDimensions,
          params,
        );
        anomalies.push(...tierAnomalies);
      } finally {
        baselineTier.delete();
        captureTier.delete();
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
  }
}

export type VisionWorkerRequest =
  | { type: 'init' }
  | {
      type: 'analyze';
      captureBitmap: ImageBitmap;
      baselineBitmap: ImageBitmap;
      splitYPercentages: [number, number, number, number];
      imageDimensions: { width: number; height: number };
      toleranceValue: number;
    };

if (typeof self !== 'undefined' && 'onmessage' in self) {
  self.onmessage = async (event: MessageEvent<VisionWorkerRequest>) => {
    const data = event.data;
    if (data?.type === 'init') {
      try {
        await getCv();
        self.postMessage({type: 'ready'});
      } catch (err) {
        self.postMessage({
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
        data.captureBitmap.width > MAX_BITMAP_WIDTH ||
        data.captureBitmap.height > MAX_BITMAP_HEIGHT ||
        data.baselineBitmap.width > MAX_BITMAP_WIDTH ||
        data.baselineBitmap.height > MAX_BITMAP_HEIGHT
      ) {
        throw new Error('ImageBitmap dimensions exceed allowed maximum');
      }

      const cv = await getCv();
      const [captureFrame, baselineFrame] = await Promise.all([
        rasterFromImageBitmap(data.captureBitmap),
        rasterFromImageBitmap(data.baselineBitmap),
      ]);

      const result = analyzeAllTiers(
        cv,
        captureFrame,
        baselineFrame,
        data.splitYPercentages,
        data.imageDimensions,
        data.toleranceValue,
      );

      data.captureBitmap.close();
      data.baselineBitmap.close();
      self.postMessage(result);
    } catch (err) {
      try {
        data.captureBitmap?.close?.();
        data.baselineBitmap?.close?.();
      } catch {
        // ignore close errors
      }
      self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };
}

export { analyzeAllTiers, getCv, validateAnalyzePayload };
