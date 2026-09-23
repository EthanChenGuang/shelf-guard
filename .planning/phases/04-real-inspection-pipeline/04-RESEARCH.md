# Phase 4: Real Inspection Pipeline - Research

**Researched:** 2026-09-23
**Domain:** Client-side OpenCV.js pixel diff in Web Worker, ROI-tier shelf inspection, tolerance-driven re-analysis
**Confidence:** MEDIUM

## Summary

Phase 4 replaces the mock `analyzeShelfCapture()` in `src/lib/vision.ts` with a real per-tier OpenCV.js pipeline running in a dedicated Web Worker. The locked stack is `@techstark/opencv-js` v5 (WASM) loaded **inside the worker only**, with Vite's `?worker` import for bundling. The main thread decodes capture and baseline images to `ImageBitmap`, posts them with transferables, and keeps the existing FSM (`SCANNING_ANIM` → optional `PROCESSING` → `RESULT_INSPECT`) non-blocking per STAB-03.

The highest-risk integration point is **OpenCV.js + Vite module workers**: historical issues with `this` being `undefined` in ESM strict mode were patched in `@techstark/opencv-js` v5 via `globalThis` [CITED: github.com/vitejs/vite/issues/6710], but production-build verification is mandatory before ship. The v5 API uses `import cvReadyPromise from "@techstark/opencv-js"; const cv = await cvReadyPromise` [CITED: github.com/TechStark/opencv-js] — one init per worker lifetime.

Per-tier diff follows locked heuristics: grayscale → GaussianBlur 5×5 → absdiff → threshold → morph close 3×3 → findContours → MISSING/MOVED classification with normalized bounding boxes reusing the existing `DetectedAnomaly` contract [VERIFIED: src/types.ts:20-36]. A continuous tolerance slider (0–100) replaces the enum `'strict' | 'normal' | 'loose'` [VERIFIED: src/types.ts:9] and drives three diff parameters via linear interpolation [from CONTEXT D-12]. First capture on empty shelf intercepts to ROI calibration without scan animation [from CONTEXT D-01–D-05].

**Primary recommendation:** Create `src/workers/visionWorker.ts` with lazy `cvReadyPromise` init, extract pure helpers (`toleranceToDiffParams`, `tierBoundsFromSplits`, `normalizeBbox`, `computeComplianceStats`) into `src/lib/vision/` for unit tests, keep `InspectionAnalysisResult` interface stable in `src/lib/vision.ts`, and add golden JPEG pairs under `public/test-fixtures/` for CI diff smoke tests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Camera capture & shutter FSM | Browser / Client (`App.tsx`) | — | Existing FSM owns mode transitions; first-baseline branch extends `handleShutterClick` |
| Image decode to bitmap | Browser / Client (`vision.ts` wrapper) | — | Main thread has DOM/canvas; worker receives transferable `ImageBitmap` |
| OpenCV WASM load & diff | Web Worker (`visionWorker.ts`) | — | TECH-06/VIS-04 lock: never load OpenCV on main thread |
| ROI divider UI & magnifier | Browser / Client (`RoiSetupView.tsx`) | — | Touch/pointer interaction stays on main thread |
| Baseline persistence (Blob + splits) | Browser / Client (`shelfStorage.ts`) | IndexedDB | Phase 2 pattern: JPEG Blob at `shelf:{id}:baseline` |
| Tolerance slider & re-diff trigger | Browser / Client (`ResultInspectView.tsx`) | Web Worker | UI debounces 150ms; worker runs full pipeline |
| Anomaly overlay & dismiss/filter | Browser / Client (`ResultInspectView.tsx`) | — | Session state only; dismissed flags saved in audit |
| Audit record persistence | Browser / Client (`shelfStorage.ts`) | IndexedDB | Anomalies with `dismissed: true` stored per D-23 |
| Golden test fixtures | CDN / Static (`public/test-fixtures/`) | Vitest | Same-origin JPEG pairs for CI without device |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### First-Baseline Capture Flow (ROI-01, success criterion #1)
- **D-01:** When `hasPersistedBaseline === false`, **first shutter intercepts the normal inspect path** — capture frame, set it as pending baseline image, route directly to `ROI_CONFIG`. **No** `SCANNING_ANIM`, **no** diff, **no** `RESULT_INSPECT` until baseline is saved.
- **D-02:** `RoiSetupView` background image is the **just-captured frame** (pending baseline), not `DEFAULT_CALIBRATION` CDN or demo shelf.
- **D-03:** On ROI save ("确认并保存基准"), persist **captured frame as JPEG Blob** + `splitYPercentages` + `imageDimensions` to active shelf via `saveBaseline()`, set `hasPersistedBaseline = true`, return to `CAMERA_IDLE`.
- **D-04:** When `hasPersistedBaseline === true`, shutter follows existing flow: `SCANNING_ANIM` → worker diff → `RESULT_INSPECT` (with `PROCESSING` fallback if diff exceeds 800ms per STAB-03).
- **D-05:** Manual ROI re-entry continues to work on persisted baselines — recalibrate dividers only; image source is current baseline unless user uploaded new photo.

