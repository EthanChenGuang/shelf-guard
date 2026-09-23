# Phase 4: Real Inspection Pipeline - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 21 new/modified files
**Analogs found:** 18 / 21

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` | config | — | `package.json` | exact |
| `src/workers/visionWorker.ts` | service (worker) | batch/transform | `src/lib/vision.ts` | role-match |
| `src/lib/vision.ts` | service | request-response | `src/lib/vision.ts` | exact |
| `src/lib/vision/toleranceParams.ts` | utility | transform | `src/lib/captureLock.ts` | role-match |
| `src/lib/vision/tierGeometry.ts` | utility | transform | `src/components/RoiSetupView.tsx` | data-flow-match |
| `src/lib/vision/bboxUtils.ts` | utility | transform | `src/lib/constants.ts` (mock bboxes) | data-flow-match |
| `src/lib/vision/complianceStats.ts` | utility | transform | `src/lib/vision.ts` + `src/App.tsx` | data-flow-match |
| `src/App.tsx` | controller (FSM) | event-driven | `src/App.tsx` | exact |
| `src/components/RoiSetupView.tsx` | component | event-driven | `src/components/RoiSetupView.tsx` | exact |
| `src/components/ResultInspectView.tsx` | component | event-driven | `src/components/CameraView.tsx` (range slider) | role-match |
| `src/lib/shelfStorage.ts` | service | CRUD/file-I/O | `src/lib/shelfStorage.ts` | exact |
| `src/types.ts` | model | — | `src/types.ts` | exact |
| `src/types/persisted.ts` | model | — | `src/types/persisted.ts` | exact |
| `src/lib/storage.ts` | service | CRUD | `src/lib/shelfStorage.ts` (`runSchemaMigrationIfNeeded`) | role-match |
| `src/lib/vision/toleranceParams.test.ts` | test | — | `src/lib/blobUtils.test.ts` | exact |
| `src/lib/vision/bboxUtils.test.ts` | test | — | `src/lib/blobUtils.test.ts` | exact |
| `src/workers/visionWorker.integration.test.ts` | test | — | `src/App.processing.integration.test.tsx` | role-match |
| `src/App.firstBaseline.integration.test.tsx` | test | — | `src/App.processing.integration.test.tsx` | exact |
| `src/components/ResultInspectView.tolerance.test.tsx` | test | — | `src/components/CameraView.ghost.test.tsx` | role-match |
| `public/test-fixtures/*.jpg` | config (static asset) | file-I/O | `public/manifest.json` | role-match |
| `src/lib/vision/classifyContour.test.ts` | test | — | `src/lib/blobUtils.test.ts` | role-match |

## Pattern Assignments

### `package.json` (config)

**Analog:** `package.json`

Add `@techstark/opencv-js` to `dependencies` alongside existing runtime deps (same block as `idb-keyval`, `react`):

```14:24:package.json
  "dependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^6.1.1",
    "canvas-confetti": "^1.9.4",
    "idb-keyval": "^6.3.0",
    "lucide-react": "^0.546.0",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "vite": "^8.3.0",
    "vite-plugin-pwa": "^1.3.0"
  },
```

**Version pin:** `@techstark/opencv-js@5.0.0-release.1` per RESEARCH.md.

---

### `src/workers/visionWorker.ts` (service/worker, batch/transform)

**Analog:** `src/lib/vision.ts` (result contract) + RESEARCH Pattern 2

**No existing worker in codebase** — this is the first Web Worker. Copy output shape from mock vision service:

```4:11:src/lib/vision.ts
export interface InspectionAnalysisResult {
  anomalies: DetectedAnomaly[];
  complianceRate: number;
  standardCount: number;
  actualCount: number;
  displacedCount: number;
  missingCount: number;
}
```

**Worker entry pattern** — lazy init + message handler with try/catch (from RESEARCH, no codebase analog):

```typescript
import cvReadyPromise from '@techstark/opencv-js';
import { toleranceToDiffParams } from '../lib/vision/toleranceParams';
import { tierBoundsFromSplits } from '../lib/vision/tierGeometry';
import { pixelRectToNormalized } from '../lib/vision/bboxUtils';
import { computeComplianceStats } from '../lib/vision/complianceStats';

let cvInstance: Awaited<typeof cvReadyPromise> | null = null;

async function getCv() {
  if (!cvInstance) cvInstance = await cvReadyPromise;
  return cvInstance;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, captureBitmap, baselineBitmap, splitYPercentages, imageDimensions, toleranceValue } = e.data;
  if (type !== 'analyze') return;
  try {
    const cv = await getCv();
    const params = toleranceToDiffParams(toleranceValue);
    // per-tier diff loop → anomalies + computeComplianceStats()
    self.postMessage(result);
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
  }
};
```

**Mat lifecycle:** try/finally with `.delete()` on every `cv.Mat` — no existing pattern; follow OpenCV.js docs cited in RESEARCH.

**Import pure helpers from `src/lib/vision/`** — worker and main thread share tolerance/geometry/bbox/stats logic for testability.

---

### `src/lib/vision.ts` (service, request-response)

**Analog:** `src/lib/vision.ts` (self — keep interface, replace mock body)

**Stable interface** — do not change signature consumers rely on; migrate `ToleranceLevel` param → `number`:

```18:22:src/lib/vision.ts
export async function analyzeShelfCapture(
  capturedDataUrl: string,
  baseline: ShelfCalibration,
  tolerance: ToleranceLevel
): Promise<InspectionAnalysisResult> {
```

**Replace mock body** with worker dispatch. Copy `captureElementToDataUrl` canvas pattern for bitmap decode helper:

```80:98:src/lib/vision.ts
export function captureElementToDataUrl(
  element: HTMLVideoElement | HTMLImageElement,
  targetWidth = 1080,
  targetHeight = 1920
): string {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  // ...
  return canvas.toDataURL('image/jpeg', 0.92);
}
```

**Worker wrapper pattern** (RESEARCH Pattern 1 — adapt from mock removal):

```typescript
import VisionWorker from '../workers/visionWorker?worker';
import { dataUrlToBlob } from './blobUtils';

let worker: Worker | null = null;
function getWorker(): Worker {
  if (!worker) worker = new VisionWorker();
  return worker;
}

async function dataUrlToImageBitmap(dataUrl: string): Promise<ImageBitmap> {
  const blob = await dataUrlToBlob(dataUrl);
  return createImageBitmap(blob);
}
```

Use one-shot `message`/`error` listeners, transfer `[captureBitmap, baselineBitmap]`, call `.close()` on bitmaps after resolve/reject.

**Remove:** `INITIAL_MOCK_ANOMALIES` import and tolerance enum filtering (lines 25–56).

---

### `src/lib/vision/toleranceParams.ts` (utility, transform)

**Analog:** `src/lib/captureLock.ts` (pure exported function, no side effects)

```1:9:src/lib/captureLock.ts
import {AppMode} from '../types';

/** Returns true when shutter capture should be ignored (STAB-01). */
export function isCaptureLocked(appMode: AppMode, captureLock: boolean): boolean {
  return (
    appMode === 'SCANNING_ANIM' ||
    appMode === 'PROCESSING' ||
    captureLock
  );
}
```

**Core mapping** (replace enum branches in vision.ts lines 33–56):

```typescript
export function toleranceToDiffParams(toleranceValue: number) {
  const t = Math.max(0, Math.min(100, toleranceValue)) / 100;
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return {
    diffThreshold: lerp(60, 15),
    minContourArea: lerp(200, 1200),
    displacementThresholdPx: lerp(8, 35),
  };
}
```

**Legacy enum migration helper** (for storage.ts):

```typescript
export function legacyToleranceToNumber(tol: 'strict' | 'normal' | 'loose'): number {
  return tol === 'strict' ? 25 : tol === 'loose' ? 75 : 50;
}
```

---

### `src/lib/vision/tierGeometry.ts` (utility, transform)

**Analog:** `src/components/RoiSetupView.tsx` (tier split constraints) + `src/lib/constants.ts` (DEFAULT_SPLIT_Y)

**Split defaults:**

```6:6:src/lib/constants.ts
export const DEFAULT_SPLIT_Y: [number, number, number, number] = [0.295, 0.455, 0.618, 0.782];
```

**Tier boundary math** — mirror RoiSetupView neighbor constraints when computing pixel crop rects:

```59:66:src/components/RoiSetupView.tsx
    const minBound = index === 0 ? 0.15 : splits[index - 1] + 0.05;
    const maxBound = index === 3 ? 0.92 : splits[index + 1] - 0.05;
    percent = Math.max(minBound, Math.min(maxBound, percent));

    const newSplits: [number, number, number, number] = [...splits];
    newSplits[index] = Math.round(percent * 1000) / 1000;
    setSplits(newSplits);
