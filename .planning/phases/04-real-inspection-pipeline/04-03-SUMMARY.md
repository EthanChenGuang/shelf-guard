---
phase: 04-real-inspection-pipeline
plan: 03
subsystem: testing
tags: [vitest, integration-tests, fsm, worker-error, phase-gate]

requires:
  - phase: 04-real-inspection-pipeline
    plan: 02
    provides: First-baseline FSM, tolerance slider, ROI flow
provides:
  - First-baseline integration test locking ROI_CONFIG without vision
  - Worker error banner with analysisFailed i18n and CAMERA_IDLE recovery
  - Complete-audit integration test with dismissed anomaly persistence
  - OpenCV worker pre-warm on persisted-baseline camera idle
  - Phase 4 automated gate green (83 tests, lint, build)
affects: [Phase 5 polish, verify-work UAT]

actuals:
  tokens: 52000
  tasks: 3
  commits: 3
  plan_head_before: fbc752d989ea373adeb12e01113314b4c7731810

tech-stack:
  added: []
  patterns: ["Worker init prewarm via postMessage type init", "Analysis error banner on CameraView", "Integration tests mock shelfStorage with importOriginal for HISTORY_CAP"]

key-files:
  created:
    - src/App.firstBaseline.integration.test.tsx
    - src/App.completeAudit.integration.test.tsx
  modified:
    - src/App.tsx
    - src/lib/vision.ts
    - src/workers/visionWorker.ts
    - src/components/CameraView.tsx
    - src/lib/constants.ts
    - src/App.completeAudit.integration.test.tsx

key-decisions:
  - "Worker rejection clears scan timer, shows analysisFailed banner, returns to CAMERA_IDLE (T-4-08)"
  - "prewarmVisionWorker posts init message; PROCESSING overlay covers remaining cold-start beyond 800ms"
  - "Complete audit persists full anomalies array including dismissed true flags per D-23"

patterns-established:
  - "Pattern: first-baseline shutter test mocks loadBaselineRaw null — exercises real FSM branch"
  - "Pattern: complete-audit test uses fireEvent on .ar-box for dismiss with 220ms debounce advance"

requirements-completed: [VIS-04, RSLT-06]

coverage:
  - id: D1
    description: "First-baseline shutter routes to ROI calibration without analyzeShelfCapture"
    requirement: ROI-01
    verification:
      - kind: integration
        ref: "src/App.firstBaseline.integration.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "PROCESSING overlay appears when mocked analysis exceeds 800ms"
    requirement: VIS-04
    verification:
      - kind: integration
        ref: "src/App.processing.integration.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Worker failure shows analysisFailed copy and returns to camera"
    requirement: VIS-04
    verification:
      - kind: integration
        ref: "src/App.completeAudit.integration.test.tsx#worker error"
        status: pass
    human_judgment: false
  - id: D4
    description: "Complete inspection saves audit with dismissed flags and returns to active shelf camera"
    requirement: RSLT-06
    verification:
      - kind: integration
        ref: "src/App.completeAudit.integration.test.tsx#complete audit"
        status: pass
    human_judgment: false
  - id: D5
    description: "Aligned device capture drift validation (VIS-01 viewpoint sensitivity)"
    requirement: VIS-01
    verification: []
    human_judgment: true
    rationale: "Requires physical device capture with 2–5° viewpoint drift — golden fixtures cannot substitute per 04-VALIDATION.md"
  - id: D6
    description: "Blink compare long-press gesture on mobile (RSLT-02)"
    requirement: RSLT-02
    verification: []
    human_judgment: true
    rationale: "Touch long-press interaction requires manual mobile UAT per 04-VALIDATION.md"

duration: 12min
completed: 2026-09-23
status: complete
---

# Phase 04 Plan 03: Integration Tests & Phase Gate Summary

**First-baseline and complete-audit flows locked in CI; worker errors return to camera with i18n copy; full lint/build/test gate green at 83 tests.**

## Performance

- **Duration:** 12 min
- **Tasks:** 3/3
- **Commits:** 3 (`a24ea79`, `a3bf65f`, `9b88055`)

## Accomplishments

- `App.firstBaseline.integration.test.tsx` proves empty shelf shutter → ROI_CONFIG without vision call or scan overlay
- Worker error path: catch `analyzeShelfCapture` rejection, clear timer, show `analysisFailed` banner, `CAMERA_IDLE`
- `prewarmVisionWorker()` + worker `init` message loads OpenCV before first analyze
- `App.completeAudit.integration.test.tsx` verifies dismissed anomaly flags in audit record and shelf-3 camera return
- Phase gate: `bun run lint && bun run build && bun run test` — 83/83 pass

## Task Commits

1. **Task 1: First-baseline FSM integration test** — `a24ea79` (test)
2. **Task 2: Worker error + complete audit** — `a3bf65f` (feat)
3. **Task 3: Phase verification gate** — `9b88055` (chore)

## Manual-Only Checkpoints (Non-Blocking)

| Item | Requirement | Rationale |
|------|-------------|-----------|
| Aligned device capture drift | VIS-01 | Physical viewpoint drift cannot be simulated in Vitest |
| Blink compare mobile gesture | RSLT-02 | Long-press touch UAT on real device |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/App.firstBaseline.integration.test.tsx` — FOUND
- [x] `src/App.completeAudit.integration.test.tsx` — FOUND
- [x] Commits a24ea79, a3bf65f, 9b88055 — FOUND
- [x] `bun run lint` — pass
- [x] `bun run build` — pass
- [x] `bun run test` — 83/83 pass
