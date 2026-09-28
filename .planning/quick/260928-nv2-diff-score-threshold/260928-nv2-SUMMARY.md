---
phase: quick-260928-nv2
plan: 1
subsystem: vision, result-page
status: complete
tags: [confidence, threshold, vision-worker, result-inspect, indexeddb]
requires: []
provides:
  - calibrated per-difference confidence (score === confidence)
  - adjustable, persisted confidence threshold (default 85, range 50-99)
affects: [src/workers/visionWorker.ts, src/App.tsx, src/components/ResultInspectView.tsx]
tech-stack:
  added: []
  patterns:
    - derived compliance counts via useMemo instead of mirrored state
key-files:
  created:
    - src/lib/vision/confidence.ts
    - src/lib/vision/confidence.test.ts
    - src/lib/vision/complianceStats.test.ts
    - src/components/ResultInspectView.confidence.test.tsx
    - src/lib/storage.test.ts
  modified:
    - src/workers/visionWorker.ts
    - src/workers/visionWorker.integration.test.ts
    - src/lib/vision/complianceStats.ts
    - src/components/ResultInspectView.tsx
    - src/components/ResultInspectView.tolerance.test.tsx
    - src/components/ResultInspectView.anomaly.test.tsx
    - src/lib/constants.ts
    - src/lib/storage.ts
    - src/App.tsx
    - src/App.toleranceReDiff.integration.test.tsx
    - src/App.completeAudit.integration.test.tsx
    - src/App.autoCameraActivation.integration.test.tsx
    - src/App.firstBaseline.integration.test.tsx
    - src/App.processing.integration.test.tsx
decisions:
  - Confidence = logistic(1.2*ln(areaFraction*100) + 3.9*ln(meanDiff/diffThreshold)); default threshold 85%, slider 50-99 (locked, not retuned)
  - App compliance counts are derived from anomalies + standardCount + minConfidence, not stored as separate state
  - Completed audits persist only differences at/above the threshold; dismissed ones keep dismissed:true
metrics:
  duration: 4m
  completed: 2026-09-28
actuals:
  tokens: 8171
  tasks: 3
  commits: 3
plan_head_before: 43d15f552ac8f41bc59cc4fd3ab9560f0bc3f394
---

# Quick 260928-nv2 Plan 1: Confidence Threshold for Differences Summary

Each difference now carries a calibrated logistic confidence built from region area and mean diff strength. The result page shows and counts only differences at or above an adjustable threshold. The threshold defaults to 85%, persists in IndexedDB, and filters what completed audits store.

## Tasks

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 (tracer) | Calibrated confidence from the worker + threshold-aware stats | 5c6eb0f | confidence.ts, visionWorker.ts, complianceStats.ts |
| 2 | Result page filter, confidence slider, derived counts in App | 3e7420d | ResultInspectView.tsx, App.tsx, constants.ts |
| 3 | Persisted threshold + filtered audit records | 6b28ce5 | storage.ts, App.tsx, App.completeAudit test |

## Tracer gate (real photos)

On `handheld-removed2.jpg` vs `handheld-baseline.jpg`, the worker returns exactly the two removals as MISSING, with confidence **99.95%** and **99.64%**. Both are well above the 85% default. The formula and default were not retuned. The integration assertion (`confidence === score` and meets 85) passes, and the unchanged re-shoot still reports nothing.

## Implementation notes

- `visionWorker.diffRegions` computes `cv.mean(diff, mask)` once. It passes that value to `isLightingShift` and to `anomalyConfidence(area / frameArea, meanDiff / params.diffThreshold)`. Sorting, the MAX_ANOMALIES cap, minArea filtering, and the worker's own stats call are unchanged. The worker call keeps threshold 0.
- `computeComplianceStats(anomalies, standardCount, minConfidence = 0)`: without the third argument it behaves exactly as before.
- In App, the four count states are gone. `stats = useMemo(computeComplianceStats(anomalies, standardCount, minConfidence))` feeds both the result page props and `handleCompleteAudit`. Moving the threshold slider only calls `setMinConfidence` and `saveMinConfidence`, so the worker does not re-run.
- `loadSavedMinConfidence` accepts only integers from 50 to 99 and otherwise returns 85. `saveMinConfidence` rounds and clamps before writing (T-nv2-01).
- `anomalyConfidence` returns 0 for inputs that are zero, negative or NaN (T-nv2-04).

## Verification

- `bunx vitest run`: **48 files, 208 tests passed** (185 existing + 23 new: confidence 9, complianceStats 2, ResultInspectView.confidence 5, storage 7). No failures and no unhandled errors.
- `bunx tsc --noEmit`: clean.
- Grep checks: `anomalyConfidence(` in visionWorker.ts = 1; `cv.mean(diff, mask)` = 1; `computeComplianceStats(anomalies, standardCount, minConfidence)` in App.tsx = 1; `confidenceThreshold` in constants.ts = 4; `loadSavedMinConfidence` in App.tsx = 2.
- No commits touched `.gsd/` or `.planning/.gsd-sessions/`.
- Not done: the Task 2 `<human-check>` (a visual check in `bun run dev` on a phone-sized viewport). It is left for the user's UAT.

## Deviations from Plan

None. The plan was executed as written. The only extra work was a temporary, uncommitted scratch test that logged the observed hand-held confidence scores for this summary. It was deleted afterwards.

## Known Stubs

None.

## Self-Check: PASSED

- Created files exist: confidence.ts, confidence.test.ts, complianceStats.test.ts, ResultInspectView.confidence.test.tsx, storage.test.ts.
- Commits exist: 5c6eb0f, 3e7420d, 6b28ce5 (`git rev-list --count 43d15f5..HEAD` = 3).