#### Missing vs Displaced Classification (VIS-02)
- **D-06:** **Per-tier pipeline** — for each of 4 ROI bands, crop baseline and capture to same pixel dimensions, grayscale, Gaussian blur (5×5), `absdiff`, binary threshold, morphological close (3×3), `findContours`. Run independently per tier; assign `rowIndex` from tier index.
- **D-07:** **MISSING (red):** diff contour where capture band mean intensity significantly lower than baseline (void heuristic).
- **D-08:** **MOVED (yellow):** diff contour where both bands show foreground content but centroid displacement exceeds `displacementThresholdPx`.
- **D-09:** **De-duplication:** prefer MISSING when void score dominant; cap 8 anomalies per tier by contour area.
- **D-10:** Output **normalized bounding boxes** (0.0–1.0) in full-frame coordinates — reuse `DetectedAnomaly.boundingBox` contract. Drop mock `INITIAL_MOCK_ANOMALIES`.

#### Tolerance Slider Semantics (VIS-03, RSLT-05)
- **D-11:** Replace discrete enum with **continuous slider 0–100**. Migrate IndexedDB: `strict → 25`, `normal → 50`, `loose → 75`.
- **D-12:** Slider maps to: `diffThreshold = round(lerp(60, 15, v/100))`, `minContourArea = round(lerp(200, 1200, v/100))`, `displacementThresholdPx = round(lerp(8, 35, v/100))`.
- **D-13:** Tolerance change re-invokes worker diff on current capture + baseline (debounced ~150ms).
- **D-14:** Preset tick labels at 25/50/75.

#### Viewpoint Drift Without Homography (VIS-01)
- **D-15:** **No homography** in Phase 4.
- **D-16:** Per-tier crop-only normalization; optional **2% horizontal edge inset** per tier.
- **D-17:** Accept residual false positives from 2–5° drift; mitigate via tap-to-dismiss + blink compare.
- **D-18:** Do not block ship on perfect alignment.

#### Web Worker & OpenCV Architecture (TECH-06, VIS-04)
- **D-19:** Install `@techstark/opencv-js`; load WASM **inside dedicated worker** — never on main thread.
- **D-20:** Worker protocol: `{ type: 'analyze', captureBitmap, baselineBitmap, splitYPercentages, toleranceValue }` → `{ anomalies, complianceRate, standardCount, actualCount, missingCount, displacedCount }`. Use Transferable `ImageBitmap`.
- **D-21:** OpenCV init once per worker lifetime; `analyzeShelfCapture()` as thin main-thread wrapper.
- **D-22:** Diff runs in parallel with 800ms scan animation; must not block React render.

#### Result Interaction (RSLT-01–RSLT-06)
- **D-23–D-26:** Retain existing tap-to-dismiss, blink compare, filter by type, complete-inspection shelf-scoped return patterns.

#### Testing & Golden Set
- **D-27:** Unit tests for tolerance→parameter mapping and bbox normalization. Worker integration test with fixture images.
- **D-28:** Golden test image pairs in `public/test-fixtures/`.

### Claude's Discretion
- Exact OpenCV function calls and morph kernel sizes within D-06/D-07/D-08 heuristics.
- Worker bundling approach (Vite `?worker` import vs inline Worker constructor).
- `standardCount` derivation — prefer baseline foreground blob count per tier if feasible.
- I18N keys for slider labels and first-baseline ROI prompt copy.
- Whether `RoiSetupView` "重拍" on first-baseline flow returns to camera discarding pending capture or re-captures in place.

