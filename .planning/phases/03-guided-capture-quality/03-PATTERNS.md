# Phase 3: Guided Capture Quality - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 8
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/hooks/useDeviceOrientation.ts` | hook | event-driven | `src/hooks/useDeviceOrientation.ts` (brownfield extend) | exact |
| `src/hooks/useCameraStream.ts` | hook | request-response | `src/hooks/useCameraStream.ts` (`startCamera` / `toggleDemoMode`) | exact |
| `src/components/CameraView.tsx` | component | transform | `src/components/CameraView.tsx` (ghost, crosshair, error banner) | exact |
| `src/App.tsx` | provider | CRUD | `src/App.tsx` (ghostOpacity, loadShelfData, cameraError wiring) | exact |
| `src/lib/constants.ts` | config | transform | `src/lib/constants.ts` (camera I18N keys) | exact |
| `src/hooks/useDeviceOrientation.test.ts` | test | event-driven | `src/hooks/useCameraStream.torch.test.ts` | role-match |
| `src/components/CameraView.ghost.test.tsx` | test | transform | `src/components/CameraView.error.test.tsx` | role-match |
| `src/App.shelfIsolation.integration.test.tsx` | test | CRUD | `src/App.shelfIsolation.integration.test.tsx` (shelf switch) | exact |

## Pattern Assignments

### `src/hooks/useDeviceOrientation.ts` (hook, event-driven)

**Analog:** `src/hooks/useDeviceOrientation.ts` — extend in place; hook-test pattern from `src/hooks/useCameraStream.torch.test.ts`

**Imports pattern** (lines 1-2):

```typescript
import { useEffect, useRef, useState } from 'react';
```

**Core orientation listener pattern** (lines 9-47) — retain gamma clamp, ±1.5° level, 1200ms haptic debounce; **gate listener attachment** behind permission grant:

```typescript
const handleOrientation = (event: DeviceOrientationEvent) => {
  if (event.gamma !== null && event.gamma !== undefined) {
    sensorDetected = true;
    setHasSensor(true);
    const rawTilt = Math.min(Math.max(event.gamma, -30), 30);
    const rounded = Math.round(rawTilt * 10) / 10;
    setTilt(rounded);

    const levelCondition = Math.abs(rounded) <= 1.5;
    setIsLevel(levelCondition);

    if (levelCondition) {
      const now = Date.now();
      if (now - lastVibrateTime.current > 1200) {
        try {
          navigator.vibrate?.(40);
        } catch {
          // ignore vibration error
        }
        lastVibrateTime.current = now;
      }
    }
  }
};
```

**Simulate path pattern** (lines 49-65) — keep 800ms debounce for desktop QA; export unchanged:

```typescript
const setSimulatedTilt = (newTilt: number) => {
  setTilt(newTilt);
  const levelCondition = Math.abs(newTilt) <= 1.5;
  setIsLevel(levelCondition);
  if (levelCondition) {
    const now = Date.now();
    if (now - lastVibrateTime.current > 800) {
      try {
        navigator.vibrate?.(40);
      } catch {
        // ignore
      }
      lastVibrateTime.current = now;
    }
  }
};
```

**New exports to add** (mirror `useCameraStream` error-state pattern from lines 32, 112-114, 152-162):
- `orientationPermission: 'granted' | 'denied' | 'prompt' | 'unsupported'`
- `requestOrientationPermission(): Promise<'granted' | 'denied'>`
- Attach `deviceorientation` listener only after grant (or immediately when `DeviceOrientationEvent.requestPermission` is absent — non-iOS)
- 3s no-event timeout → `hasSensor === false` (existing flag; enables simulate toggle on desktop)

**Error handling pattern:** wrap `requestPermission()` in try/catch; set `'denied'` on rejection; never throw to caller (camera stream continues independently).

---

### `src/hooks/useCameraStream.ts` (hook, request-response)

**Analog:** `src/hooks/useCameraStream.ts`

**Imports pattern** (lines 1-2):

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
```

**Core getUserMedia pattern** (lines 38-77) — chain orientation **after** successful stream attach, before return:

```typescript
const startCamera = useCallback(async () => {
  try {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not available');
    }

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    setStream(mediaStream);
    setCameraError(null);
    setIsUsingDemoFeed(false);
    // ... track capabilities + videoRef.play()
  } catch (err) {
    console.warn('Camera access could not be initialized:', err);
    setCameraError((err as Error).message);
    setIsUsingDemoFeed(true);
  }
}, [facingMode, stream]);
```

