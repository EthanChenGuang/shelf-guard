---
phase: 03-guided-capture-quality
plan: 02
subsystem: ui
tags: [ios, device-orientation, camera, vitest, react-hooks]

requires:
  - phase: 03-01
    provides: Ghost overlay visibility gate and hasPersistedBaseline prop wiring
provides:
  - iOS DeviceOrientationEvent.requestPermission lazy listener hook
  - App camera-then-orientation orchestration on enable-camera gesture
  - Orientation denied inline banner with i18n retry/dismiss
  - Level gauge hardening (gray frozen crosshair, simulate toggle guard)
  - Unit and component test coverage for orientation permission flow
affects: [03-03, verify-work, ship]

actuals:
  tokens: 18000
  tasks: 3
  commits: 3
plan_head_before: 2921c11965ad34ddfdc72e32bf4c0b03d0a3b3e0

tech-stack:
  added: []
  patterns:
    - Lazy deviceorientation listener gated by iOS requestPermission grant
    - Camera-first then orientation permission chain on user gesture
    - Inline orientation-denied banner mirroring camera error banner

key-files:
  created:
    - src/hooks/useDeviceOrientation.test.ts
    - src/test/deviceOrientationMocks.ts
    - src/components/CameraView.orientation.test.tsx
  modified:
    - src/hooks/useDeviceOrientation.ts
    - src/App.tsx
    - src/components/CameraView.tsx
    - src/lib/constants.ts
    - src/hooks/useCameraStream.ts

key-decisions:
  - "startCamera returns boolean so App can gate orientation request without stale cameraError closure"
  - "orientationDismissed local state in App allows dismiss without clearing browser permission denial"

patterns-established:
  - "Pattern: requestOrientationPermission only from handleEnableLiveCamera user gesture chain"
  - "Pattern: simulate toggle visible only when !hasSensor && !orientationDenied"

requirements-completed: [CAM-01, CAM-03, CAM-07]

coverage:
  - id: D1
    description: iOS orientation permission lazy listener with granted/denied/unsupported states
    requirement: CAM-07
    verification:
      - kind: unit
        ref: "src/hooks/useDeviceOrientation.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: Level snap ±1.5° with mint green and haptic debounce 1200ms/800ms retained
    requirement: CAM-03
    verification:
      - kind: unit
        ref: "src/hooks/useDeviceOrientation.test.ts#gamma within ±1.5°"
        status: pass
    human_judgment: false
  - id: D3
    description: Camera-then-orientation orchestration on enable-camera gesture
    requirement: CAM-07
    verification:
      - kind: unit
        ref: "grep requestOrientationPermission src/App.tsx"
        status: pass
    human_judgment: true
    rationale: Transient activation preservation on real iOS Safari requires device QA
  - id: D4
    description: Orientation denied inline banner with retry and dismiss
    requirement: CAM-01
    verification:
      - kind: unit
        ref: "src/components/CameraView.orientation.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: Simulate toggle hidden when orientation denied; crosshair always visible gray at 0°
    requirement: CAM-03
    verification:
      - kind: unit
        ref: "src/components/CameraView.orientation.test.tsx#hides simulate toggle"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-09-22
status: complete
---

# Phase 3 Plan 02: iOS Orientation Permission & Level Gauge Hardening Summary

**iOS orientation permission chained after camera enable with lazy listener, denied banner, and level gauge hardening**

## Performance

- **Duration:** 2 min
- **Started:** 2026-09-22T08:25:00Z
- **Completed:** 2026-09-22T08:27:26Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Refactored `useDeviceOrientation` with `requestOrientationPermission`, `orientationPermission` state, and lazy iOS listener attach
- App `handleEnableLiveCamera` chains `startCamera()` then `requestOrientationPermission()` on the same user gesture
- Orientation denied inline banner with cn/en i18n, retry, and dismiss mirroring camera error pattern
- Level crosshair always visible; gray frozen at 0° when denied; simulate toggle hidden when denied or sensor present
- 12 orientation-specific tests (8 hook + 4 component) all green; full suite 59/59 pass

## Task Commits

Each task was committed atomically:

1. **Task 1: useDeviceOrientation iOS permission + lazy listener** - `dfa9082` (feat)
2. **Task 2: App camera-then-orientation orchestration + orientation banner** - `4f1dcb6` (feat)
3. **Task 3: Orientation banner component tests** - `8f7b92a` (test)

## Files Created/Modified

- `src/hooks/useDeviceOrientation.ts` - Lazy listener, permission API, level snap/haptic retained
- `src/hooks/useDeviceOrientation.test.ts` - Permission flow, level snap, haptic debounce tests
- `src/test/deviceOrientationMocks.ts` - installRequestPermission and emitDeviceOrientation helpers
- `src/App.tsx` - handleEnableLiveCamera orchestration, orientation props to CameraView
- `src/components/CameraView.tsx` - Orientation denied banner, simulate guard, frozen crosshair
- `src/components/CameraView.orientation.test.tsx` - Banner copy, retry/dismiss, simulate guard tests
- `src/lib/constants.ts` - orientationPermissionDenied, orientationErrorIosGuide, retryOrientation i18n
- `src/hooks/useCameraStream.ts` - startCamera returns boolean for orchestration gate

## Decisions Made

- `startCamera` returns `Promise<boolean>` so App can reliably skip orientation request when camera fails (avoids stale `cameraError` closure)
- `orientationDismissed` local App state allows user to dismiss banner without affecting browser permission state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] startCamera return value for orchestration gate**
- **Found during:** Task 2 (App camera-then-orientation orchestration)
- **Issue:** After `await startCamera()`, React `cameraError` state in closure is stale — cannot reliably gate orientation request
- **Fix:** Added `Promise<boolean>` return to `startCamera` (true on success, false on catch)
- **Files modified:** `src/hooks/useCameraStream.ts`
- **Committed in:** `4f1dcb6`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal — required for correct D-06/D-10 camera-first gating without race on stale state.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CAM-07 orientation permission flow implemented and tested in jsdom
- Ready for 03-03 or device QA on iOS Safari for transient activation verification
- Camera operates independently when orientation denied (D-10)

## Self-Check: PASSED

- FOUND: src/hooks/useDeviceOrientation.test.ts
- FOUND: src/components/CameraView.orientation.test.tsx
- FOUND: src/test/deviceOrientationMocks.ts
- FOUND: dfa9082, 4f1dcb6, 8f7b92a

---
*Phase: 03-guided-capture-quality*
*Completed: 2026-09-22*
