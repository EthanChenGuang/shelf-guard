# D-19 Decision Record — Plan 04-01

**Date:** 2026-09-23  
**Checkpoint:** Task 1 — Confirm OpenCV Web Worker protocol lock-in  
**Human decision:** Option A (approved)

## Locked architecture

- Package: `@techstark/opencv-js@5.0.0-release.1`
- Load WASM **inside** `src/workers/visionWorker.ts` only — never on main thread (D-19, TECH-06)
- Vite `?worker` import from `src/lib/vision.ts` (D-19, D-21)
- Worker protocol: `{ type: 'analyze', captureBitmap, baselineBitmap, splitYPercentages, imageDimensions, toleranceValue }` → `InspectionAnalysisResult`
- Transferable `ImageBitmap` postMessage (D-20)
- No pixelmatch, no `@opencvjs/worker`, no main-thread OpenCV (D-13)

This decision is one-way for Phase 5 and v2 — reversal requires rewriting vision.ts, worker, and all tests.
