---
phase: 05-prd-ui-multi-shelf-experience
plan: 04
subsystem: ui
tags: [react, initial-guide, fsm, i18n, vitest, multi-shelf]

requires:
  - phase: 05-prd-ui-multi-shelf-experience
    provides: ShelfCarousel swipe/dot shelf switching in CAMERA_IDLE
provides:
  - resolveAppModeAfterShelfLoad FSM helper for per-shelf INITIAL_GUIDE entry
  - InitialGuideOverlay 3-step onboarding with skip and capture CTA
  - CameraView integration hiding demo baseline feed on empty shelves
  - Component and integration tests for guide visibility and carousel compat
affects: [05-05, 05-07]

actuals:
  tokens: 12000
  tasks: 3
  commits: 3
plan_head_before: 3e2c1d019e76576582888d25dbdf2e02a43961f0

tech-stack:
  added: []
  patterns:
    - "resolveAppModeAfterShelfLoad gates INITIAL_GUIDE vs CAMERA_IDLE after every shelf load"
    - "Empty-shelf demo feed uses neutral placeholder instead of DEFAULT_CALIBRATION CDN"

key-files:
  created:
    - src/components/InitialGuideOverlay.tsx
    - src/components/InitialGuideOverlay.test.tsx
    - src/App.initialGuide.integration.test.tsx
  modified:
    - src/App.tsx
    - src/components/CameraView.tsx
    - src/lib/constants.ts

key-decisions:
  - "Demo feed hidden for all !hasPersistedBaseline shelves — not only during INITIAL_GUIDE overlay (D-09)"
  - "Guide step indicator uses 3-dot progress strip at executor discretion (D-32)"
  - "Skip and capture CTA both dismiss to CAMERA_IDLE without persisting preference (D-11)"

patterns-established:
  - "INITIAL_GUIDE and CAMERA_IDLE share CameraView shell with showInitialGuide prop"
  - "Guide I18N keys added incrementally; full audit deferred to 05-07"

requirements-completed: [SHLF-05]

coverage:
  - id: D1
    description: "Per-shelf INITIAL_GUIDE overlay on empty shelves with 3-step flow and skip"
    requirement: SHLF-05
    verification:
      - kind: unit
        ref: "src/components/InitialGuideOverlay.test.tsx"
        status: pass
      - kind: integration
        ref: "src/App.initialGuide.integration.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "No DEFAULT_CALIBRATION demo image masquerading as baseline on empty shelves"
    requirement: SHLF-05
    verification:
      - kind: integration
        ref: "src/App.initialGuide.integration.test.tsx#shows initial-guide on empty shelf 1"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-09-24
status: complete
---

# Phase 05 Plan 04: INITIAL_GUIDE Per-Shelf Onboarding Summary

**Per-shelf INITIAL_GUIDE FSM with 3-step overlay, skip path, and empty-shelf demo feed placeholder replacing silent baseline onboarding**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-23T22:01:00Z
- **Completed:** 2026-09-23T22:05:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Wired `resolveAppModeAfterShelfLoad` so empty shelves enter `INITIAL_GUIDE` on init, shelf switch, audit return, and baseline reset
- Created `InitialGuideOverlay` with welcome, alignment, and capture-baseline steps plus non-persisted skip
- Extended `CameraView` to share shell for `CAMERA_IDLE` and `INITIAL_GUIDE`; neutral placeholder blocks demo CDN on empty shelves
- Phase 4 first-baseline shutter intercept preserved (`!hasPersistedBaseline` → `ROI_CONFIG`)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end INITIAL_GUIDE** - `715d382` (feat)
2. **Task 2: InitialGuideOverlay component tests** - `cac7a3e` (test)
3. **Task 3: INITIAL_GUIDE integration test** - `cfce92e` (test)

**Plan metadata:** `ecf7418` (docs: complete plan)

## Files Created/Modified

- `src/components/InitialGuideOverlay.tsx` - Full-screen 3-step onboarding overlay
- `src/components/InitialGuideOverlay.test.tsx` - Unit tests for visibility, skip, complete, i18n
- `src/App.initialGuide.integration.test.tsx` - Shelf switch, swipe, reset integration tests
- `src/App.tsx` - FSM resolution helper and INITIAL_GUIDE render branch
- `src/components/CameraView.tsx` - Guide overlay render and empty-shelf feed placeholder
- `src/lib/constants.ts` - Guide I18N keys (cn/en)

## Decisions Made

- Extended demo-feed placeholder to all shelves without persisted baseline, not only during overlay — prevents demo CDN from implying an established baseline after skip (D-09)
- Step indicator uses simple 3-dot strip per D-32 executor discretion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Demo feed shown during INITIAL_GUIDE on empty shelf switch**
- **Found during:** Task 3 (integration test)
- **Issue:** Feed branch keyed only on `showInitialGuide`, missing transient renders when `!hasPersistedBaseline` during shelf cross-fade
- **Fix:** Introduced `showGuidePlaceholder` for `isUsingDemoFeed && (showInitialGuide || !hasPersistedBaseline)`
- **Files modified:** `src/components/CameraView.tsx`
- **Verification:** Integration test asserts `guide-feed-placeholder` on empty shelf 1
- **Committed in:** `cfce92e`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** D-09 compliance strengthened; no scope creep

## Issues Encountered

None beyond the demo-feed placeholder timing fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SHLF-05 satisfied; 05-05+ can polish PRD top bar knowing empty shelves have guided onboarding
- Full I18N audit for guide strings deferred to 05-07 as planned

## Self-Check: PASSED

- FOUND: src/components/InitialGuideOverlay.tsx
- FOUND: src/components/InitialGuideOverlay.test.tsx
- FOUND: src/App.initialGuide.integration.test.tsx
- FOUND: 715d382
- FOUND: cac7a3e
- FOUND: cfce92e

---
*Phase: 05-prd-ui-multi-shelf-experience*
*Completed: 2026-09-24*