### Deferred Ideas (OUT OF SCOPE)
- Homography / advanced alignment (VIS-07) — v2
- INITIAL_GUIDE first-run wizard (SHLF-05) — Phase 5
- PRD scan-line / breathing shutter / top bar polish — Phase 5
- Export/report generation — v2
- pixelmatch / Canvas-only diff — excluded
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TECH-06 | OpenCV.js in Web Worker | `@techstark/opencv-js` v5 + Vite `?worker`; cvReadyPromise init inside worker; package legitimacy OK |
| VIS-01 | Per-ROI pixel diff replaces mock | Per-tier crop + absdiff pipeline (D-06, D-16); no homography (D-15) |
| VIS-02 | MISSING vs MOVED with bboxes | Contour heuristics D-07/D-08; normalized bbox contract [VERIFIED: src/types.ts:28-33] |
| VIS-03 | Tolerance re-runs diff | Slider 0–100 maps to 3 params (D-12); debounced worker re-invoke (D-13) |
| VIS-04 | Worker non-blocking | Parallel with 800ms scan; PROCESSING fallback [existing STAB-03 pattern] |
| ROI-01 | First capture as calibration background | First-baseline FSM intercept (D-01, D-02) |
| ROI-02 | 4 draggable dividers | Existing `RoiSetupView` splits state — wire pending image |
| ROI-03 | Drag handles | Existing pointer capture pattern |
| ROI-04 | Magnifier | Existing 80px / 2× zoom — no change |
| ROI-05 | Retake / reset / save actions | Add retake on first-baseline; save calls `saveBaseline()` (D-03) |
| RSLT-01 | Red/yellow overlay boxes | Real anomalies from worker; existing overlay CSS |
| RSLT-02 | Blink compare | Existing long-press in `ResultInspectView` |
| RSLT-03 | Tap-to-dismiss | Existing `handleDismissAnomaly` in App |
| RSLT-04 | Stat capsule filter | Existing `filterType` state |
| RSLT-05 | Continuous tolerance slider | Replace 3-button grid per UI-SPEC §8 |
| RSLT-06 | Complete inspection return | Existing `handleCompleteAudit` shelf-scoped path |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@techstark/opencv-js` | `5.0.0-release.1` [VERIFIED: npm registry] | WASM OpenCV in worker: absdiff, blur, morphology, contours | Locked by TECH-06 and Phase 1 D-13; v5 Promise-based init [CITED: github.com/TechStark/opencv-js] |
| Vite `?worker` import | `8.3.0` [VERIFIED: package.json] | Bundle dedicated worker chunk | Native Vite pattern; separate chunk in production [CITED: github.com/vitejs/vite] |
| Vitest | `^5.0.1` [VERIFIED: package.json] | Unit + integration tests | Existing 60-test suite green |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `idb-keyval` | `^6.3.0` | Tolerance migration + baseline Blob | Already used in `src/lib/storage.ts`, `shelfStorage.ts` |
| `fake-indexeddb` | `6.2.5` | Test IndexedDB | Existing vitest.setup.ts pattern |
| Browser `ImageBitmap` + `OffscreenCanvas` | — | Zero-copy image handoff to worker | Transferable postMessage [CITED: MDN ImageBitmap] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@techstark/opencv-js` | `@opencvjs/worker` | Better module-worker ergonomics but **violates locked TECH-06 / D-13** — do not use |
| `@techstark/opencv-js` | pixelmatch / Canvas diff | Excluded by project constraint |
| Vite `?worker` | `new Worker(url, {type:'module'})` | Equivalent when bundled; `?worker` is project convention per STACK.md |

**Installation:**
```bash
npm install @techstark/opencv-js
```

