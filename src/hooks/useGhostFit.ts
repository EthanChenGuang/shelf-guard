import { useEffect, useState } from 'react';
import { fitGhostToFrame } from '../lib/vision';

const FIT_INTERVAL_MS = 1000;
const FIT_LONG_EDGE = 480;
/** Consecutive failed matches before falling back to the plain full-frame ghost. */
const MAX_MISSES = 3;

function shrink(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const scale = Math.min(1, FIT_LONG_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Once a second, match the live preview against the baseline so the ghost overlay can be placed
 * where the baseline actually appears — the preview often can't use the baseline's (ultra-wide)
 * lens. Returns the normalized baseline-to-frame homography, or null while unmatched.
 */
export function useGhostFit(video: HTMLVideoElement | null, baselineUrl: string, enabled: boolean): number[] | null {
  const [homography, setHomography] = useState<number[] | null>(null);

  useEffect(() => {
    setHomography(null);
    if (!enabled || !video || !baselineUrl || typeof createImageBitmap === 'undefined') return;
    let cancelled = false;
    let busy = false;
    let misses = 0;
    let baselineCanvas: HTMLCanvasElement | null = null;

    const image = new Image();
    image.onload = () => {
      if (!cancelled && image.naturalWidth > 0) baselineCanvas = shrink(image, image.naturalWidth, image.naturalHeight);
    };
    image.src = baselineUrl;

    const tick = async () => {
      if (cancelled || busy || document.hidden || !baselineCanvas || video.videoWidth === 0) return;
      busy = true;
      try {
        const frame = shrink(video, video.videoWidth, video.videoHeight);
        const [baseBitmap, frameBitmap] = await Promise.all([
          createImageBitmap(baselineCanvas),
          createImageBitmap(frame),
        ]);
        const next = await fitGhostToFrame(baseBitmap, frameBitmap);
        if (cancelled) return;
        if (next) {
          misses = 0;
          setHomography(next);
        } else if (++misses >= MAX_MISSES) {
          setHomography(null);
        }
      } catch {
        // Worker unavailable for a moment: keep the last placement.
      } finally {
        busy = false;
      }
    };
    const id = setInterval(() => void tick(), FIT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [video, baselineUrl, enabled]);

  return homography;
}
