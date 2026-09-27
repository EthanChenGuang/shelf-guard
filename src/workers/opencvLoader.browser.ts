import type { CV } from '@techstark/opencv-js/dist/src/types/opencv';

type OpenCvGlobal = typeof globalThis & {
  cv?: CV | Promise<CV>;
  Module?: { onRuntimeInitialized?: () => void };
};

let loadPromise: Promise<CV> | null = null;

function resolveCvInstance(g: OpenCvGlobal): CV | null {
  const raw = g.cv;
  if (!raw) return null;
  if (raw instanceof Promise) return null;
  if (typeof raw === 'object' && 'Mat' in raw && raw.Mat) return raw;
  return null;
}

/**
 * Load OpenCV Emscripten runtime from /opencv/opencv.js (unbundled).
 * Module workers cannot use importScripts; bundling opencv-js breaks its Promise bootstrap.
 */
export function loadOpenCvInWorker(): Promise<CV> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const g = globalThis as OpenCvGlobal;
    const existing = resolveCvInstance(g);
    if (existing) return existing;

    const scriptUrl = new URL(`${import.meta.env.BASE_URL}opencv/opencv.js`, self.location.href)
      .href;
    const res = await fetch(scriptUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch OpenCV runtime (${res.status})`);
    }
    const code = await res.text();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (err?: unknown) => {
        if (settled) return;
        settled = true;
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else resolve();
      };

      const priorModule = g.Module ?? {};
      g.Module = {
        ...priorModule,
        onRuntimeInitialized: () => {
          priorModule.onRuntimeInitialized?.();
          finish();
        },
      };

      try {
        // UMD assigns globalThis.cv; must not bundle this file through Rolldown.
        (0, eval)(code);
      } catch (err) {
        finish(err);
        return;
      }

      const cvPromise = g.cv instanceof Promise ? g.cv : null;
      if (cvPromise) {
        cvPromise
          .then(() => finish())
          .catch((err) => finish(err));
        return;
      }

      if (resolveCvInstance(g)) {
        finish();
      }
    });

    const raw = g.cv;
    const cv = raw instanceof Promise ? await raw : raw;
    if (!cv?.Mat) {
      throw new Error('OpenCV failed to initialize in worker');
    }
    (g as { cv?: CV }).cv = cv as CV;
    return cv as CV;
  })();

  return loadPromise;
}
