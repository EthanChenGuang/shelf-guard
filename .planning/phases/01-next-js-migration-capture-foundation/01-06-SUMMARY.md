---
phase: 01-next-js-migration-capture-foundation
plan: 06
subsystem: ui
tags: [tailwind, vitest, pwa, layout, offline-indicator]

requires:
  - phase: 01-05
    provides: bottom-24 offline pill offset and initial G-01-4 layout test
provides:
  - OfflineIndicator at bottom-28 (112px) clearing shutter top 532px at 320×640
  - Non-circular G-01-4 layout regression test against Playwright-measured geometry
affects: [01-verify-work, UAT test 4]

actuals:
  tokens: 4200
  tasks: 2
  commits: 2
plan_head_before: cfd28e5e929cdcd7fcc65ee5ec1be040031f7911

tech-stack:
  added: []
  patterns:
    - "Layout regression tests use Playwright-measured constants, not circular getBoundingClientRect mocks"

key-files:
  created: []
  modified:
    - src/components/OfflineIndicator.tsx
    - src/components/OfflineIndicator.test.tsx

key-decisions:
  - "Used bottom-28 (112px) over bottom-[6.75rem] (108px) for 4px clearance below shutter top 532"

patterns-established:
  - "G-01-4 clearance asserted via offset math (viewportHeight - bottom28Px) ≤ shutterTop"

requirements-completed: [PWA-03]

coverage:
  - id: D1
    description: "Offline pill fixed at bottom-28 clears #shutter-trigger top at 320×640"
    requirement: PWA-03
    verification:
      - kind: unit
        ref: "src/components/OfflineIndicator.test.tsx#positions pill above shutter band at 320px viewport (G-01-4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Offline indicator shows I18N text when navigator offline"
    requirement: PWA-03
    verification:
      - kind: unit
        ref: "src/components/OfflineIndicator.test.tsx#renders offlineMode I18N text when navigator.onLine is false"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 06: Close G-01-4 Offline Pill Overlap Summary

**Offline pill raised to bottom-28 with shutter-top (532px) clearance test replacing circular rect mock**

## Performance

- **Duration:** 2 min
- **Started:** 2026-09-20T19:39:54Z
- **Completed:** 2026-09-20T19:41:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Raised OfflineIndicator from `bottom-24` (96px) to `bottom-28` (112px) — pill bottom 528px clears shutter top 532px by 4px
- Rewrote G-01-4 layout test to assert `expectedPillBottom ≤ shutterTop` using Playwright-measured constants
- Removed circular `getBoundingClientRect` mock that only proved band-bottom clearance (608px), not shutter-top overlap

## Task Commits

Each task was committed atomically:

1. **Task 1: Raise offline pill to bottom-28** - `b4f3b98` (fix)
2. **Task 2: Fix G-01-4 layout test** - `6841f97` (test)

## Files Created/Modified

- `src/components/OfflineIndicator.tsx` - Changed fixed offset class from bottom-24 to bottom-28
- `src/components/OfflineIndicator.test.tsx` - Shutter-top clearance math with UAT-sourced constants; removed vi.spyOn mock

## Decisions Made

- Chose `bottom-28` (112px → pill bottom 528px) over `bottom-[6.75rem]` (108px → flush at 532px) for 4px safety margin below shutter top

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-01-4 code fix and unit regression test complete
- Re-run UAT test 4 via `/gsd-verify-work 01` to confirm Playwright clearance at 320×640

## Self-Check: PASSED

- FOUND: src/components/OfflineIndicator.tsx
- FOUND: src/components/OfflineIndicator.test.tsx
- FOUND: b4f3b98
- FOUND: 6841f97

---
*Phase: 01-next-js-migration-capture-foundation*
*Completed: 2026-09-20*