**Version verification:**
```bash
npm view @techstark/opencv-js version
# → 5.0.0-release.1 (published 2026-06-24)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@techstark/opencv-js` | npm | ~3 mo (2026-06-24) | ~134k/wk | github.com/TechStark/opencv-js | OK | Approved |
| postinstall script | — | — | — | — | none | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[Shutter tap]
     │
     ├─ hasPersistedBaseline === false ──► captureFrame()
     │         │
     │         ▼
     │    set pendingBaselineImageUrl
     │         │
     │         ▼
     │    ROI_CONFIG (RoiSetupView)
     │         │
     │    [Save Calibration] ──► saveBaseline(Blob + splits) ──► CAMERA_IDLE
     │
     └─ hasPersistedBaseline === true ──► captureFrame()
               │
               ├─ main: dataUrl → ImageBitmap ×2
               │
               ├─ postMessage(analyze) ──────────────► [visionWorker]
               │   (transfer ImageBitmaps)              │
               │                                        ├─ await cvReadyPromise (once)
               │                                        ├─ for tier 0..3:
               │                                        │    crop + inset
               │                                        │    grayscale → blur → absdiff
               │                                        │    threshold → morph close
               │                                        │    findContours → classify
               │                                        └─ return anomalies + stats
               │
               ├─ SCANNING_ANIM (0–800ms)  ║  worker running
               │
               ├─ if worker > 800ms → PROCESSING overlay
               │
               ▼
          RESULT_INSPECT
               │
               ├─ tolerance slider (debounced) ──► re-postMessage(analyze)
               ├─ tap dismiss / blink compare (main thread only)
               └─ complete audit ──► appendAuditRecord ──► CAMERA_IDLE
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── vision.ts              # Thin wrapper: decode → worker → InspectionAnalysisResult
│   ├── vision/
│   │   ├── toleranceParams.ts # Pure: toleranceValue → diffThreshold, minContourArea, displacementPx
│   │   ├── tierGeometry.ts    # Pure: splitYPercentages + dims → pixel crop rects + 2% inset
│   │   ├── bboxUtils.ts       # Pure: pixel rect → normalized DetectedAnomaly.boundingBox
│   │   └── complianceStats.ts # Pure: computeComplianceStats (dedupe App + vision formula)
│   └── shelfStorage.ts        # Unchanged API; first-baseline save uses existing saveBaseline()
├── workers/
│   └── visionWorker.ts        # OpenCV init + per-tier diff (NEW)
public/
└── test-fixtures/
    ├── baseline-aligned.jpg   # Golden pair — same viewpoint
    ├── capture-missing.jpg    # Intentional void in tier 3
    └── capture-displaced.jpg  # Intentional shift in tier 1
```

### Pattern 1: Vite Worker + OpenCV Init (once per worker)

**What:** Import worker via `?worker`; lazy-init OpenCV inside worker on first message.
**When to use:** All diff operations (TECH-06).
**Example:**
```typescript
// src/lib/vision.ts — main thread wrapper
import VisionWorker from '../workers/visionWorker?worker';

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) worker = new VisionWorker();
  return worker;
}

