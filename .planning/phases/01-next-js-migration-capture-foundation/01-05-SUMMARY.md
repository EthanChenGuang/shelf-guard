---
phase: 01-next-js-migration-capture-foundation
plan: 05
subsystem: ui
tags: [pwa, tailwind, vitest, layout-regression, offline-indicator]

requires:
  - phase: 01-next-js-migration-capture-foundation
    provides: OfflineIndicator component and PWA-03 offline shell behavior
provides:
  - Offline pill raised to bottom-24 on narrow viewports (G-01-4 closed)
  - Layout regression test guarding 320×640 shutter overlap
affects: [phase-01-verify-work, pwa-uat]

actuals:
  tokens: 1200
  tasks: 3
  commits: 2
  plan_head_before: a419405bdb3480264d0aaafea9008e11da5c47eb

tech-stack:
  added: []
  patterns:
    - "Layout regression via mocked getBoundingClientRect at fixed viewport dimensions"
    - "Tailwind bottom-24 fixed positioning for bottom-control clearance"

key-files:
  created: []
  modified:
    - src/components/OfflineIndicator.tsx
    - src/components/OfflineIndicator.test.tsx

key-decisions:
  - "Used bottom-24 (96px) over bottom-[6.5rem] — plan default; clears shutter band bottom at 320×640"

patterns-established:
  - "G-01-4 layout tests mock viewport + getBoundingClientRect with plan-documented shutter band coordinates"

requirements-completed: [PWA-03]

coverage:
  - id: D1
    description: "Offline indicator pill no longer overlaps shutter control at 320px viewport"
    requirement: PWA-03
    verification:
      - kind: unit
        ref: "src/components/OfflineIndicator.test.tsx#positions pill above shutter band at 320px viewport (G-01-4)"
        status: pass
      - kind: unit
        ref: "bun run test"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 05: Fix Offline Pill Overlap Summary

**Offline pill raised from bottom-3 to bottom-24 with 320×640 layout regression test closing gap G-01-4**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-20T19:24:00Z
- **Completed:** 2026-09-20T19:26:11Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Changed `OfflineIndicator` fixed position from `bottom-3` to `bottom-24` so the pill clears the 76px shutter band on 320×640 viewports
- Added layout regression test with mocked `getBoundingClientRect` asserting pill bottom sits above the shutter band bottom (608px) and above the pre-fix bottom-3 position (628px)
- Full test suite green: 8 files, 17 tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Raise pill position** - `5fccce1` (fix)
2. **Task 2: Add layout regression test** - `6b1e921` (test)

**Plan metadata:** `c8a501a` (docs: complete plan)

## Files Created/Modified

- `src/components/OfflineIndicator.tsx` - Raised fixed bottom offset from `bottom-3` to `bottom-24`
- `src/components/OfflineIndicator.test.tsx` - Added G-01-4 layout regression test at 320×640

## Decisions Made

- Used `bottom-24` as specified in plan (96px offset) rather than `bottom-[6.5rem]` — sufficient to clear shutter band bottom at narrow viewports

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Gap G-01-4 closed; ready for `/gsd-verify-work 01` UAT test 4 re-run at 320×640
- All automated tests pass

## Self-Check: PASSED

- `src/components/OfflineIndicator.tsx` — FOUND
- `src/components/OfflineIndicator.test.tsx` — FOUND
- Commit `5fccce1` — FOUND
- Commit `6b1e921` — FOUND
- `bun run test` — 17/17 passed

---
*Phase: 01-next-js-migration-capture-foundation*
*Completed: 2026-09-20*
