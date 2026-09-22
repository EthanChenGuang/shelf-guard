---
phase: 03-guided-capture-quality
plan: 01
subsystem: ui
tags: [react, ghost-overlay, camera, vitest, indexeddb]

requires:
  - phase: 02-multi-shelf-data-layer
    provides: loadBaselineRaw, shelf switch via loadShelfData, objectUrlRegistry
provides:
  - hasPersistedBaseline App state wired from loadBaselineRaw
  - showGhost gate on live feed + persisted baseline in CameraView
  - Ghost visibility matrix component tests
affects: [03-02, orientation-banner, ios-capture]

actuals:
  tokens: 5200
  tasks: 3
  commits: 2
  plan_head_before: 8c274634d694ceb5142ea9ac240f7cedb65efea9

tech-stack:
  added: []
  patterns:
    - "showGhost = !isUsingDemoFeed && hasPersistedBaseline && baseline"
    - "hasPersistedBaseline from loadBaselineRaw !== null, not DEFAULT_CALIBRATION id"

key-files:
  created:
    - src/components/CameraView.ghost.test.tsx
  modified:
    - src/App.tsx
    - src/components/CameraView.tsx

key-decisions:
  - "Ghost overlay and slider gated on live camera AND persisted IndexedDB baseline (D-01, D-02)"
  - "DEFAULT_CALIBRATION remains demo feed display only; never triggers ghost eligibility"
  - "ghostOpacity stays ephemeral App state at 45% default (D-04)"

patterns-established:
  - "data-testid=ghost-overlay for ghost visibility verification"
  - "hasPersistedBaseline prop default false on CameraView"

requirements-completed: [CAM-01, CAM-02]

coverage:
  - id: D1
    description: "Ghost overlay hidden in demo mode even when shelf has persisted baseline"
    requirement: CAM-02
    verification:
      - kind: unit
        ref: "src/components/CameraView.ghost.test.tsx#demo feed + hasPersistedBaseline true"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ghost overlay hidden on empty shelves (no persisted baseline) in live camera"
    requirement: CAM-02
    verification:
      - kind: unit
        ref: "src/components/CameraView.ghost.test.tsx#live feed + hasPersistedBaseline false"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ghost overlay and opacity slider visible on live camera with persisted baseline"
    requirement: CAM-02
    verification:
      - kind: unit
        ref: "src/components/CameraView.ghost.test.tsx#live feed + hasPersistedBaseline true"
        status: pass
    human_judgment: false
  - id: D4
    description: "Demo-first feed default retained; no double ghost layer in demo mode"
    requirement: CAM-01
    verification:
      - kind: unit
        ref: "src/components/CameraView.ghost.test.tsx#demo feed + hasPersistedBaseline true"
        status: pass
    human_judgment: true
    rationale: "Demo-first default is a launch UX decision; unit tests lock absence of ghost in demo but human should confirm toggle behavior in browser"

duration: 4min
completed: 2026-09-22
status: complete
---

# Phase 3 Plan 01: Ghost Overlay Visibility End-to-End Summary

**Ghost overlay and opacity slider gated on live camera plus persisted IndexedDB baseline; demo mode and empty shelves show feed without ghost layer**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-22T08:21:00Z
- **Completed:** 2026-09-22T08:25:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `hasPersistedBaseline` state in App, set from `loadBaselineRaw(shelfId) !== null` on init and shelf switch
- Derived `showGhost` in CameraView to conditionally render ghost overlay (`data-testid="ghost-overlay"`) and right-edge opacity slider
- Created four-case ghost visibility matrix tests locking demo double-render regression

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end ghost overlay — live camera + persisted baseline only** - `b900537` (feat)
2. **Task 2: Ghost visibility matrix component tests** - `0baeb9b` (test)
3. **Task 3: Confirm loadShelfData baseline eligibility wiring** - verification only (no code changes)

**Plan metadata:** pending final docs commit

## Files Created/Modified

- `src/App.tsx` - hasPersistedBaseline state, loadShelfData wiring, prop pass-through
- `src/components/CameraView.tsx` - showGhost gate, ghost-overlay test id, slider visibility
- `src/components/CameraView.ghost.test.tsx` - four visibility matrix cases

## Decisions Made

- Ghost eligibility tracks IndexedDB persistence, not DEFAULT_CALIBRATION fallback display
- ghostOpacity remains global App state at 45%; not persisted to storage layer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Sync hasPersistedBaseline on reset/upload/ROI save paths**
- **Found during:** Task 1 (tracer implementation)
- **Issue:** Plan specified loadShelfData wiring only; reset/upload/ROI handlers mutate baseline without updating hasPersistedBaseline
- **Fix:** Added setHasPersistedBaseline(false) on reset, setHasPersistedBaseline(true) on upload and ROI save
- **Files modified:** src/App.tsx
- **Committed in:** b900537 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Ensures ghost visibility stays correct after user calibrates or resets baseline outside loadShelfData path.

## Issues Encountered

- Task 3 verify `grep -c ghostOpacity ... | grep -qx '0'` fails on multi-file grep output format (`file:0`); manual check confirms 0 matches in both storage files

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 03-02 iOS orientation banner work
- Ghost visibility tracer slice proven end-to-end with unit tests

## Self-Check: PASSED

- FOUND: src/components/CameraView.ghost.test.tsx
- FOUND: src/App.tsx (hasPersistedBaseline)
- FOUND: src/components/CameraView.tsx (showGhost, data-testid)
- FOUND: commit b900537
- FOUND: commit 0baeb9b

---
*Phase: 03-guided-capture-quality*
*Completed: 2026-09-22*