```

Export `tierBoundsFromSplits(splitYPercentages, imageDimensions, tierIndex, edgeInsetPct = 0.02)` returning `{ x, y, width, height }` in pixel coords with 2% horizontal inset per D-16.

---

### `src/lib/vision/bboxUtils.ts` (utility, transform)

**Analog:** `src/lib/constants.ts` (normalized bbox contract from mock anomalies)

**Target contract** (types.ts):

```28:33:src/types.ts
  boundingBox: {
    x: number; // 0.0 - 1.0 (left)
    y: number; // 0.0 - 1.0 (top)
    width: number; // 0.0 - 1.0
    height: number; // 0.0 - 1.0
  };
```

**Mock example values** to match in tests:

```30:35:src/lib/constants.ts
    boundingBox: {
      x: 0.32,
      y: 0.37,
      width: 0.28,
      height: 0.09,
    },
```

```typescript
export function pixelRectToNormalized(
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

export function stableAnomalyId(tierIndex: number, bbox: { x: number; y: number; width: number; height: number }): string {
  const hash = `${tierIndex}-${bbox.x.toFixed(3)}-${bbox.y.toFixed(3)}-${bbox.width.toFixed(3)}-${bbox.height.toFixed(3)}`;
  return `anomaly-${hash}`;
}
```

---

### `src/lib/vision/complianceStats.ts` (utility, transform)

**Analog:** `src/lib/vision.ts` (lines 58–65) + `src/App.tsx` `handleDismissAnomaly` (lines 247–254)

**Vision mock formula** — extract to single helper used by worker and App dismiss:

```58:65:src/lib/vision.ts
  const standardCount = 24;
  const missingCount = filteredAnomalies.filter((a) => a.type === 'MISSING' && !a.dismissed).length;
  const displacedCount = filteredAnomalies.filter((a) => a.type === 'MOVED' && !a.dismissed).length;
  const actualCount = standardCount - missingCount;

  // Compliance: penalizes missing items by 4% and displaced by 2%
  const complianceRate = Math.max(70, Math.min(100, 100 - missingCount * 4 - displacedCount * 2));
```

**Dismiss recalc** (App.tsx — same formula, keep in sync):

```247:254:src/App.tsx
      const activeMissing = next.filter((a) => a.type === 'MISSING' && !a.dismissed).length;
      const activeDisplaced = next.filter((a) => a.type === 'MOVED' && !a.dismissed).length;
      setMissingCount(activeMissing);
      setDisplacedCount(activeDisplaced);
      setActualCount(standardCount - activeMissing);
      setComplianceRate(
        Math.max(70, Math.min(100, 100 - activeMissing * 4 - activeDisplaced * 2))
      );
```

Export `computeComplianceStats(anomalies, standardCount)` returning `{ complianceRate, actualCount, missingCount, displacedCount }`.

---

### `src/App.tsx` (controller/FSM, event-driven)

**Analog:** `src/App.tsx` (self)

**Imports block** — extend existing shelf/vision imports; add no new top-level libraries:

```1:44:src/App.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AuditRecord,
  AppMode,
  DetectedAnomaly,
  Language,
  ShelfCalibration,
  ToleranceLevel,
} from './types';
// ... storage, shelfStorage, vision, hooks, components
```

**State additions** — follow existing baseline state pattern (line 56–57):

```typescript
const [pendingBaselineImageUrl, setPendingBaselineImageUrl] = useState<string | null>(null);
const [tolerance, setTolerance] = useState<number>(50); // migrate from ToleranceLevel
```

**First-baseline FSM branch** — insert at top of `handleShutterClick` try block (before line 200 `captureFrame`):

```193:201:src/App.tsx
  const handleShutterClick = async () => {
    if (isCaptureLocked(appMode, captureLockRef.current)) return;

    captureLockRef.current = true;
    setIsShutterLocked(true);

    try {
      const frame = await captureFrame(baseline.imageDataUrl);
      setCapturedFrame(frame);
```

New branch after `captureFrame`:

```typescript
if (!hasPersistedBaseline) {
  const dimensions = await loadImageDimensions(frame);
  setPendingBaselineImageUrl(frame);
  setBaseline((prev) => ({ ...prev, imageDataUrl: frame, imageDimensions: dimensions }));
  setAppMode('ROI_CONFIG');
  return;
}
```

**Existing inspect path** — keep parallel scan + analysis (lines 202–236):

```210:236:src/App.tsx
      let analysisDone = false;
      const analysisPromise = analyzeShelfCapture(frame, baseline, tolerance).then(
        (result) => {
          analysisDone = true;
          return result;
        },
      );

      scanTimerRef.current = setTimeout(() => {
        if (!analysisDone) {
          setAppMode((mode) => (mode === 'SCANNING_ANIM' ? 'PROCESSING' : mode));
        }
      }, 800);
      // ... await result, setAppMode('RESULT_INSPECT')
```

**Tolerance re-diff** — extend existing handler with debounce (150ms):

```167:179:src/App.tsx
  const handleToleranceChange = async (newTol: ToleranceLevel) => {
    setTolerance(newTol);
    await saveTolerance(newTol);
    const result = await analyzeShelfCapture(capturedFrame, baseline, newTol);
    setAnomalies(result.anomalies);
    setComplianceRate(result.complianceRate);
    // ... update counts
  };
```

Change signature to `(value: number)`, use debounced wrapper, pass numeric tolerance to worker.

**ROI save from first capture** — extend `handleSaveRoiCalibration` to persist full baseline image (not just splits):

```306:322:src/App.tsx
  const handleSaveRoiCalibration = async (
    updatedPercentages: [number, number, number, number]
  ) => {
    const updated: ShelfCalibration = {
      ...baseline,
      splitYPercentages: updatedPercentages,
      createdAt: Date.now(),
    };
    const result = await saveBaseline(activeShelfId, updated);
    // ... setHasPersistedBaseline(true), setAppMode('CAMERA_IDLE')
  };
```

When `pendingBaselineImageUrl` is set, ensure `updated.imageDataUrl` is the captured frame (already in baseline state from first-baseline branch). Clear `pendingBaselineImageUrl` on save.

**Upload baseline analog** — copy object URL registry pattern from upload handler:

```358:366:src/App.tsx
          const registry = urlRegistryRef.current;
          registry.revoke(`baseline:${activeShelfId}`);
          const blob = await fetch(dataUrl).then((r) => r.blob());
          const displayUrl = registry.set(`baseline:${activeShelfId}`, blob);
          setHasPersistedBaseline(true);
          setBaseline({ ...newCalibration, imageDataUrl: displayUrl });
          setShowResetModal(false);
          setAppMode('ROI_CONFIG');
```

---

### `src/components/RoiSetupView.tsx` (component, event-driven)

**Analog:** `src/components/RoiSetupView.tsx` (self)

**Background image** — already reads `baseline.imageDataUrl`; first-baseline flow sets this via App state before routing to ROI_CONFIG:

```123:128:src/components/RoiSetupView.tsx
          <img
            src={baseline.imageDataUrl}
            alt="Calibration Still Shelf Frame"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
```

**Optional prop** `isFirstBaseline?: boolean` for copy variant — follow existing props interface:

```17:22:src/components/RoiSetupView.tsx
interface RoiSetupViewProps {
  baseline: ShelfCalibration;
  lang: Language;
  onSave: (updatedPercentages: [number, number, number, number]) => void;
  onCancel: () => void;
}
```

**Pointer drag pattern** — reuse unchanged for tier dividers:

```47:76:src/components/RoiSetupView.tsx
  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    setActiveTierIndex(index);
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  // handlePointerMove, handlePointerUp with neighbor bounds
```

**Save confirm** — existing `handleConfirm` → `onSave(splits)`:

```83:89:src/components/RoiSetupView.tsx
  const handleConfirm = () => {
    setIsSavedAnimation(true);
    onSave(splits);
    setTimeout(() => {
      setIsSavedAnimation(false);
    }, 1500);
  };
```

---

### `src/components/ResultInspectView.tsx` (component, event-driven)

**Analog:** `src/components/CameraView.tsx` (continuous range slider)

**Replace 3-button grid** (lines 318–355) with horizontal slider matching ghost opacity control:

```364:372:src/components/CameraView.tsx
            <input
              type="range"
              min="0"
              max="100"
              value={ghostOpacity}
              onChange={(e) => onGhostOpacityChange(Number(e.target.value))}
              aria-label={t.ghostOpacity}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
```

**Props migration** — change `tolerance: ToleranceLevel` → `tolerance: number`, `onToleranceChange: (value: number) => void`:

```23:38:src/components/ResultInspectView.tsx
interface ResultInspectViewProps {
  currentCaptureUrl: string;
  baseline: ShelfCalibration;
  anomalies: DetectedAnomaly[];
  // ...
  tolerance: ToleranceLevel;
  onToleranceChange: (tol: ToleranceLevel) => void;
```

**Retain unchanged:** blink compare (`isBlinkingBaseline`), filter (`filterType`), dismiss animation (`handleDismiss`), complete audit (`handleComplete`) — lines 58–96.

**Preset tick labels** at 25/50/75 — display below slider using `font-mono-numbers` badge style from current tolerance label (lines 309–315).

---

### `src/lib/shelfStorage.ts` (service, CRUD/file-I/O)

**Analog:** `src/lib/shelfStorage.ts` (self — API unchanged)

**saveBaseline** — first-baseline flow uses existing API; no new functions required:

```226:242:src/lib/shelfStorage.ts
export async function saveBaseline(
  shelfId: number,
  viewCalibration: ShelfCalibration,
): Promise<StorageWriteResult> {
  const id = validateShelfId(shelfId);
  try {
    const persisted = await viewToPersistedBaseline(viewCalibration);
    await set(baselineKey(id), persisted);
    return {ok: true};
  } catch (err) {
    if (isQuotaError(err)) {
      return {ok: false, error: 'QUOTA_EXCEEDED'};
    }
    // ...
  }
}
```

**Blob conversion** via existing `viewToPersistedBaseline` → `dataUrlToBlob` (lines 71–84).

**Quota error handling** — App checks `result.ok` before state updates (pattern at lines 314–318 App.tsx).

---

### `src/types.ts` (model)

**Analog:** `src/types.ts` (self)

**Replace enum** with numeric type alias; keep read compat type for legacy audits:

```9:9:src/types.ts
export type ToleranceLevel = 'strict' | 'normal' | 'loose';
```

Migration approach:

```typescript
/** @deprecated Legacy enum — use number 0–100 for new writes */
export type ToleranceLevel = 'strict' | 'normal' | 'loose';
export type ToleranceValue = number; // 0–100 slider
```

Update `AuditRecord.tolerance` to `ToleranceValue | ToleranceLevel` for backward compat on read.

**DetectedAnomaly contract** — unchanged (lines 20–36).

---

### `src/types/persisted.ts` (model)

**Analog:** `src/types/persisted.ts` (self)

**Tolerance field** on persisted audits — same migration as types.ts:

```25:27:src/types/persisted.ts
  anomalies: DetectedAnomaly[];
  tolerance: ToleranceLevel;
}
```

Change to `tolerance: ToleranceValue | ToleranceLevel` — old IndexedDB records retain string values.

---

### `src/lib/storage.ts` (service, CRUD)

**Analog:** `src/lib/shelfStorage.ts` `runSchemaMigrationIfNeeded` (migration pattern)

**Current tolerance load/save:**

```26:43:src/lib/storage.ts
export async function loadSavedTolerance(): Promise<ToleranceLevel> {
  try {
    const tol = await get<ToleranceLevel>(KEY_TOLERANCE);
    if (tol === 'strict' || tol === 'normal' || tol === 'loose') return tol;
  } catch (err) {
    console.warn('Failed to load tolerance:', err);
  }
  return 'normal';
}

export async function saveTolerance(tol: ToleranceLevel): Promise<void> {
  try {
    await set(KEY_TOLERANCE, tol);
  } catch (err) {
    console.error('Failed to save tolerance:', err);
  }
}
```

**Migration on load** — map legacy strings → numbers, rewrite to IndexedDB (mirror schema migration try/catch):

```107:112:src/lib/shelfStorage.ts
export async function runSchemaMigrationIfNeeded(): Promise<StorageWriteResult> {
  try {
    const version = await get<number>(KEY_SCHEMA_VERSION);
    if (version === CURRENT_SCHEMA) {
      return {ok: true};
    }
```

New `loadSavedTolerance(): Promise<number>`:

```typescript
export async function loadSavedTolerance(): Promise<number> {
  try {
    const tol = await get<number | ToleranceLevel>(KEY_TOLERANCE);
    if (typeof tol === 'number' && tol >= 0 && tol <= 100) return tol;
    if (tol === 'strict') { await set(KEY_TOLERANCE, 25); return 25; }
    if (tol === 'loose') { await set(KEY_TOLERANCE, 75); return 75; }
    if (tol === 'normal') { await set(KEY_TOLERANCE, 50); return 50; }
  } catch (err) {
    console.warn('Failed to load tolerance:', err);
  }
  return 50;
}
```

---

### `src/lib/vision/toleranceParams.test.ts` (test)

**Analog:** `src/lib/blobUtils.test.ts`

**Structure:**

```1:38:src/lib/blobUtils.test.ts
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {compressToJpegBlob, isQuotaError} from './blobUtils';

describe('blobUtils', () => {
  describe('isQuotaError', () => {
    it('returns true for DOMException QuotaExceededError', () => {
      const err = new DOMException('Quota exceeded', 'QuotaExceededError');
      expect(isQuotaError(err)).toBe(true);
    });
```

Test cases: `toleranceValue=0` → strict params, `50` → mid, `100` → loose, clamp out-of-range, legacy enum mapping.

---

### `src/lib/vision/bboxUtils.test.ts` (test)

**Analog:** `src/lib/blobUtils.test.ts` (pure function, no mocks needed)

Test `pixelRectToNormalized` with known 1080×1920 frame; assert 0.0–1.0 range matches `INITIAL_MOCK_ANOMALIES` bbox from constants.

---

### `src/workers/visionWorker.integration.test.ts` (test)

**Analog:** `src/App.processing.integration.test.tsx` (integration with mocked heavy deps)

**Mock pattern** — partial mock preserving actual exports:

```6:28:src/App.processing.integration.test.tsx
vi.mock('./lib/vision', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/vision')>();
  return {
    ...actual,
    analyzeShelfCapture: vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                anomalies: [],
                complianceRate: 95,
                // ...
              }),
            1200,
          );
        }),
    ),
  };
});
```

For worker integration: load golden fixtures from `public/test-fixtures/`, optionally mock `@techstark/opencv-js` if WASM unavailable in jsdom; assert MISSING/MOVED counts on fixture pairs.

---

### `src/App.firstBaseline.integration.test.tsx` (test)

**Analog:** `src/App.processing.integration.test.tsx`

**Setup mocks** — same camera/storage/vision mock block (lines 30–71).

**Key assertion:** `loadBaselineRaw` returns `null` → shutter click routes to ROI setup, **no** scan overlay text, **no** `analyzeShelfCapture` call.

Use `loadBaselineRaw: vi.fn(async () => null)` in shelfStorage mock.

---

### `src/components/ResultInspectView.tolerance.test.tsx` (test)

**Analog:** `src/components/CameraView.ghost.test.tsx` (isolated component render)

**Props fixture pattern:**

```12:29:src/components/CameraView.ghost.test.tsx
const baseProps = {
  baseline: DEFAULT_CALIBRATION,
  lang: 'cn' as const,
  onLanguageToggle: vi.fn(),
  onShutterClick: vi.fn(),
  // ...
  ghostOpacity: 45,
  onGhostOpacityChange: vi.fn(),
};
```

Assert: range input present (not 3 buttons), `onToleranceChange` fired with numeric value on slider change, tick labels at 25/50/75 visible.

---

### `public/test-fixtures/*.jpg` (static asset)

**Analog:** `public/manifest.json` (checked-in static files served from `/`)

Place under `public/test-fixtures/`:
- `baseline-aligned.jpg`
- `capture-missing.jpg`
- `capture-displaced.jpg`

Load in tests via `fetch('/test-fixtures/baseline-aligned.jpg')` or Vitest `readFileSync` from disk path.

---

## Shared Patterns

### FSM Mode Transitions
**Source:** `src/App.tsx`
**Apply to:** `handleShutterClick`, `handleSaveRoiCalibration`, `handleCompleteAudit`

```typescript
setAppMode('SCANNING_ANIM');  // inspect path only
setAppMode('PROCESSING');     // when analysis > 800ms
setAppMode('ROI_CONFIG');     // first baseline + manual recalibrate
setAppMode('RESULT_INSPECT'); // after analysis
setAppMode('CAMERA_IDLE');    // after save/complete
```

Capture lock prevents double-shutter during scan/process:

```4:9:src/lib/captureLock.ts
export function isCaptureLocked(appMode: AppMode, captureLock: boolean): boolean {
  return (
    appMode === 'SCANNING_ANIM' ||
    appMode === 'PROCESSING' ||
    captureLock
  );
}
```

### IndexedDB Persistence + Quota Errors
**Source:** `src/lib/shelfStorage.ts`
**Apply to:** `saveBaseline`, `appendAuditRecord`, `saveTolerance`

```typescript
const result = await saveBaseline(activeShelfId, updated);
if (!result.ok) {
  setQuotaError(true);
  return;
}
```

### Object URL Registry for Baseline Display
**Source:** `src/lib/objectUrlRegistry.ts` + `src/App.tsx` `loadShelfData`
**Apply to:** After first-baseline save, register blob for display URL

```109:116:src/App.tsx
    const persisted = await loadBaselineRaw(shelfId);
    let nextBaseline: ShelfCalibration;
    if (persisted) {
      const displayUrl = registry.set(`baseline:${shelfId}`, persisted.imageBlob);
      nextBaseline = toViewBaseline(persisted, displayUrl);
```

Worker receives decoded bitmaps from data URLs — not registry blob URLs.

### Parallel Scan Animation + Async Analysis
**Source:** `src/App.tsx` lines 210–236
**Apply to:** All inspect-path shutter clicks (D-04, STAB-03)

Analysis promise runs concurrently with 800ms timer; transition to PROCESSING if not done.

### Anomaly Dismiss + Stat Recalc
**Source:** `src/App.tsx` `handleDismissAnomaly`
**Apply to:** ResultInspectView tap-to-dismiss (D-23)

Session-only dismiss until `handleCompleteAudit` persists `dismissed: true` in audit record.

### Integration Test Mock Stack
**Source:** `src/App.processing.integration.test.tsx`
**Apply to:** All new App integration tests

Standard mocks: `./lib/vision`, `./hooks/useCameraStream`, `./hooks/useDeviceOrientation`, `./hooks/usePWAInstall`, `./lib/storage`, `./lib/shelfStorage`.

Use `vi.useFakeTimers({ shouldAdvanceTime: true })` for scan/process timing tests.

### Pure Utility Module Convention
**Source:** `src/lib/captureLock.ts`, `src/lib/imageDimensions.ts`, `src/lib/blobUtils.ts`
**Apply to:** All `src/lib/vision/*.ts` helpers

- Single responsibility exported functions
- JSDoc one-liner when non-obvious
- No React/DOM imports in pure helpers (except bbox/tolerance)
- Co-located `*.test.ts` beside module or in same directory

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/workers/visionWorker.ts` (OpenCV Mat pipeline) | service/worker | batch/transform | First Web Worker in repo; no OpenCV usage exists. Use RESEARCH.md Patterns 1–2 + `@techstark/opencv-js` cvReadyPromise init. |
| `src/lib/vision/classifyContour.ts` (if extracted) | utility | transform | No contour/CV code in codebase. Derive from RESEARCH Pattern 2 (`diffTier` heuristics D-07/D-08). |

## Metadata

**Analog search scope:** `src/`, `public/`, `package.json`, `vitest.config.ts`
**Files scanned:** 40 TypeScript/TSX source files + 16 test files
**Pattern extraction date:** 2026-09-23
**Git-tracked analog verification:** All cited analog paths confirmed via `git ls-files` (no `.gsd/capabilities/` mirror paths used)
