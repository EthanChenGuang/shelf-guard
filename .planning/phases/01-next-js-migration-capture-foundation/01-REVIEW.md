---
phase: 01-next-js-migration-capture-foundation
reviewed: 2026-09-20T19:30:00Z
depth: quick
files_reviewed: 20
files_reviewed_list:
  - package.json
  - vercel.json
  - vite.config.ts
  - vitest.config.ts
  - src/App.tsx
  - src/App.processing.integration.test.tsx
  - src/App.capture.test.ts
  - src/App.processing.test.ts
  - src/App.baseline.test.ts
  - src/hooks/useCameraStream.ts
  - src/hooks/useCameraStream.capture.test.ts
  - src/hooks/useCameraStream.torch.test.ts
  - src/components/CameraView.tsx
  - src/components/CameraView.error.test.tsx
  - src/components/OfflineIndicator.tsx
  - src/components/OfflineIndicator.test.tsx
  - src/components/ScanningAnimationOverlay.tsx
  - src/lib/constants.ts
  - src/lib/captureLock.ts
  - src/lib/imageDimensions.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-20T19:30:00Z
**Depth:** quick
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Quick-depth pattern scan across all Phase 01 source files found no hardcoded secrets, dangerous DOM/exec calls, or debug artifacts in scope. Gap-closure changes in `OfflineIndicator.tsx` (raising pill to `bottom-24`) are structurally sound for the stated 320×640 shutter-band geometry. Two warnings remain: the new G-01-4 layout test asserts mocked geometry rather than measured layout (reduced regression value), and an empty `video.play()` catch in `useCameraStream.ts` silently swallows autoplay failures.

## Warnings

### WR-01: G-01-4 layout test uses circular mocked geometry

**File:** `src/components/OfflineIndicator.test.tsx:53-68`
**Issue:** The layout regression test spies on `getBoundingClientRect` and returns values pre-computed from the same constants (`bottom24Px = 96`, `shutterBandBottom = 608`, `pillHeight = 28`) used in the assertions. The rect checks therefore prove the mock satisfies the math, not that jsdom/CSS actually positions the pill above the shutter band. A regression that keeps the `bottom-24` class but breaks layout (CSS override, rem scaling, padding change) would not be caught by the rect assertions.
**Fix:** Mock or measure the shutter band element and assert against the pill's **unmocked** `getBoundingClientRect()`, or use a Playwright/visual test that reads real computed styles at 320×640:

```tsx
// Prefer unmocked pill rect vs a shutter fixture
const pill = screen.getByText('离线模式 · 本地缓存已就绪').closest('div')!;
const pillRect = pill.getBoundingClientRect(); // do NOT mock pill rect
const shutterRect = document.getElementById('shutter-trigger')!.getBoundingClientRect();
expect(pillRect.bottom).toBeLessThanOrEqual(shutterRect.top);
```

### WR-02: Empty catch swallows video.play() rejection

**File:** `src/hooks/useCameraStream.ts:68`
**Issue:** `videoRef.current.play().catch(() => {})` silently discards play promise rejections (common on autoplay-policy blocks or detached elements). Camera may appear initialized while the preview never starts, with no user-visible error path beyond the generic camera catch.
**Fix:** Log or surface the rejection so failures are diagnosable:

```tsx
videoRef.current.play().catch((err) => {
  console.warn('Video preview autoplay failed:', err);
  setCameraError((prev) => prev ?? (err as Error).message);
});
```

## Info

### IN-01: Layout test magic numbers drift from CameraView source

**File:** `src/components/OfflineIndicator.test.tsx:43-47`
**Issue:** Shutter band bottom (`608`), pill height (`28`), and bottom offsets are hard-coded in the test without reference to `CameraView.tsx` shutter dimensions (`w-[76px] h-[76px]`) or shared layout constants. If the shutter row moves in a future UI change, the test may still pass (due to WR-01 mocking) while UAT fails again.
**Fix:** Extract shutter-band bounds into a shared constant or derive them from a minimal layout fixture that mirrors `CameraView` bottom-control geometry.

---

_Reviewed: 2026-09-20T19:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