**Insertion point:** `toggleDemoMode` (lines 116-123) calls `startCamera()` on demo→live transition — orientation request belongs inside `startCamera` after line 58 (`setIsUsingDemoFeed(false)`) via injected callback or direct hook composition in `App.tsx`. Prefer **App-level orchestration** (pass `requestOrientationPermission` into `startCamera` wrapper) to avoid circular hook deps — copy `App.tsx` camera wiring (lines 397-399):

```typescript
cameraError={cameraError}
onRetryCamera={startCamera}
onDismissCameraError={clearCameraError}
```

**Demo-first default** (line 36): retain `isUsingDemoFeed: true` — no auto-start on mount (lines 125-129 cleanup only).

---

### `src/components/CameraView.tsx` (component, transform)

**Analog:** `src/components/CameraView.tsx`

**Props interface pattern** (lines 21-51) — extend with orientation + baseline eligibility (mirror existing optional error props):

```typescript
interface CameraViewProps {
  // ... existing props ...
  cameraError?: string | null;
  onRetryCamera?: () => void;
  onDismissCameraError?: () => void;
  // Phase 3 additions:
  hasPersistedBaseline?: boolean;
  orientationDenied?: boolean;
  onRetryOrientation?: () => void;
  onDismissOrientationError?: () => void;
  hasSensor?: boolean;
}
```

**Ghost overlay — conditional visibility** (lines 111-124). **Fix:** wrap with live-feed + persisted-baseline guards; copy torch hide pattern (lines 283-296):

```typescript
{/* Torch Toggle — hidden when unsupported or demo feed */}
{hasTorch && !isUsingDemoFeed && (
```

Apply to ghost block:

```typescript
{!isUsingDemoFeed && hasPersistedBaseline && baseline && (
  <div
    className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen transition-opacity duration-150"
    style={{ opacity: ghostOpacity / 100 }}
  >
    <img
      src={baseline.imageDataUrl}
      alt="Baseline Ghost Overlay"
      className="w-full h-full object-cover object-center filter contrast-125 brightness-110"
    />
    <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay" />
  </div>
)}
```

Add `data-testid="ghost-overlay"` on ghost `div` for component tests.

**Ghost slider hide** (lines 320-357) — same condition as ghost overlay: `{!isUsingDemoFeed && hasPersistedBaseline && (`.

**Level crosshair — always visible** (lines 169-242) — no change to visibility; frozen-at-0° when permission denied comes from hook state (`tilt` stays 0, `isLevel` false/gray styling).

**Simulate toggle guard** (lines 215-240) — show pill only when `onSimulateTiltToggle && !orientationDenied && !hasSensor` (desktop no-sensor fallback per D-13).

**Inline orientation-denied banner** — copy camera error banner verbatim (lines 386-421):

```typescript
{cameraError && (
  <div
    role="alert"
    className="mb-4 w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-900/90 backdrop-blur-md px-4 py-3 text-white shadow-lg"
  >
    <div className="flex items-start gap-2">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{t.cameraPermissionDenied}</p>
        <p className="mt-1 text-xs text-slate-300">{cameraError}</p>
        <p className="mt-2 text-xs text-slate-400">{t.cameraErrorIosGuide}</p>
        <div className="mt-3 flex items-center gap-3">
          {onRetryCamera && (
            <button
              type="button"
              onClick={onRetryCamera}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
            >
              {t.useRealCamera}
            </button>
          )}
        </div>
      </div>
      {onDismissCameraError && (
        <button type="button" onClick={onDismissCameraError} aria-label={t.close} ...>
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  </div>
)}
```

Stack orientation banner **below** `quotaError`, **above or below** `cameraError` (planner discretion D-18) using new I18N keys `orientationPermissionDenied`, `orientationErrorIosGuide`, `retryOrientation`.

**Demo vs live feed** (lines 94-109) — unchanged; demo shows `baseline.imageDataUrl` only (no ghost duplicate).

---

### `src/App.tsx` (provider, CRUD)

**Analog:** `src/App.tsx`

**Global UI pref pattern** (line 60) — ghost opacity stays App-level ephemeral state:

```typescript
const [ghostOpacity, setGhostOpacity] = useState<number>(45);
```