export async function analyzeShelfCapture(
  capturedDataUrl: string,
  baseline: ShelfCalibration,
  toleranceValue: number,
): Promise<InspectionAnalysisResult> {
  const [captureBitmap, baselineBitmap] = await Promise.all([
    dataUrlToImageBitmap(capturedDataUrl),
    dataUrlToImageBitmap(baseline.imageDataUrl),
  ]);

  return new Promise((resolve, reject) => {
    const w = getWorker();
    const onMessage = (e: MessageEvent) => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      captureBitmap.close();
      baselineBitmap.close();
      resolve(e.data);
    };
    const onError = (err: ErrorEvent) => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      reject(err);
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
```

```typescript
// src/workers/visionWorker.ts
import cvReadyPromise from '@techstark/opencv-js';
// Source: https://github.com/TechStark/opencv-js — v5 cvReadyPromise pattern

let cvInstance: Awaited<typeof cvReadyPromise> | null = null;

async function getCv() {
  if (!cvInstance) cvInstance = await cvReadyPromise;
  return cvInstance;
}

self.onmessage = async (e: MessageEvent) => {
  const cv = await getCv();
  const { captureBitmap, baselineBitmap, splitYPercentages, imageDimensions, toleranceValue } =
    e.data;
  try {
    const result = analyzeAllTiers(cv, captureBitmap, baselineBitmap, splitYPercentages, imageDimensions, toleranceValue);
    self.postMessage(result);
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
  }
};
```

### Pattern 2: Per-Tier Diff Pipeline

**What:** Crop both images to identical tier band at baseline resolution, run OpenCV chain, classify contours.
**When to use:** Each of 4 ROI tiers independently (D-06).
**Example:**
```typescript
// Inside visionWorker.ts — per tier
function diffTier(cv: OpenCV, baselineMat: Mat, captureMat: Mat, params: DiffParams): TierAnomaly[] {
  const grayB = new cv.Mat(), grayC = new cv.Mat();
  const diff = new cv.Mat(), blurred = new cv.Mat(), binary = new cv.Mat();
  const closed = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));

  try {
    cv.cvtColor(baselineMat, grayB, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(captureMat, grayC, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(grayB, grayB, new cv.Size(5, 5), 0);
    cv.GaussianBlur(grayC, grayC, new cv.Size(5, 5), 0);
    cv.absdiff(grayB, grayC, diff);                    // [CITED: techstark opencv-js api-reference]
    cv.threshold(diff, binary, params.diffThreshold, 255, cv.THRESH_BINARY);
    cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel);
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Classify each contour → MISSING | MOVED (D-07, D-08)
    // Cap at 8 per tier by area (D-09)
  } finally {
    grayB.delete(); grayC.delete(); diff.delete(); blurred.delete();
    binary.delete(); closed.delete(); contours.delete(); hierarchy.delete(); kernel.delete();
  }
}
```

### Pattern 3: Tolerance Parameter Mapping (pure, unit-testable)

**What:** Map slider 0–100 to three diff parameters (D-12).
**Example:**
```typescript
// src/lib/vision/toleranceParams.ts
export function toleranceToDiffParams(toleranceValue: number) {
  const t = Math.max(0, Math.min(100, toleranceValue)) / 100;
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return {
    diffThreshold: lerp(60, 15),           // lower slider = stricter
    minContourArea: lerp(200, 1200),
    displacementThresholdPx: lerp(8, 35),
  };
}
```

### Pattern 4: First-Baseline FSM Intercept

**What:** Branch `handleShutterClick` before scan animation when shelf has no persisted baseline.
**When to use:** `hasPersistedBaseline === false` [VERIFIED: src/App.tsx:124 sets from loadBaselineRaw null check].
**Example:**
```typescript
// App.tsx handleShutterClick — new branch at top of try block
if (!hasPersistedBaseline) {
  const frame = await captureFrame(baseline.imageDataUrl);
  setPendingBaselineImageUrl(frame);
  setBaseline((prev) => ({ ...prev, imageDataUrl: frame, imageDimensions: await loadImageDimensions(frame) }));
  setAppMode('ROI_CONFIG');
  return;
}
// existing SCANNING_ANIM → worker → RESULT_INSPECT path
```

### Anti-Patterns to Avoid

- **Loading OpenCV on main thread:** Blocks UI during ~multi-MB WASM compile; violates D-19/D-22.
- **Re-filtering mock anomalies on tolerance change:** D-13 requires full worker re-diff.
- **Storing tolerance as enum after migration:** Breaks slider contract; migrate on load in `storage.ts`.
- **Forgetting `.delete()` on cv.Mat:** WASM heap leak; use try/finally per OpenCV.js patterns [CITED: github.com/TechStark/opencv-js CLAUDE.md].
- **Using homography "just for alignment":** Out of scope D-15; adds complexity without Phase 4 sign-off criteria.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WASM OpenCV runtime | Custom WASM loader | `@techstark/opencv-js` cvReadyPromise | Emscripten Module lifecycle, 8MB+ binary |
| Contour detection | Canvas pixel flood-fill | `cv.findContours` + `cv.contourArea` | Connected-component edge cases, performance |
| Gaussian blur / morphology | Manual convolution kernels | `cv.GaussianBlur`, `cv.morphologyEx` | Correct border handling, SIMD WASM |
| Worker bundling | Manual blob URLs | Vite `?worker` import | HMR, code-splitting, asset paths |
| Image transfer to worker | Base64 clone via postMessage | Transferable `ImageBitmap` | Zero-copy; 1080×1920 RGBA ~8MB [CITED: MDN] |
| Compliance rate formula | Duplicate in App + worker | Single `computeComplianceStats()` helper | Existing duplication noted in CONCERNS.md |

**Key insight:** The product value is contour-level MISSING/MOVED heuristics on real pixels — OpenCV.js already bundles the hard CV primitives; hand-rolling blur/threshold/contours recreates well-tested WASM with worse edge-case handling.

## Common Pitfalls

### Pitfall 1: OpenCV.js ESM / Module Worker Init Failure

**What goes wrong:** Worker throws `Cannot set properties of undefined (setting 'cv')` or `Module is not defined` on first analyze.
**Why it happens:** Legacy OpenCV UMD assumed top-level `this`; Vite ESM workers run strict mode [CITED: github.com/opencv/opencv/issues/27805].
**How to avoid:** Use `@techstark/opencv-js` v5 (globalThis patch applied per [CITED: github.com/vitejs/vite/issues/6710]); init **inside worker file** only; verify `vite build && vite preview` before phase sign-off.
**Warning signs:** Dev works but production build fails; first shutter hangs in PROCESSING forever.

### Pitfall 2: ImageBitmap Lifecycle After Transfer

**What goes wrong:** Attempting to reuse `ImageBitmap` on main thread after `postMessage(..., [bitmap])`.
**Why it happens:** Transferable detaches sender's handle [CITED: MDN ImageBitmap].
**How to avoid:** Close bitmaps in worker after Mat conversion; re-decode on tolerance re-run from cached `capturedFrame` data URL.
**Warning signs:** Blank diff results; `InvalidStateError` in console.

### Pitfall 3: Mat Memory Leaks in Worker

**What goes wrong:** WASM heap grows across repeated tolerance slider drags until tab crashes.
**Why it happens:** Every `new cv.Mat()` requires `.delete()` [CITED: TechStark patterns.md].
**How to avoid:** try/finally around every tier loop; delete MatVector entries after iteration.
**Warning signs:** Slowing re-diff; mobile tab reload after ~20 slider moves.

### Pitfall 4: Viewpoint Drift False Positives

**What goes wrong:** Red/yellow boxes on aligned shelves with 2–5° pan.
**Why it happens:** No homography (D-15); per-tier crop only (D-16).
**How to avoid:** 2% horizontal inset; document as v1 limitation; tap-to-dismiss UX (D-17/D-18); golden tests use **aligned** pairs only for CI pass criteria.
**Warning signs:** QA reports "boxes everywhere" on unchanged shelf.

### Pitfall 5: First-Baseline Path Accidentally Runs Diff

**What goes wrong:** Empty shelf first capture shows mock/real anomalies before calibration saved.
**Why it happens:** Missing `hasPersistedBaseline` guard in `handleShutterClick`.
**How to avoid:** Early return to `ROI_CONFIG` before `setAppMode('SCANNING_ANIM')` (D-01).
**Warning signs:** Scan animation on never-calibrated shelf.

### Pitfall 6: Tolerance Enum / Number Type Mismatch

**What goes wrong:** Stored audits break; slider shows wrong value after upgrade.
**Why it happens:** `ToleranceLevel` is currently `'strict' | 'normal' | 'loose'` [VERIFIED: src/types.ts:9]; persisted audits use same [VERIFIED: src/types/persisted.ts:26].
**How to avoid:** Migration in `loadSavedTolerance()`: map legacy strings → 25/50/75; accept `number` in storage going forward; map old audit records read-only for display.
**Warning signs:** TypeScript errors in `ResultInspectView` props; NaN on slider.

## Code Examples

### ImageBitmap from Data URL (main thread)

```typescript
async function dataUrlToImageBitmap(dataUrl: string): Promise<ImageBitmap> {
  const blob = await fetch(dataUrl).then((r) => r.blob());
  return createImageBitmap(blob);
}
```

### ImageBitmap → cv.Mat in worker (via OffscreenCanvas)

```typescript
async function bitmapToMat(cv: OpenCV, bitmap: ImageBitmap): Promise<Mat> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  const mat = cv.matFromImageData(imageData);
  return mat;
}
```

### Normalized Bounding Box (full-frame coordinates)

```typescript
function pixelRectToNormalized(
  rect: { x: number; y: number; width: number; height: number },
  frameW: number,
  frameH: number,
) {
  return {
    x: rect.x / frameW,
    y: rect.y / frameH,
    width: rect.width / frameW,
    height: rect.height / frameH,
  };
}
// Output must match DetectedAnomaly.boundingBox: x,y,width,height in 0.0–1.0
// [VERIFIED: src/types.ts:28-33 — "x: number; // 0.0 - 1.0 (left)" etc.]
```

### Debounced Tolerance Re-Diff

```typescript
// App.tsx — replace handleToleranceChange
const debouncedReanalyze = useMemo(
  () =>
    debounce(async (value: number) => {
      const result = await analyzeShelfCapture(capturedFrame, baseline, value);
      setAnomalies(result.anomalies);
      // ... update counts from result
    }, 150),
  [capturedFrame, baseline],
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mock `INITIAL_MOCK_ANOMALIES` filter | Real OpenCV per-tier diff | Phase 4 | Core product value delivered |
| 3-button tolerance enum | Continuous slider 0–100 | Phase 4 (D-11) | Finer control; requires storage migration |
| `INITIAL_GUIDE` for empty shelf | Direct ROI_CONFIG intercept | Phase 4 (D-01) | Faster first baseline; SHLF-05 deferred Phase 5 |
| Main-thread vision (planned Canvas) | Web Worker + OpenCV WASM | Phase 4 (TECH-06) | Non-blocking 800ms scan animation |

**Deprecated/outdated:**
- `INITIAL_MOCK_ANOMALIES` production path — remove imports from `vision.ts` after worker wired.
- `ToleranceLevel` enum for new writes — migrate to `number`; keep read compat for old audits.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@techstark/opencv-js` v5 works in Vite `?worker` module workers without manual patches | Pitfall 1 | Production build fails; fallback to classic worker or vite `define` workaround needed |
| A2 | `cv.matFromImageData` accepts RGBA from OffscreenCanvas for 1080×1920 captures | Code Examples | Color space mismatch → wrong diff results |
| A3 | 800ms scan budget sufficient for 4-tier diff on mid-range mobile after WASM warm-init | Environment | Frequent PROCESSING overlay; acceptable per STAB-03 but UX degradation |
| A4 | Golden aligned JPEG pairs sufficient for CI without device camera | Testing | Drift cases only caught manually |
| A5 | Baseline foreground blob count feasible for `standardCount` within performance budget | Discretion | Fall back to fixed 24 if contour count too slow |

## Open Questions

1. **First WASM load may exceed 800ms on cold start (RESOLVED)**
   - What we know: UI-SPEC flags opencv-worker-init as unresolved; PROCESSING overlay covers runtime [from 04-UI-SPEC.md].
   - **Resolution:** Pre-spawn worker and run `cvReadyPromise` init on first `CAMERA_IDLE` entry when `hasPersistedBaseline === true`. No separate init UI — cold start beyond 800ms is covered by existing PROCESSING overlay (STAB-03). Lazy init only when shelf has no persisted baseline (first-baseline path skips diff entirely per D-01).

2. **`standardCount` derivation (RESOLVED)**
   - What we know: Mock uses fixed 24 [VERIFIED: src/lib/vision.ts:59]; discretion allows baseline blob count per tier.
   - **Resolution:** Worker counts baseline foreground blobs (contours above `minContourArea` per tier) during each analyze pass and sums across tiers for `standardCount`. If sum is zero (empty baseline band or init failure), fallback to fixed 24 to preserve stat capsule UX.

3. **Demo mode capture vs custom baseline (RESOLVED)**
   - What we know: CONCERNS.md notes demo capture may ignore displayed frame.
   - **Resolution:** All capture paths — including demo mode — call `captureFrame(baseline.imageDataUrl)` so the returned frame matches the displayed baseline image. Golden tests and first-baseline flow both depend on this consistency; verify in `App.firstBaseline.integration.test.tsx` and device smoke.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test | ✓ | v23.10.0 | — |
| npm | package install | ✓ | 11.4.2 | bun.lock also present |
| Vite | dev/build/worker bundle | ✓ | 8.3.0 | — |
| Vitest + jsdom | unit/integration tests | ✓ | 5.0.1 | — |
| `@techstark/opencv-js` | vision worker | ✗ (not installed) | — | Install in Wave 0 |
| Web Worker API | TECH-06 | ✓ (Node 23 + jsdom limited) | — | Mock worker in unit tests; real WASM in optional integration test |
| ImageBitmap / OffscreenCanvas | bitmap pipeline | ✓ browser; partial jsdom | — | Mock Mat path in pure unit tests |
| Camera device | manual QA | ✗ in CI | — | Golden fixtures in `public/test-fixtures/` |

**Missing dependencies with no fallback:**
- `@techstark/opencv-js` — blocks real diff until installed

**Missing dependencies with fallback:**
- Physical camera — golden JPEG pairs for automated diff smoke tests

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^5.0.1 [VERIFIED: package.json] |
| Config file | `vitest.config.ts` |
| Setup | `vitest.setup.ts` (fake-indexeddb, jest-dom) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TECH-06 | Worker loads OpenCV, returns result | integration | `npm test -- src/workers/visionWorker.integration.test.ts -x` | ❌ Wave 0 |
| VIS-01 | Per-tier diff on aligned pair | integration | `npm test -- src/workers/visionWorker.integration.test.ts -x` | ❌ Wave 0 |
| VIS-02 | Classifies MISSING vs MOVED | unit + integration | `npm test -- src/lib/vision/classifyContour.test.ts -x` | ❌ Wave 0 |
| VIS-03 | Tolerance params lerp mapping | unit | `bun run test -- src/lib/vision/toleranceParams.test.ts -x` | ❌ Wave 0 |
| VIS-03 | Slider change re-invokes worker diff | integration | `bun run test -- src/App.toleranceReDiff.integration.test.tsx -x` | ❌ Wave 0 |
| VIS-04 | PROCESSING when >800ms | integration | `npm test -- src/App.processing.integration.test.tsx -x` | ✅ |
| ROI-01 | First baseline → ROI_CONFIG, no scan | integration | `npm test -- src/App.firstBaseline.integration.test.tsx -x` | ❌ Wave 0 |
| RSLT-05 | Slider replaces 3-button UI | component | `npm test -- src/components/ResultInspectView.tolerance.test.tsx -x` | ❌ Wave 0 |
| RSLT-06 | Complete inspection saves audit, returns to shelf camera | integration | `bun run test -- src/App.completeAudit.integration.test.tsx -x` | ❌ Wave 0 |
| STAB-03 | Shutter lock during scan/process | unit | `bun run test -- src/App.capture.test.ts -x` | ✅ |

### Sampling Rate

- **Per task commit:** `npm test -- <new-test-file> -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (currently 60 tests) + manual aligned-capture checkpoint on device

### Wave 0 Gaps

- [ ] `src/lib/vision/toleranceParams.ts` + `toleranceParams.test.ts` — covers VIS-03 mapping
- [ ] `src/lib/vision/bboxUtils.ts` + `bboxUtils.test.ts` — covers VIS-02 output contract
- [ ] `src/lib/vision/complianceStats.ts` — dedupe formula from App + vision
- [ ] `src/workers/visionWorker.ts` + integration test with golden fixtures — covers TECH-06, VIS-01
- [ ] `public/test-fixtures/` — baseline + capture JPEG pairs (D-28)
- [ ] `src/App.firstBaseline.integration.test.tsx` — covers ROI-01, D-01
- [ ] `src/App.toleranceReDiff.integration.test.tsx` — covers VIS-03 re-diff trigger, D-13
- [ ] `src/App.completeAudit.integration.test.tsx` — covers RSLT-06, D-26
- [ ] Framework install: `npm install @techstark/opencv-js`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | N/A — local PWA |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A — single-user local |
| V5 Input Validation | yes | Validate worker message fields: numeric tolerance 0–100, splits array length 4, bitmap types |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed worker message causing WASM crash | Denial of Service | Validate message schema before Mat ops; try/catch → error toast + CAMERA_IDLE |
| Oversized image bitmap exhausting WASM heap | Denial of Service | Reject dimensions > baseline.imageDimensions; cap at 1080×1920 capture size |
| Prototype pollution via postMessage data | Tampering | Destructure known fields only; no dynamic eval |
| XSS via anomaly title strings | Info Disclosure | Anomaly titles generated from heuristics (tier index + bbox hash), not user HTML |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory found in workspace — no additional project rule directives beyond user rules and GSD config.

## Sources

### Primary (HIGH/MEDIUM confidence)

- `/techstark/opencv-js` (Context7) — cvReadyPromise, absdiff, GaussianBlur, morphologyEx, findContours, Mat memory patterns
- [github.com/TechStark/opencv-js](https://github.com/TechStark/opencv-js) — v5 import pattern, basic usage
- [github.com/vitejs/vite](https://github.com/vitejs/vite) — `?worker` import, module worker bundling
- [VERIFIED: src/types.ts:1-36] — AppMode, ToleranceLevel, DetectedAnomaly contracts
- [VERIFIED: src/lib/vision.ts:4-11] — InspectionAnalysisResult interface (keep stable)
- [VERIFIED: package.json] — vite 8.3.0, vitest 5.0.1, no opencv yet
- Package legitimacy seam — `@techstark/opencv-js` verdict OK, 134k weekly downloads

### Secondary (MEDIUM confidence)

- [github.com/vitejs/vite/issues/6710](https://github.com/vitejs/vite/issues/6710) — globalThis patch for opencv-js + Vite ESM
- [MDN ImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap) — transferable, worker-available

### Tertiary (LOW confidence — validate at implementation)

- [github.com/opencv/opencv/issues/27805](https://github.com/opencv/opencv/issues/27805) — module worker `this` undefined (mitigated by TechStark v5 patch — verify in prod build)
- Worker + Vitest WASM CI patterns from community (no official TechStark vitest example found)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — package verified OK; worker+ESM compat needs prod-build proof (A1)
- Architecture: HIGH — locked by CONTEXT.md; maps cleanly to existing App FSM and components
- Pitfalls: MEDIUM — drift false positives and WASM init timing are known v1 risks per STATE.md

**Research date:** 2026-09-23
**Valid until:** 2026-10-23 (30 days — opencv-js stable; verify v5.0.0-release.1 patch status if npm updates)
