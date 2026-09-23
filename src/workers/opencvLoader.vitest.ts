import { createRequire } from 'node:module';
import type { CV } from '@techstark/opencv-js/dist/src/types/opencv';

const require = createRequire(import.meta.url);

/** Node/Vitest OpenCV init — not bundled in production worker (import.meta.env.VITEST gate). */
export async function loadCvForVitest(): Promise<CV> {
  const cvModule = require('@techstark/opencv-js/dist/opencv.js') as
    | CV
    | Promise<CV>
    | { onRuntimeInitialized: () => void; Mat?: unknown };
  if (cvModule instanceof Promise) return cvModule;
  if ((cvModule as CV).Mat) return cvModule as CV;
  await new Promise<void>((resolve) => {
    (cvModule as { onRuntimeInitialized: () => void }).onRuntimeInitialized = () => resolve();
  });
  return cvModule as CV;
}
