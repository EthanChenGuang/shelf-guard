---
phase: 05-prd-ui-multi-shelf-experience
reviewed: 2026-09-23T22:13:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/lib/designTokens.ts
  - src/index.css
  - package.json
  - src/components/ShelfCarousel.tsx
  - src/lib/shelfSwipe.ts
  - src/lib/carouselEnabled.ts
  - src/lib/shelfIndex.ts
  - src/components/CameraView.tsx
  - src/App.tsx
  - src/lib/constants.ts
  - src/components/InitialGuideOverlay.tsx
  - src/components/ScanningAnimationOverlay.tsx
  - src/components/RoiSetupView.tsx
  - src/components/ResultInspectView.tsx
findings:
  critical: 2
  warning: 6
  info: 2
  total: 10
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-23T22:13:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 05 delivers the PRD Minimalist Light UI: design tokens, shelf carousel with motion cross-fade, per-shelf INITIAL_GUIDE onboarding, camera chrome polish, and light-theme ROI/result views with I18N coverage. Implementation is structurally sound and well-tested, but two correctness gaps should block ship: **live camera feed is lost on shelf swipe** because the `<video>` element remounts without re-attaching `MediaStream`, and **first-baseline ROI cancel/retake bypasses the INITIAL_GUIDE FSM** introduced in this phase. Additional warnings cover swipe gesture robustness, hardcoded UI strings missed by the I18N audit, and misleading placeholder data.

## Critical Issues

### CR-01: Live camera feed lost on shelf swipe

**File:** `src/components/CameraView.tsx:172-201`, `src/hooks/useCameraStream.ts:68-71`
**Issue:** The camera feed is wrapped in `AnimatePresence` with `key={activeShelfId}`. Each shelf switch unmounts and recreates the `<video>` element. `useCameraStream` only assigns `videoRef.current.srcObject = mediaStream` inside `startCamera()` — there is no effect to reattach the active stream when the video node remounts. In real-camera mode (`isUsingDemoFeed === false`), swiping between shelves produces a black feed until the user toggles demo/camera again.
**Fix:**
```tsx
// useCameraStream.ts — reattach stream whenever video element mounts
useEffect(() => {
  if (stream && videoRef.current && videoRef.current.srcObject !== stream) {
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});
  }
}, [stream, /* optionally a mount counter from CameraView */]);
```
Alternatively, move the `<video>` outside the keyed `motion.div` and only cross-fade overlay/ghost layers per shelf.

### CR-02: First-baseline ROI cancel/retake skips INITIAL_GUIDE

**File:** `src/App.tsx:424-435`
**Issue:** Phase 05 introduced `resolveAppModeAfterShelfLoad()` to enter `INITIAL_GUIDE` on empty shelves (SHLF-05). `handleCancelRoiConfig` and `handleRetakeFirstBaseline` hardcode `setAppMode('CAMERA_IDLE')` instead of calling `resolveAppModeAfterShelfLoad(false, 'CAMERA_IDLE')`. When a user cancels or retakes during first-baseline ROI setup, they land on `CAMERA_IDLE` without the onboarding overlay — violating the per-shelf guide contract while still showing the neutral placeholder feed.
**Fix:**
```tsx
const handleRetakeFirstBaseline = () => {
  setPendingBaselineImageUrl(null);
  setBaseline(DEFAULT_CALIBRATION);
  setAppMode(resolveAppModeAfterShelfLoad(false, 'CAMERA_IDLE'));
};

const handleCancelRoiConfig = () => {
  if (pendingBaselineImageUrl) {
    setPendingBaselineImageUrl(null);
    setBaseline(DEFAULT_CALIBRATION);
  }
  setAppMode(
    resolveAppModeAfterShelfLoad(hasPersistedBaseline, 'CAMERA_IDLE'),
  );
};
```

## Warnings

### WR-01: Swipe handler lacks pointer identity and cancel handling

