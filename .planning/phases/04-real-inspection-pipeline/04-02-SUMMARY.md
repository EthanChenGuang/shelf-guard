---
phase: 04-real-inspection-pipeline
plan: 02
subsystem: ui
tags: [fsm, roi-calibration, tolerance-slider, indexeddb-migration, vitest]

requires:
  - phase: 04-real-inspection-pipeline
    plan: 01
    provides: Real OpenCV worker diff via analyzeShelfCapture
provides:
  - First-baseline shutter intercept to ROI_CONFIG without scan animation
  - Pending capture ROI setup with retake/save baseline persistence
  - Numeric tolerance 0–100 with IndexedDB migration from legacy enum
  - Continuous slider with 150ms debounced worker re-diff
  - Result interaction wiring on real worker anomaly data
affects: [04-03, Phase 5 polish, INITIAL_GUIDE shutter contract]

actuals:
  tokens: 6820
  tasks: 3
  commits: 3
  plan_head_before: ace63ca9a4a2ebaace31fac3993889b3d05aed93

tech-stack:
  added: []
  patterns: ["First-baseline FSM early return in handleShutterClick", "Debounced tolerance re-diff via analyzeShelfCapture", "loadSavedTolerance legacy enum migration on read"]

key-files:
  created:
    - src/components/ResultInspectView.tolerance.test.tsx
    - src/App.toleranceReDiff.integration.test.tsx
  modified:
    - src/App.tsx
    - src/components/RoiSetupView.tsx
    - src/components/ResultInspectView.tsx
    - src/lib/storage.ts
    - src/types.ts
    - src/types/persisted.ts
    - src/lib/constants.ts
    - src/App.processing.integration.test.tsx

key-decisions:
  - "D-11 approved (Option A): numeric tolerance 0–100 in IndexedDB with strict→25, normal→50, loose→75 migration on load"
  - "First-baseline capture held in pendingBaselineImageUrl until save or retake — not persisted until saveBaseline"
  - "150ms debounce on tolerance slider triggers full worker re-diff, not client-side filter"

patterns-established:
  - "Pattern: !hasPersistedBaseline shutter branch routes to ROI_CONFIG before SCANNING_ANIM"
  - "Pattern: saveBaseline from first-baseline registers blob via objectUrlRegistry after pending capture save"

requirements-completed: [VIS-03, ROI-01, ROI-02, ROI-03, ROI-04, ROI-05, RSLT-01, RSLT-02, RSLT-03, RSLT-04, RSLT-05]

coverage:
  - id: D1
    description: "First-baseline shutter routes to ROI_CONFIG without scan/diff"
    requirement: ROI-01
    verification:
      - kind: integration
        ref: "grep pendingBaselineImageUrl && !hasPersistedBaseline in src/App.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Continuous tolerance slider replaces 3-button enum UI"
    requirement: RSLT-05
    verification:
      - kind: unit
        ref: "src/components/ResultInspectView.tolerance.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Debounced slider change re-invokes analyzeShelfCapture with updated tolerance"
    requirement: VIS-03
    verification:
      - kind: integration
        ref: "src/App.toleranceReDiff.integration.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Legacy tolerance enum migrates to numeric on IndexedDB load"
    requirement: VIS-03
    verification:
      - kind: unit
        ref: "src/lib/vision/toleranceParams.test.ts"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-23
status: complete
---

# Phase 04 Plan 02: First-Baseline FSM, ROI Flow & Continuous Tolerance Summary

**First capture calibrates ROI without scan; follow-up inspections use a 0–100 tolerance slider that debounces full worker re-diff.**

## Performance

- **Duration:** 18 min (continuation from D-11 checkpoint)
- **Tasks:** 3/3
- **Commits:** 3 (`f689750`, `b6b106d`, `86282dd`)

## Accomplishments

- D-11 Option A approved and implemented: `loadSavedTolerance` migrates legacy enum to numeric 0–100 with IndexedDB rewrite
- Empty-shelf shutter intercept: capture → `ROI_CONFIG` with pending frame, no `SCANNING_ANIM` or diff
- `RoiSetupView` first-baseline hint, retake discard, and save persists baseline blob + unlocks normal inspect path
- `ResultInspectView` horizontal range slider with preset ticks at 25/50/75; 150ms debounced `analyzeShelfCapture` on change
- Tap-to-dismiss uses shared `computeComplianceStats`; blink compare and filter capsules retained on real anomalies

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] App.processing.integration.test.tsx broke after first-baseline FSM**
- **Found during:** Task 3 verification
- **Issue:** Test mocked `loadBaselineRaw` as null, so shutter routed to ROI_CONFIG instead of processing overlay
- **Fix:** Mock persisted baseline so STAB-03 test exercises follow-up inspect path
- **Files modified:** `src/App.processing.integration.test.tsx`
- **Commit:** `86282dd`

## Self-Check: PASSED

- [x] `src/components/ResultInspectView.tolerance.test.tsx` — FOUND
- [x] `src/App.toleranceReDiff.integration.test.tsx` — FOUND
- [x] Commits f689750, b6b106d, 86282dd — FOUND
- [x] `bun run test` — 80/80 pass
- [x] `bun run build` — pass
