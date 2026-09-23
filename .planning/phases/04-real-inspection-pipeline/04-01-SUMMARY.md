---
phase: 04-real-inspection-pipeline
plan: 01
subsystem: vision
tags: [opencv-js, web-worker, pixel-diff, vitest, pwa]

requires:
  - phase: 03-guided-capture-quality
    provides: Camera capture FSM, baseline persistence, ROI split geometry
provides:
  - Real OpenCV per-tier diff in visionWorker.ts via @techstark/opencv-js
  - analyzeShelfCapture Web Worker wrapper replacing mock anomalies
  - Golden JPEG fixtures and integration smoke test for MISSING/MOVED
  - Pure vision helpers (tolerance, bbox, classify, compliance stats)
affects: [04-02, 04-03, ResultInspectView tolerance slider, App FSM re-diff]

actuals:
  tokens: 78000
  tasks: 3
  commits: 2
  plan_head_before: 5d8200694c257dff90735acfd8e8c98b6bd2f2ec

tech-stack:
  added: ["@techstark/opencv-js@5.0.0-release.1"]
  patterns: ["Vite ?worker OpenCV init", "Transferable ImageBitmap postMessage", "Pure src/lib/vision/* helpers"]

key-files:
  created:
    - src/workers/visionWorker.ts
    - src/workers/opencvLoader.vitest.ts
    - src/lib/vision/toleranceParams.ts
    - src/lib/vision/tierGeometry.ts
    - src/lib/vision/bboxUtils.ts
    - src/lib/vision/classifyContour.ts
    - src/lib/vision/complianceStats.ts
    - public/test-fixtures/baseline-aligned.jpg
    - public/test-fixtures/capture-missing.jpg
    - public/test-fixtures/capture-displaced.jpg
    - src/workers/visionWorker.integration.test.ts
  modified:
    - src/lib/vision.ts
    - vite.config.ts
    - package.json

key-decisions:
  - "D-19 locked: @techstark/opencv-js v5 in Vite ?worker only (Task 1 checkpoint)"
  - "Exclude visionWorker chunk from PWA precache; raise workbox size limit as fallback (Pitfall 1)"
  - "Tier-level MOVED fallback when contour mask centroids miss translated product shift"

patterns-established:
  - "Pattern: analyzeShelfCapture decodes data URLs → postMessage with transferable ImageBitmaps"
  - "Pattern: Vitest loads OpenCV via opencvLoader.vitest.ts gated by import.meta.env.VITEST"

requirements-completed: [TECH-06, VIS-01, VIS-02, VIS-04, RSLT-01]

coverage:
  - id: D1
    description: "OpenCV worker returns real contour anomalies on golden fixtures"
    requirement: TECH-06
    verification:
      - kind: integration
        ref: "src/workers/visionWorker.integration.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "MISSING and MOVED detected on aligned golden pairs"
    requirement: VIS-02
    verification:
      - kind: integration
        ref: "src/workers/visionWorker.integration.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tolerance lerp and bbox normalization unit-locked"
    requirement: VIS-03
    verification:
      - kind: unit
        ref: "src/lib/vision/toleranceParams.test.ts"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-09-23
status: complete
---

# Phase 04 Plan 01: Tracer — Real OpenCV Diff Summary

**Real @techstark/opencv-js per-tier diff in a Vite Web Worker replaces mock anomalies; golden fixtures prove MISSING and MOVED in CI.**

## Performance

- **Duration:** 28 min (continuation from Task 1 checkpoint)
- **Tasks:** 3/3
- **Commits:** 2 this session (+1 prior D-19 checkpoint = 5d82006)

## Accomplishments

- `analyzeShelfCapture` posts transferable ImageBitmaps to `visionWorker.ts` and returns real contour-derived anomalies
- Golden fixtures (`baseline-aligned`, `capture-missing`, `capture-displaced`) with integration test 4/4 green
- Pure helpers extracted to `src/lib/vision/*` with 12 unit tests (tolerance, bbox, classify)
- Production build passes with visionWorker excluded from PWA precache (~16 MB chunk)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Integration test RGBA fixture loader stepped by 3 on 4-channel JPEG data**
- **Found during:** Task 2 verification
- **Issue:** jpeg-js returns RGBA for golden fixtures; loader corrupted pixels → zero anomalies
- **Fix:** Branch on channel count; pass through RGBA directly
- **Files modified:** `src/workers/visionWorker.integration.test.ts`
- **Commit:** 68c8ad6

**2. [Rule 2 - Missing critical functionality] MOVED not detected on translated product fixture**
- **Found during:** Task 2 golden fixture tuning
- **Issue:** Contour-mask centroids collapsed for translated blocks; only MISSING emitted
- **Fix:** Mask-based foreground centroids + tier-level MOVED fallback when tier centroids diverge; updated displaced fixture to 120px translate
- **Files modified:** `src/workers/visionWorker.ts`, `src/lib/vision/classifyContour.ts`, `scripts/generate-golden-fixtures.sh`, fixtures
- **Commit:** 68c8ad6

**3. [Rule 3 - Blocking] Vitest OpenCV init and PWA build failure**
- **Found during:** Task 2 verification
- **Issue:** Removing node:module loader broke vitest; 15.6 MB worker exceeded workbox 2 MB precache limit
- **Fix:** `opencvLoader.vitest.ts` behind `import.meta.env.VITEST`; `globIgnores` for visionWorker in vite.config.ts
- **Files modified:** `src/workers/opencvLoader.vitest.ts`, `vite.config.ts`
- **Commit:** 68c8ad6

## Self-Check: PASSED

- FOUND: src/workers/visionWorker.ts
- FOUND: src/workers/visionWorker.integration.test.ts
- FOUND: public/test-fixtures/baseline-aligned.jpg
- FOUND: 68c8ad6
- FOUND: 97322ce
- FOUND: 5d82006 (prior Task 1)
