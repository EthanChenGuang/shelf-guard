---
phase: 04-real-inspection-pipeline
reviewed: 2026-09-23T21:41:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/workers/visionWorker.ts
  - src/workers/opencvLoader.vitest.ts
  - src/lib/vision.ts
  - src/lib/vision/toleranceParams.ts
  - src/lib/vision/tierGeometry.ts
  - src/lib/vision/bboxUtils.ts
  - src/lib/vision/classifyContour.ts
  - src/lib/vision/complianceStats.ts
  - src/App.tsx
  - src/components/RoiSetupView.tsx
  - src/components/ResultInspectView.tsx
  - src/components/CameraView.tsx
  - src/lib/storage.ts
  - src/types.ts
  - src/types/persisted.ts
  - src/lib/constants.ts
  - vite.config.ts
  - package.json
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: fixed
findings_resolved:
  critical: [CR-01, CR-02, CR-03]
  warning: [WR-01, WR-02, WR-03, WR-04, WR-05]
  info: [IN-02]
findings_open:
  info: [IN-01]
---

# Phase 4: Code Review Report

**Reviewed:** 2026-09-23T21:41:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 04 delivers a real OpenCV Web Worker diff pipeline, first-baseline FSM routing, continuous tolerance slider with debounced re-diff, and worker error recovery. The core vision helpers and golden-fixture integration tests are sound, but the **singleton worker wrapper in `src/lib/vision.ts` multiplexes concurrent requests incorrectly**, which can corrupt inspection results during pre-warm overlap or rapid tolerance changes. A separate **dimension contract gap** between persisted `imageDimensions` and actual decoded bitmap sizes can misalign tier crops after custom baseline uploads. Five additional warnings cover validation gaps and debounce lifecycle issues.

## Critical Issues

### CR-01: Shared worker listeners consume wrong messages on concurrent requests

**File:** `src/lib/vision.ts:98-142`
**Issue:** `analyzeShelfCapture` and `prewarmVisionWorker` each attach ephemeral `message` listeners to the same singleton `Worker`. Worker `postMessage` broadcasts to **all** active listeners. If `prewarmVisionWorker` init is in-flight when `analyzeShelfCapture` runs, the analyze listener resolves with `{ type: 'ready' }` instead of an `InspectionAnalysisResult`, leaving `result.anomalies` undefined and corrupting UI state. Two overlapping analyze calls (e.g. tolerance debounce firing while a prior diff is still running) assign the first response to both promises and drop the second response entirely.
**Fix:**
```typescript
// Serialize all worker traffic through one permanent listener + request queue
let workerRequestId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function attachWorkerMux(w: Worker) {
  w.addEventListener('message', (event: MessageEvent) => {
    const { requestId, payload, error } = event.data ?? {};
    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);
    error ? entry.reject(new Error(error)) : entry.resolve(payload);
  });
}

function postWorker<T>(w: Worker, body: Record<string, unknown>, transfer?: Transferable[]): Promise<T> {
  const requestId = ++workerRequestId;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ ...body, requestId }, transfer ?? []);
  });
}

// Worker replies with { requestId, payload } or { requestId, error }
// prewarm: postWorker(w, { type: 'init' })
// analyze: postWorker(w, { type: 'analyze', ... }, [captureBitmap, baselineBitmap])
```

### CR-02: Tier crops use persisted dimensions, not actual bitmap size

**File:** `src/workers/visionWorker.ts:296-337`, `src/lib/vision.ts:93-138`
**Issue:** `analyzeAllTiers` computes tier bounds from `baseline.imageDimensions` passed in the message, but crops the actual `RasterFrame` mats decoded from `ImageBitmap` dimensions. `captureFrame` always outputs 1080×1920 (`useCameraStream.ts:138-142`), while custom baseline uploads store natural dimensions via `loadImageDimensions` (`App.tsx:426-431`). After a non-1080×1920 upload, tier ROIs are computed for the wrong coordinate space — diff runs on misaligned bands and can miss or hallucinate anomalies.
**Fix:**
```typescript
// In visionWorker analyze handler, derive dimensions from decoded frames:
const [captureFrame, baselineFrame] = await Promise.all([...]);

if (
  captureFrame.width !== baselineFrame.width ||
  captureFrame.height !== baselineFrame.height
) {
  throw new Error('Capture and baseline dimensions must match');
}

const frameSize = { width: captureFrame.width, height: captureFrame.height };

const result = analyzeAllTiers(
  cv,
  captureFrame,
  baselineFrame,
  data.splitYPercentages,
  frameSize, // use actual raster size, not stale persisted dims
  data.toleranceValue,
);

// On save/resample paths, normalize baseline.imageDimensions to capture size (1080×1920)
```

### CR-03: No capture/baseline bitmap dimension parity check before Mat ops

