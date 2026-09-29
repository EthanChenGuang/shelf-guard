import VisionWorker from '../workers/visionWorker?worker';
import { ShelfCalibration, ToleranceLevel } from '../types';
import { dataUrlToBlob } from './blobUtils';
import { legacyToleranceToNumber } from './vision/toleranceParams';
export type { InspectionAnalysisResult } from './vision/resultTypes';
import type { InspectionAnalysisResult } from './vision/resultTypes';

const MAX_SHORT_EDGE = 1080;
const MAX_LONG_EDGE = 1920;

let worker: Worker | null = null;
let cvReadyPromise: Promise<void> | null = null;
let workerRequestId = 0;
let muxAttached = false;

export function resetVisionWorker(): void {
  if (worker) {
    worker.terminate();
  }
  worker = null;
  cvReadyPromise = null;
  muxAttached = false;
  pending.clear();
}

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

async function dataUrlToImageBitmapSized(
  dataUrl: string,
  targetWidth: number,
  targetHeight: number,
): Promise<ImageBitmap> {
  const blob = await dataUrlToBlob(dataUrl);
  const source = await createImageBitmap(blob);
  if (source.width === targetWidth && source.height === targetHeight) {
    return source;
  }
  try {
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to resize capture for analysis');
    }
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
    source.close();
    return canvas.transferToImageBitmap();
  } catch (err) {
    source.close();
    throw err;
  }
}

function normalizeTolerance(tolerance: ToleranceLevel | number): number {
  if (typeof tolerance === 'number') return tolerance;
  return legacyToleranceToNumber(tolerance);
}

function fitAnalysisSize(width: number, height: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    throw new Error('imageDimensions must be positive');
  }
  // Cap the long and short edge, whichever way the photo is oriented.
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(width, height), MAX_SHORT_EDGE / Math.min(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function validateBeforeAnalyze(
  baseline: ShelfCalibration,
  toleranceValue: number,
): { width: number; height: number } {
  if (!Number.isFinite(toleranceValue) || toleranceValue < 0 || toleranceValue > 100) {
    throw new Error('toleranceValue must be between 0 and 100');
  }
  const { width, height } = baseline.imageDimensions;
  return fitAnalysisSize(width, height);
}

/** Compare the whole capture against the baseline in the vision Web Worker. */
export async function analyzeShelfCapture(
  capturedDataUrl: string,
  baseline: ShelfCalibration,
  tolerance: ToleranceLevel | number,
): Promise<InspectionAnalysisResult> {
  const toleranceValue = normalizeTolerance(tolerance);
  const { width, height } = validateBeforeAnalyze(baseline, toleranceValue);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) resetVisionWorker();

    const [captureBitmap, baselineBitmap] = await Promise.all([
      dataUrlToImageBitmapSized(capturedDataUrl, width, height),
      dataUrlToImageBitmapSized(baseline.imageDataUrl, width, height),
    ]);

    try {
      await prewarmVisionWorker();
      const w = getWorker();
      return await postWorker<InspectionAnalysisResult>(
        w,
        {
          type: 'analyze',
          captureBitmap,
          baselineBitmap,
          toleranceValue,
        },
        [captureBitmap, baselineBitmap],
      );
    } catch (err) {
      captureBitmap.close();
      baselineBitmap.close();
      lastError = err;
    }
  }

  throw lastError;
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
