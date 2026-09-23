---
phase: 03-guided-capture-quality
reviewed: 2026-09-23T08:05:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/App.tsx
  - src/components/CameraView.tsx
  - src/components/CameraView.ghost.test.tsx
  - src/hooks/useDeviceOrientation.ts
  - src/hooks/useDeviceOrientation.test.ts
  - src/test/deviceOrientationMocks.ts
  - src/components/CameraView.orientation.test.tsx
  - src/lib/constants.ts
  - src/App.shelfIsolation.integration.test.tsx
  - src/lib/objectUrlRegistry.ts
findings:
  critical: 1
  warning: 4
  info: 0
  total: 5
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-09-23T08:05:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 03 adds ghost overlay gating (`hasPersistedBaseline` + live camera), iOS orientation permission orchestration, and blob URL registry hardening for cross-shelf ghost src hygiene. The visibility matrix and shelf-isolation integration tests are well-scoped. However, the camera-then-orientation `await` chain in `handleEnableLiveCamera` likely breaks iOS transient user activation, which is the core CAM-07 requirement. Secondary gaps include camera retry bypassing orientation setup, silent empty blob URLs on ghost render, and orientation listener lifecycle on permission re-deny.

## Critical Issues

### CR-01: iOS orientation request runs after `await startCamera()`, breaking user activation

**File:** `src/App.tsx:373-378`
**Issue:** `handleEnableLiveCamera` awaits `startCamera()` (which opens the async `getUserMedia` permission dialog) before calling `requestOrientationPermission()`. On iOS Safari, `DeviceOrientationEvent.requestPermission()` must be invoked while transient user activation from the original tap is still valid. Awaiting the camera promise consumes that activation; when the camera dialog resolves, the orientation call is no longer in a valid user-gesture context and may auto-deny or throw without showing the Motion & Orientation prompt — the primary CAM-07 deliverable.
**Fix:**
```typescript
const handleEnableLiveCamera = useCallback(async () => {
  if (isUsingDemoFeed) {
    const orientationPromise = requestOrientationPermission();
    const cameraOk = await startCamera();
    await orientationPromise;
    if (cameraOk) {
      setOrientationDismissed(false);
    }
  } else {
    toggleDemoMode();
  }
}, [isUsingDemoFeed, startCamera, requestOrientationPermission, toggleDemoMode]);
```
Alternatively, invoke `requestOrientationPermission()` synchronously as the first statement in the click handler (before any `await`), or request orientation before camera if product UX allows.

## Warnings

### WR-01: Camera error retry bypasses orientation permission chain

**File:** `src/App.tsx:429`
**Issue:** The camera error banner wires `onRetryCamera={startCamera}` directly. When the initial enable-live flow fails at camera permission but the user later succeeds via retry, orientation permission is never requested. The level gauge stays frozen/denied while the live feed works — inconsistent with the camera-first-then-orientation orchestration in `handleEnableLiveCamera`.
**Fix:** Replace with a shared handler that mirrors the enable-live chain:
```typescript
const handleRetryCamera = useCallback(async () => {
  const cameraOk = await startCamera();
  if (cameraOk) {
    setOrientationDismissed(false);
    await requestOrientationPermission();
  }
}, [startCamera, requestOrientationPermission]);

// In JSX:
onRetryCamera={handleRetryCamera}
```

### WR-02: Silent empty blob URL leaves ghost overlay visible but broken

**File:** `src/lib/objectUrlRegistry.ts:14-25`, `src/App.tsx:114-115`
**Issue:** When `isBlobLike` fails or `createObjectURL` throws, `registry.set()` returns `''` with no error surfaced. `loadShelfData` still sets `hasPersistedBaseline(true)` and passes `imageDataUrl: ''` to `CameraView`, which renders the ghost overlay shell (`showGhost === true`) with a broken `<img src="">`. Users see opacity controls and overlay chrome but no baseline image, with no diagnostic banner.
**Fix:** Propagate failure from the registry and gate ghost eligibility:
```typescript
// objectUrlRegistry.ts — throw or return null on failure
function set(key: string, blob: Blob): string | null {
  if (!isBlobLike(blob)) return null;
  // ...
}

// App.tsx loadShelfData
const displayUrl = registry.set(`baseline:${shelfId}`, persisted.imageBlob);
if (!displayUrl) {
  console.error('Failed to create baseline display URL');
  setHasPersistedBaseline(false);
  nextBaseline = DEFAULT_CALIBRATION;
} else {
  nextBaseline = toViewBaseline(persisted, displayUrl);
}
```

### WR-03: Orientation listener not detached when permission re-request returns denied

**File:** `src/hooks/useDeviceOrientation.ts:102-111`
**Issue:** If the user previously granted orientation (listener attached, `hasSensor` true) and a subsequent `requestOrientationPermission()` returns `'denied'`, the hook sets `orientationPermission` to `'denied'` but does not call `detachListener()` or reset `tilt`/`hasSensor`. `CameraView` masks stale tilt via `displayTilt = orientationDenied ? 0 : tilt`, so UI appears correct, but internal hook state remains inconsistent and could leak events or confuse future logic that reads `hasSensor`/`tilt` directly.
**Fix:**
```typescript
if (state === 'granted') {
  setOrientationPermission('granted');
  attachListener();
  return 'granted';
}
detachListener();
setTilt(0);
setIsLevel(true);
setHasSensor(false);
setOrientationPermission('denied');
return 'denied';
```
Apply the same cleanup in the `catch` branch.

### WR-04: Custom baseline upload lacks error handling on async blob conversion

**File:** `src/App.tsx:342-368`
**Issue:** The `FileReader.onload` async callback awaits `loadImageDimensions`, `saveBaseline`, and `fetch(dataUrl).then(r => r.blob())` without try/catch. Any network/fetch failure (unlikely for data URLs but possible for large/corrupt files) or dimension load failure becomes an unhandled promise rejection; `hasPersistedBaseline` and UI state are left unchanged with no user feedback.
**Fix:**
```typescript
reader.onload = async (ev) => {
  try {
    const dataUrl = ev.target?.result as string;
    if (!dataUrl) return;
    const dimensions = await loadImageDimensions(dataUrl);
    // ... save flow ...
  } catch (err) {
    console.error('Baseline upload failed:', err);
    setQuotaError(true); // or a dedicated upload error state
  }
};
```

---

_Reviewed: 2026-09-23T08:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
