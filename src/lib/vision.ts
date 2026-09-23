import VisionWorker from '../workers/visionWorker?worker';
import { ShelfCalibration, ToleranceLevel } from '../types';
import { dataUrlToBlob } from './blobUtils';
import { legacyToleranceToNumber } from './vision/toleranceParams';
export type { InspectionAnalysisResult } from './vision/resultTypes';
import type { InspectionAnalysisResult } from './vision/resultTypes';

const MAX_BITMAP_WIDTH = 1080;
const MAX_BITMAP_HEIGHT = 1920;

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) worker = new VisionWorker();
  return worker;
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

  return new Promise((resolve, reject) => {
    const w = getWorker();

    const cleanup = () => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
    };

    const onMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (payload?.type === 'error') {
        cleanup();
        captureBitmap.close();
        baselineBitmap.close();
        reject(new Error(payload.message ?? 'Vision worker analysis failed'));
        return;
      }
      cleanup();
      captureBitmap.close();
      baselineBitmap.close();
      resolve(payload as InspectionAnalysisResult);
    };

    const onError = (event: ErrorEvent) => {
      cleanup();
      captureBitmap.close();
      baselineBitmap.close();
      reject(new Error(event.message || 'Vision worker error'));
    };

    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);

    w.postMessage(
      {
        type: 'analyze',
        captureBitmap,
        baselineBitmap,
        splitYPercentages: baseline.splitYPercentages,
        imageDimensions: baseline.imageDimensions,
        toleranceValue,
      },
      [captureBitmap, baselineBitmap],
    );
  });
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
