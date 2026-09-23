import VisionWorker from '../workers/visionWorker?worker';
import { ShelfCalibration, ToleranceLevel } from '../types';
import { dataUrlToBlob } from './blobUtils';
import { legacyToleranceToNumber } from './vision/toleranceParams';
export type { InspectionAnalysisResult } from './vision/resultTypes';
import type { InspectionAnalysisResult } from './vision/resultTypes';

const MAX_BITMAP_WIDTH = 1080;
const MAX_BITMAP_HEIGHT = 1920;

let worker: Worker | null = null;
let cvReadyPromise: Promise<void> | null = null;
let workerRequestId = 0;
let muxAttached = false;

type PendingEntry = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const pending = new Map<number, PendingEntry>();

function getWorker(): Worker {
  if (!worker) worker = new VisionWorker();
  return worker;
}

function attachWorkerMux(w: Worker): void {
  if (muxAttached) return;
  muxAttached = true;

  w.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as {
      requestId?: number;
      type?: string;
      payload?: InspectionAnalysisResult;
      message?: string;
    };
    const requestId = data?.requestId;
    if (typeof requestId !== 'number') return;

    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);

    if (data.type === 'error') {
      entry.reject(new Error(data.message ?? 'Vision worker error'));
      return;
    }
    if (data.type === 'ready') {
      entry.resolve(undefined);
      return;
    }
    if (data.type === 'result') {
      entry.resolve(data.payload);
      return;
    }
  });

  w.addEventListener('error', (event: ErrorEvent) => {
    for (const [id, entry] of pending) {
      entry.reject(new Error(event.message || 'Vision worker error'));
      pending.delete(id);
    }
    cvReadyPromise = null;
    worker = null;
    muxAttached = false;
  });
}

function postWorker<T>(
  w: Worker,
  body: Record<string, unknown>,
  transfer?: Transferable[],
): Promise<T> {
  attachWorkerMux(w);
  const requestId = ++workerRequestId;
  return new Promise((resolve, reject) => {
    pending.set(requestId, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    w.postMessage({ ...body, requestId }, transfer ?? []);
  });
}

/** Spawn worker and load OpenCV WASM before first analyze (cold-start backstop). */
export function prewarmVisionWorker(): Promise<void> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve();
  }
  if (!cvReadyPromise) {
    const w = getWorker();
    cvReadyPromise = postWorker<void>(w, { type: 'init' }).catch((err) => {
      cvReadyPromise = null;
      throw err;
    });
  }
  return cvReadyPromise;
}

async function dataUrlToImageBitmap(dataUrl: string): Promise<ImageBitmap> {
  const blob = await dataUrlToBlob(dataUrl);
  return createImageBitmap(blob);
}

function normalizeTolerance(tolerance: ToleranceLevel | number): number {
  if (typeof tolerance === 'number') return tolerance;
  return legacyToleranceToNumber(tolerance);
}

function validateBeforeAnalyze(
  baseline: ShelfCalibration,
  toleranceValue: number,
): void {
  if (!Number.isFinite(toleranceValue) || toleranceValue < 0 || toleranceValue > 100) {
    throw new Error('toleranceValue must be between 0 and 100');
  }
  if (!baseline.splitYPercentages || baseline.splitYPercentages.length !== 4) {
    throw new Error('baseline.splitYPercentages must contain exactly 4 values');
  }
  const { width, height } = baseline.imageDimensions;
  if (width <= 0 || height <= 0 || width > MAX_BITMAP_WIDTH || height > MAX_BITMAP_HEIGHT) {
    throw new Error(`imageDimensions must be within 1..${MAX_BITMAP_WIDTH}x${MAX_BITMAP_HEIGHT}`);
  }
}

/**
 * Perform multi-band differential image analysis across the 4 shelf tiers via Web Worker (D-19–D-22).
 */
export async function analyzeShelfCapture(
  capturedDataUrl: string,
  baseline: ShelfCalibration,
  tolerance: ToleranceLevel | number,
): Promise<InspectionAnalysisResult> {
  const toleranceValue = normalizeTolerance(tolerance);
  validateBeforeAnalyze(baseline, toleranceValue);

  const [captureBitmap, baselineBitmap] = await Promise.all([
    dataUrlToImageBitmap(capturedDataUrl),
    dataUrlToImageBitmap(baseline.imageDataUrl),
  ]);

  const w = getWorker();

  try {
    return await postWorker<InspectionAnalysisResult>(
      w,
      {
        type: 'analyze',
        captureBitmap,
        baselineBitmap,
        splitYPercentages: baseline.splitYPercentages,
        toleranceValue,
      },
      [captureBitmap, baselineBitmap],
    );
  } catch (err) {
    captureBitmap.close();
    baselineBitmap.close();
    throw err;
  }
}

/**
 * Capture a frame from an HTMLVideoElement or an Image element to DataURL
 */
export function captureElementToDataUrl(
  element: HTMLVideoElement | HTMLImageElement,
  targetWidth = 1080,
  targetHeight = 1920,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(element, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/jpeg', 0.92);
}