**Shelf baseline load + registry** (lines 100-117) — derive `hasPersistedBaseline` from `loadBaselineRaw` result:

```typescript
const loadShelfData = useCallback(async (shelfId: number) => {
  const registry = urlRegistryRef.current;
  const persisted = await loadBaselineRaw(shelfId);
  let nextBaseline: ShelfCalibration;
  if (persisted) {
    const displayUrl = registry.set(`baseline:${shelfId}`, persisted.imageBlob);
    nextBaseline = toViewBaseline(persisted, displayUrl);
  } else {
    nextBaseline = DEFAULT_CALIBRATION;
  }
  // ...
  setBaseline(nextBaseline);
}, []);
```

Track `hasPersistedBaseline: boolean` in state (set `!!persisted` inside `loadShelfData`) and pass to `CameraView`.

**Device hook wiring** (lines 81, 360-367) — extend destructuring:

```typescript
const { tilt, isLevel, hasSensor, setSimulatedTilt, orientationPermission, requestOrientationPermission } = useDeviceOrientation();
```

**Camera enable gesture orchestration** — wrap `toggleDemoMode` / `startCamera`:

```typescript
const handleStartCamera = async () => {
  await startCamera();
  if (!cameraError) {
    await requestOrientationPermission();
  }
};
```

Pass `onToggleDemoMode` wrapper that calls orientation after live camera success.

**CameraView prop wiring** (lines 375-405) — add alongside existing error props:

```typescript
hasPersistedBaseline={hasPersistedBaseline}
orientationDenied={orientationPermission === 'denied'}
onRetryOrientation={requestOrientationPermission}
onDismissOrientationError={() => { /* clear denied UI if needed */ }}
hasSensor={hasSensor}
```

**Shelf switch URL hygiene** (lines 171-179) — existing `revokeAll()` + `loadShelfData` already swaps ghost source via `baseline.imageDataUrl`; no new pattern needed.

---

### `src/lib/constants.ts` (config, transform)

**Analog:** `src/lib/constants.ts` — camera permission keys (lines 126-128 cn, 192-194 en)

**I18N extension pattern** — add parallel keys in both `cn` and `en` blocks inside `I18N`:

```typescript
cameraPermissionDenied: '无法访问摄像头',
cameraErrorIosGuide:
  '请在 Safari 中打开本页 → 设置 → [ShelfGuard] → 允许相机；或从 Safari「添加到主屏幕」重新安装。也可继续使用演示画面。',
// Phase 3 — mirror structure:
orientationPermissionDenied: '...',
orientationErrorIosGuide: '... Settings → Safari → [app] → Motion & Orientation ...',
retryOrientation: '...',
```

Use `t.orientationPermissionDenied` in banner title slot (same as `t.cameraPermissionDenied` usage in `CameraView.tsx` line 394).

---

### `src/hooks/useDeviceOrientation.test.ts` (test, event-driven) — NEW

**Analog:** `src/hooks/useCameraStream.torch.test.ts`

**Imports + renderHook pattern** (lines 1-3, 34-38):

```typescript
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useDeviceOrientation} from './useDeviceOrientation';
```

**Mock DeviceOrientationEvent.requestPermission:**

```typescript
beforeEach(() => {
  vi.stubGlobal('DeviceOrientationEvent', class {
    static requestPermission = vi.fn().mockResolvedValue('granted');
  });
});
```

**Test cases (D-18):**
- `requestPermission` resolves `'granted'` → listener attached, `orientationPermission === 'granted'`
- resolves `'denied'` → no listener, `orientationPermission === 'denied'`
- `requestPermission` absent → immediate listener (non-iOS `'unsupported'` or auto-grant)
- Retry re-invokes `requestOrientationPermission` without loop

---

### `src/components/CameraView.ghost.test.tsx` (test, transform) — NEW

**Analog:** `src/components/CameraView.error.test.tsx`

**Base props fixture** (lines 6-23):

```typescript
const baseProps = {
  baseline: DEFAULT_CALIBRATION,
  lang: 'cn' as const,
  // ...
  isUsingDemoFeed: true,
  ghostOpacity: 45,
  onGhostOpacityChange: vi.fn(),
};
```

**Test cases (D-18):**
- `isUsingDemoFeed: true` → `queryByTestId('ghost-overlay')` null; slider aria-label absent
- `isUsingDemoFeed: false`, `hasPersistedBaseline: false` → ghost hidden
- `isUsingDemoFeed: false`, `hasPersistedBaseline: true` → ghost visible, slider present
- Orientation banner: mirror `CameraView.error.test.tsx` retry/dismiss tests (lines 38-61) with `onRetryOrientation` / `onDismissOrientationError`