**File:** `src/workers/visionWorker.ts:404-417`
**Issue:** Even when `imageDimensions` metadata is internally consistent, the worker never compares `captureBitmap` and `baselineBitmap` width/height before OpenCV `roi` crops. Mismatched mat sizes combined with shared `imageDimensions` can produce out-of-bounds ROIs (OpenCV throw) or silently crop only the overlapping region — both are incorrect inspection behavior.
**Fix:**
```typescript
if (
  data.captureBitmap.width !== data.baselineBitmap.width ||
  data.captureBitmap.height !== data.baselineBitmap.height
) {
  throw new Error(
    `Bitmap size mismatch: capture ${data.captureBitmap.width}x${data.captureBitmap.height}, ` +
    `baseline ${data.baselineBitmap.width}x${data.baselineBitmap.height}`,
  );
}
```

## Warnings

### WR-01: Tolerance debounce allows out-of-order stale results

**File:** `src/App.tsx:181-189`
**Issue:** Each debounced slider tick fires an independent `analyzeShelfCapture` without tracking the latest requested tolerance. If an earlier (slower) worker call completes after a later one, stale anomaly data overwrites results while the slider shows the newer tolerance value.
**Fix:** Keep a monotonic `toleranceRequestSeq` ref; only apply `setAnomalies` / stats when `seq === toleranceRequestSeq` at resolution time. Alternatively abort/cancel superseded in-flight requests via the worker mux in CR-01.

### WR-02: Tolerance re-diff lacks error handling

**File:** `src/App.tsx:181-189`
**Issue:** The debounced async IIFE has no `try/catch`. A worker rejection during slider adjustment becomes an unhandled promise rejection; the UI stays on `RESULT_INSPECT` with stale anomalies and no error feedback (unlike the shutter path at lines 283-289).
**Fix:**
```typescript
toleranceDebounceRef.current = setTimeout(async () => {
  try {
    const result = await analyzeShelfCapture(capturedFrame, baseline, newTol);
    // apply result (with seq guard from WR-01)
  } catch {
    setShowAnalysisError(true);
    setAppMode('CAMERA_IDLE');
  }
}, 150);
```

### WR-03: Debounced re-diff runs after leaving result view

**File:** `src/App.tsx:173-200`
**Issue:** `handleToleranceChange` does not check `appMode === 'RESULT_INSPECT'`. If the user navigates back within the 150 ms debounce window, analysis still runs and mutates global anomaly/compliance state off-screen.
**Fix:** Capture `appMode` in the debounce closure or use an `AbortController` / generation counter cleared when `appMode` leaves `RESULT_INSPECT`.

### WR-04: Worker payload validation omits split ordering and range

**File:** `src/workers/visionWorker.ts:45-61`
**Issue:** `validateAnalyzePayload` checks `splitYPercentages.length === 4` but not that values are monotonically increasing within `(0, 1]`. Corrupted IndexedDB or manual ROI edits could pass invalid splits; `tierBoundsFromSplits` then yields degenerate 1 px bands (`Math.max(1, bottom - y)`) and analysis silently degrades.
**Fix:**
```typescript
const splits = splitYPercentages as number[];
let prev = 0;
for (let i = 0; i < splits.length; i++) {
  const v = splits[i];
  if (!Number.isFinite(v) || v <= prev || v > 1) {
    throw new Error(`splitYPercentages[${i}] must be finite, > ${prev}, and <= 1`);
  }
  prev = v;
}
```

### WR-05: IndexedDB split validation is type-only

**File:** `src/lib/shelfStorage.ts:61-68`
**Issue:** `isValidSplitY` accepts any four-number array without range or monotonicity checks. Invalid persisted splits load successfully and propagate to the worker, triggering WR-04 at runtime instead of failing closed on read.
**Fix:** Reuse the same monotonic `(0, 1]` validator in `isValidSplitY` and reject baselines that fail.

## Info

### IN-01: `dedupeAnomalyTypes` exported but unused in pipeline

**File:** `src/lib/vision/classifyContour.ts:39-47`
**Issue:** Helper is unit-tested but never called from `visionWorker.ts` or `classifyContourType`. Either dead code or an incomplete D-09 dedupe integration.
**Fix:** Wire into contour classification if still required, or remove the export to avoid misleading maintainers.

### IN-02: Result UI reads `confidence` but worker emits `score`

**File:** `src/components/ResultInspectView.tsx:248-251`
**Issue:** Missing-item badges display `(item.confidence || 0.98)` while worker anomalies set `score` (0–1). Users always see 98% confidence regardless of actual diff score.
**Fix:** Display `(item.score ?? item.confidence ?? 0)` or map `score` → `confidence` in worker output.

---

_Reviewed: 2026-09-23T21:41:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