**File:** `src/lib/shelfSwipe.ts:13-30`
**Issue:** `attachShelfSwipe` tracks a single `startX`/`startY` pair with no `pointerId` filtering and no `pointercancel` listener. Multi-touch or an interrupted gesture can leave stale coordinates; a `pointerup` without a matching `pointerdown` on the layer (initial values `0,0`) can fire a spurious 50px swipe on the first interaction edge case.
**Fix:** Track `activePointerId` set on `pointerdown`, ignore `pointerup`/`pointercancel` from other IDs, and reset state on cancel:
```ts
let activePointerId: number | null = null;

const onPointerDown = (e: PointerEvent) => {
  if (!opts.enabled) return;
  activePointerId = e.pointerId;
  startX = e.clientX;
  startY = e.clientY;
};

const onPointerUp = (e: PointerEvent) => {
  if (!opts.enabled || e.pointerId !== activePointerId) return;
  activePointerId = null;
  // ... existing dx/dy logic
};
el.addEventListener('pointercancel', onPointerCancel);
```

### WR-02: Hardcoded audit timestamp when no history exists

**File:** `src/components/CameraView.tsx:692-694`
**Issue:** The last-inspection thumbnail badge renders `'14:20'` when `lastAudit` is null. This displays fictitious data to users on shelves with no audit history.
**Fix:** Hide the badge when `!lastAudit`, or show a neutral label from I18N (e.g. `t.noAuditYet`).

### WR-03: Residual hardcoded English strings after I18N audit

**File:** `src/components/CameraView.tsx:326`, `src/components/RoiSetupView.tsx:97`, `src/components/ResultInspectView.tsx:175`, `src/components/ScanningAnimationOverlay.tsx:24`
**Issue:** Plan 05-07 claims I18N-01 complete, but several user-visible strings remain hardcoded in English: simulate-tilt `title`, ROI back `aria-label`, AR toggle `title`, and scanning overlay `alt`. Chinese users see English accessibility text.
**Fix:** Add I18N keys in `constants.ts` and reference via `t.*` in each component.

### WR-04: `handleShelfChange` does not clamp shelf index at App boundary

**File:** `src/App.tsx:240-248`, `src/lib/shelfIndex.ts:4-6`
**Issue:** Clamping is applied in `CameraView.handleShelfSelect`, but `App.handleShelfChange` persists whatever `newShelfId` it receives. A future caller passing an out-of-range value would write invalid data to storage.
**Fix:** Clamp at the entry point: `const shelfId = clampShelfIndex(newShelfId);` before `saveActiveShelfId`.

### WR-05: Capture-baseline CTA dismisses guide without starting capture

**File:** `src/components/InitialGuideOverlay.tsx:88-95`, `src/components/CameraView.tsx:699-705`
**Issue:** Step 2 labels the primary button `captureBaseline`, but `onComplete` only calls `onDismissInitialGuide` (sets `CAMERA_IDLE`). Users expecting one-tap baseline capture must dismiss the guide and tap the shutter separately — misleading given the CTA copy.
**Fix:** Either wire the CTA to trigger `onShutterClick` (then ROI flow), or rename the string to `guideReady` / `gotIt` to match dismiss-only behavior.

### WR-06: `animatingDismissIds` accumulates without cleanup

**File:** `src/components/ResultInspectView.tsx:65-81`
**Issue:** Dismissed anomaly IDs are appended to `animatingDismissIds` but never removed after the 220ms animation. The array grows unbounded over repeated dismissals within a session.
**Fix:** Remove the ID inside the timeout callback:
```tsx
setTimeout(() => {
  onDismissAnomaly(id);
  setAnimatingDismissIds((prev) => prev.filter((x) => x !== id));
}, 220);
```

## Info

### IN-01: Dual token sources risk palette drift

**File:** `src/lib/designTokens.ts:2-13`, `src/index.css:3-14`
**Issue:** PRD colors exist in both `@theme` CSS variables and `SG_COLORS` JS constant with no compile-time sync check. Updating one without the other silently breaks canvas/overlay colors vs Tailwind utilities.
**Fix:** Generate `designTokens.ts` from CSS at build time, or add a unit test asserting hex parity.

### IN-02: Legacy hardcoded hex alongside sg-* tokens in CameraView

**File:** `src/components/CameraView.tsx:159,219,249,277` (and others)
**Issue:** Phase 05 migrated many surfaces to `sg-*` tokens, but numerous `#0F172A`, `#10B981`, and `emerald-*` literals remain. Not a runtime bug, but increases maintenance cost and risks visual inconsistency if tokens change.
**Fix:** Incrementally replace remaining literals with `sg-camera`, `sg-success`, etc.

---

_Reviewed: 2026-09-23T22:13:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