---

### `src/App.shelfIsolation.integration.test.tsx` (test, CRUD) — EXTEND

**Analog:** `src/App.shelfIsolation.integration.test.tsx`

**Mock pattern** (lines 79-101) — extend `useDeviceOrientation` mock with permission fields:

```typescript
vi.mock('./hooks/useDeviceOrientation', () => ({
  useDeviceOrientation: () => ({
    tilt: 0,
    isLevel: true,
    hasSensor: true,
    setSimulatedTilt: vi.fn(),
    orientationPermission: 'granted',
    requestOrientationPermission: vi.fn(),
  }),
}));
```

**Shelf switch assertion helper** (lines 107-114):

```typescript
async function waitForBaselineId(expectedId: string) {
  await waitFor(() => {
    expect(screen.getByTestId('camera-view')).toHaveAttribute(
      'data-baseline-id',
      expectedId,
    );
  });
}
```

**New integration test (D-19):** after switching shelves with live camera + persisted baselines, assert ghost `img[src]` updates to shelf-specific blob URL and no stale `blob:` URLs leak — extend `loads shelf 0 baseline on init and switches to shelf 1` (lines 146-159) with `isUsingDemoFeed: false` mock and `getByAltText('Baseline Ghost Overlay')` src attribute checks.

**IndexedDB setup** (lines 138-144) — reuse `saveBaseline(0/1, makeCalibration(...))` + `stubCompressionGlobals()`.

---

## Shared Patterns

### Inline Device-Permission Banners
**Source:** `src/components/CameraView.tsx` lines 361-421 (`quotaError` + `cameraError`)
**Apply to:** Orientation-denied banner in same bottom control stack

```typescript
<div
  role="alert"
  className="mb-4 w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-900/90 backdrop-blur-md px-4 py-3 text-white shadow-lg"
>
  {/* AlertCircle + title + guide + retry + dismiss X */}
</div>
```

### Demo-Feed Conditional UI
**Source:** `src/components/CameraView.tsx` line 284 (`hasTorch && !isUsingDemoFeed`)
**Apply to:** Ghost overlay (lines 111-124) and right-edge slider (lines 320-357)

### Global Ephemeral UI State in App
**Source:** `src/App.tsx` lines 58-60 (`ghostOpacity`), 58 (`lang`), 62 (`tolerance`)
**Apply to:** Ghost opacity stays global; orientation permission state lives in hook, banner visibility derived in App

### I18N via `I18N[lang]`
**Source:** `src/lib/constants.ts` lines 71-205; consumed as `const t = I18N[lang]` in `CameraView.tsx` line 84
**Apply to:** All new orientation strings — never hardcode in component

### Object URL Registry on Shelf Switch
**Source:** `src/lib/objectUrlRegistry.ts` lines 1-31; `App.tsx` lines 171-179 (`revokeAll` before `loadShelfData`)
**Apply to:** Ghost image source swaps via `baseline.imageDataUrl` from registry — no cross-shelf bleed

### Hook Unit Tests (`renderHook` + `act`)
**Source:** `src/hooks/useCameraStream.torch.test.ts`
**Apply to:** `useDeviceOrientation.test.ts` — mock globals in `beforeEach`, async `act` for permission promises

### Component Banner Tests (`baseProps` + fireEvent)
**Source:** `src/components/CameraView.error.test.tsx`, `CameraView.quota.test.tsx`
**Apply to:** Ghost visibility + orientation banner tests

### Integration Test Mock Stack
**Source:** `src/App.shelfIsolation.integration.test.tsx` lines 64-105
**Apply to:** All App integration tests — mock vision, camera stream, orientation, PWA consistently

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | All Phase 3 files have in-repo brownfield analogs |

## Metadata

**Analog search scope:** `src/hooks/`, `src/components/`, `src/App.tsx`, `src/lib/constants.ts`, `src/App.shelfIsolation.integration.test.tsx`, `.planning/phases/01-*`, `.planning/phases/02-*`
**Files scanned:** 13 test/source files
**Pattern extraction date:** 2026-09-22
**Git-tracked analog verification:** All cited analog paths confirmed via `git ls-files`
