---
phase: quick-260925-r3s-github
plan: 1
subsystem: camera-capture
tags: [react, mediastreamtrack, applyconstraints, tap-to-focus, vitest]

requires:
  - phase: quick-260925-gdb-4-mediatrackconstraints-zoom-capability
    provides: capability-gated MediaTrackConstraints pattern (hasZoom/hasTorch/setZoomLevel) that this plan mirrors for focus
provides:
  - useCameraStream hasFocus/focusPoint state + setFocusPoint(x, y) action
  - CameraView tap-to-focus gesture on the shelf-swipe overlay layer + focus reticle
  - App.tsx wiring of hasFocus/focusPoint/setFocusPoint into CameraView
affects: [camera-capture, guided-capture-quality]

actuals:
  tokens: 3766
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Tap-vs-swipe gesture split on a shared pointer-event layer via independent listener pairs with different move thresholds (12px tap vs 50px swipe), rather than a single combined handler"

key-files:
  created:
    - src/hooks/useCameraStream.focus.test.ts
    - src/components/CameraView.focus.test.tsx
  modified:
    - src/hooks/useCameraStream.ts
    - src/components/CameraView.tsx
    - src/App.tsx

key-decisions:
  - "setFocusPoint prefers focusMode 'single-shot' over 'manual' when both are supported — returns camera to normal autofocus after the tap instead of pinning it in manual mode"
  - "Tap-to-focus listener pair is independent of (not merged with) attachShelfSwipe's existing listener pair on the same swipeLayerRef element — a 12px move threshold vs. the swipe's 50px threshold creates a safe dead zone between the two gestures"

patterns-established:
  - "Capability detection for a new MediaTrackCapabilities field follows: cast capabilities to Record<string, unknown> & {field?: Type}, compute a derived boolean, set state, reset state to null/false in stopCamera() and the no-track branch of startCamera()"

requirements-completed: []

coverage:
  - id: D1
    description: "useCameraStream detects focusMode/focusDistance capability and exposes hasFocus/focusPoint/setFocusPoint"
    verification:
      - kind: unit
        ref: "src/hooks/useCameraStream.focus.test.ts#useCameraStream focus (quick-260925-r3s)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CameraView renders a tap-to-focus reticle and forwards normalized tap coordinates, gated on hasFocus, without disrupting the existing shelf-swipe gesture"
    verification:
      - kind: unit
        ref: "src/components/CameraView.focus.test.tsx#CameraView tap-to-focus (quick-260925-r3s)"
        status: pass
      - kind: unit
        ref: "bun run test (full suite, 37 files / 132 tests, zero regressions)"
        status: pass
    human_judgment: true
    rationale: "Automated tests mock getCapabilities()/applyConstraints() and DOM pointer events; real-device confirmation that a physical camera track reports focusMode and visibly refocuses on tap (vs. silently hiding the control on iOS Safari) requires a human on an actual Android Chrome / iOS Safari device per the plan's success criteria."

duration: ~15min
completed: 2026-09-25
status: complete
---

# Quick Task 260925-r3s: Tap-to-Focus Camera Control Summary

**Capability-gated tap-to-focus for the camera preview — `focusMode`/`focusDistance` detection in `useCameraStream`, an independent tap gesture + reticle in `CameraView`, applying real `focusMode`+`pointsOfInterest` constraints via `MediaStreamTrack.applyConstraints`.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2/2 completed
- **Files modified:** 5 (2 new test files, 3 modified source files)

## Accomplishments
- `useCameraStream` now detects `focusMode`/`focusDistance` on the active track exactly like the existing `hasZoom`/`hasTorch` pattern, exposing `hasFocus`, `focusPoint`, and `setFocusPoint(x, y)`
- `setFocusPoint` applies `{advanced: [{focusMode, pointsOfInterest: [{x, y}]}]}` via `applyConstraints`, preferring `single-shot` over `manual`, and is a silent no-op when the capability is absent
- `CameraView` attaches an independent tap listener pair to the existing `shelf-swipe-layer` overlay (12px move threshold vs. shelf-swipe's 50px) so a still tap and an intentional swipe never conflict, and renders a pulsing green focus reticle at the tapped point when `hasFocus` is true
- `App.tsx` wires `hasFocus`/`focusPoint`/`setFocusPoint` from the hook into `CameraView`
- No third-party camera library introduced — extended the existing hook/component in place

## Task Commits

Both tasks followed the RED → GREEN TDD cycle (test written and confirmed to fail intentionally, then minimal implementation):

1. **Task 1: focusMode/focusDistance capability detection + setFocusPoint in useCameraStream**
   - `70456f0` - `test(quick-260925-r3s-1): add failing test for focus capability detection + setFocusPoint`
   - `9cc6550` - `feat(quick-260925-r3s-1): focusMode/focusDistance capability detection + setFocusPoint`
2. **Task 2: Tap-to-focus gesture + reticle in CameraView, wired from App.tsx**
   - `e0a2240` - `test(quick-260925-r3s-2): add failing test for tap-to-focus gesture + reticle`
   - `c86b0a6` - `feat(quick-260925-r3s-2): tap-to-focus gesture + reticle in CameraView, wired from App`

No REFACTOR commits were needed — both GREEN implementations matched the plan's `<action>` spec without further cleanup.

## Files Created/Modified
- `src/hooks/useCameraStream.ts` - Added `hasFocus`/`focusPoint` state, focus capability detection in `startCamera()`, `setFocusPoint(x, y)` callback, resets in `stopCamera()`/no-track branch
- `src/hooks/useCameraStream.focus.test.ts` - 5 test cases covering capability detection and constraint-application behavior
- `src/components/CameraView.tsx` - New `hasFocus`/`focusPoint`/`onFocusPointChange` props, independent tap-vs-swipe pointer listener pair, conditional focus reticle
- `src/components/CameraView.focus.test.tsx` - 5 test cases covering reticle render/hide and tap/swipe gesture split
- `src/App.tsx` - Destructures and wires `hasFocus`/`focusPoint`/`setFocusPoint` from `useCameraStream()` into `<CameraView />`

## Decisions Made
- Preferred `single-shot` focus mode over `manual` when both are supported by the device, so the camera returns to normal autofocus behavior after the tap rather than staying pinned
- Used an independent listener pair (rather than modifying `attachShelfSwipe`) for the tap gesture, with a much smaller move threshold (12px vs. 50px), keeping the two gestures decoupled and each individually testable

## Deviations from Plan

None - plan executed exactly as written. Both tasks' RED phases failed on the intended assertions (undefined `hasFocus`/missing `setFocusPoint` for Task 1; missing reticle/uncalled `onFocusPointChange` for Task 2), and GREEN implementations followed the plan's `<action>` spec verbatim.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tap-to-focus is fully wired end-to-end (hook → component → App) and covered by 10 new unit tests plus the existing 122-test suite (132 total, zero regressions), `tsc --noEmit` clean
- Real-device confirmation remains outstanding per the coverage table (D2): an Android Chrome device (or similar) reporting `focusMode` should show the reticle and visibly refocus on tap, while iOS Safari (no capability) should show no reticle and no console errors

---
*Quick task: 260925-r3s-github*
*Completed: 2026-09-25*
