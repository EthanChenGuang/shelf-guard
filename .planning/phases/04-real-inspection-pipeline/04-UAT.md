---
status: complete
phase: 04-real-inspection-pipeline
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-VERIFICATION.md]
started: 2026-09-23T21:46:00Z
updated: 2026-09-23T21:47:30Z
verified_by: autonomous
---

## Current Test

[testing complete]

## Tests

### 1. OpenCV worker returns real contour anomalies on golden fixtures
expected: analyzeShelfCapture dispatches to Web Worker; MISSING/MOVED on golden JPEG pairs
result: pass
source: automated
coverage_id: D1 (04-01)
verification: src/workers/visionWorker.integration.test.ts

### 2. MISSING and MOVED detected on aligned golden pairs
expected: capture-missing.jpg yields MISSING; capture-displaced.jpg yields MOVED
result: pass
source: automated
coverage_id: D2 (04-01)
verification: src/workers/visionWorker.integration.test.ts

### 3. Tolerance lerp and bbox normalization unit-locked
expected: D-12 endpoints and bbox 0.0–1.0 contract
result: pass
source: automated
coverage_id: D3 (04-01)
verification: src/lib/vision/toleranceParams.test.ts, bboxUtils.test.ts, classifyContour.test.ts

### 4. First-baseline shutter routes to ROI_CONFIG without scan/diff
expected: Empty shelf shutter → ROI calibration with pending capture, no analyzeShelfCapture
result: pass
source: automated
coverage_id: D1 (04-02), D1 (04-03)
verification: src/App.firstBaseline.integration.test.tsx

### 5. Continuous tolerance slider replaces 3-button enum UI
expected: Range slider 0–100 with preset ticks at 25/50/75
result: pass
source: automated
coverage_id: D2 (04-02)
verification: src/components/ResultInspectView.tolerance.test.tsx

### 6. Debounced slider re-invokes analyzeShelfCapture with updated tolerance
expected: 150ms debounce triggers full worker re-diff, not client filter
result: pass
source: automated
coverage_id: D3 (04-02)
verification: src/App.toleranceReDiff.integration.test.tsx

### 7. Legacy tolerance enum migrates to numeric on IndexedDB load
expected: strict→25, normal→50, loose→75
result: pass
source: automated
coverage_id: D4 (04-02)
verification: src/lib/vision/toleranceParams.test.ts

### 8. PROCESSING overlay when analysis exceeds 800ms
expected: Scan animation runs parallel; PROCESSING overlay after 800ms
result: pass
source: automated
coverage_id: D2 (04-03)
verification: src/App.processing.integration.test.tsx

### 9. Worker failure shows analysisFailed copy and returns to camera
expected: Error banner + CAMERA_IDLE recovery, no stuck PROCESSING
result: pass
source: automated
coverage_id: D3 (04-03)
verification: src/App.completeAudit.integration.test.tsx

### 10. Complete inspection saves audit with dismissed flags
expected: appendAuditRecord with dismissed flags; return to active shelf camera
result: pass
source: automated
coverage_id: D4 (04-03)
verification: src/App.completeAudit.integration.test.tsx

### 11. Blink compare long-press gesture (RSLT-02)
expected: Press hides AR boxes and swaps to baseline image; release restores capture view
result: pass
source: automated
verification: src/components/ResultInspectView.tolerance.test.tsx (mouse + touch events)

### 12. Aligned device capture diff path (VIS-01)
expected: Real OpenCV diff runs on follow-up capture; aligned golden pairs produce correct MISSING/MOVED; tap-to-dismiss wired on result view
result: pass
source: automated
verification: visionWorker.integration.test.ts + App.completeAudit.integration.test.tsx
note: Viewpoint drift (2–5°) field sensitivity tracked as deferred follow-up — not simulatable in CI per 04-VALIDATION.md

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None.

## Deferred Follow-Ups

- test: 12
  idea: "Field device validation of 2–5° viewpoint drift false-positive rate on real shelf captures"
  deferred_at: 2026-09-23
