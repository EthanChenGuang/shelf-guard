---
phase: 03-guided-capture-quality
plan: 03
subsystem: testing
tags: [vitest, integration-test, ghost-overlay, blob-url, ios, orientation]

requires:
  - phase: 03-02
    provides: iOS orientation permission hook, camera-then-orientation orchestration, orientation banner
provides:
  - Ghost overlay src swap integration test proving cross-shelf blob URL hygiene (D-19)
  - objectUrlRegistry blob-like acceptance for fake-indexeddb test environments
  - Phase 3 automated verification gate green (lint, build, 60 tests)
affects: [verify-work, ship, phase-04]

actuals:
  tokens: 12000
  tasks: 2
  commits: 3
plan_head_before: 2f9894acf76aa6f948213f72490deeec4340c879

tech-stack:
  added: []
  patterns:
    - Integration test ghost src assertions with live-camera mock (isUsingDemoFeed false)
    - objectUrlRegistry isBlobLike guard for cross-realm Blob deserialization

key-files:
  created: []
  modified:
    - src/App.shelfIsolation.integration.test.tsx
    - src/lib/objectUrlRegistry.ts

key-decisions:
  - "Switch-back assertion verifies no stale shelf-1 blob URL rather than URL string identity (revokeAll creates fresh URLs per switch)"
  - "iOS CAM-07 device verification deferred to manual checkpoint — automated tests cannot verify native permission dialog"

patterns-established:
  - "Ghost integration test uses getGhostImgSrc helper for blob:nodedata URLs in jsdom"
  - "mockIsUsingDemoFeed toggle per test without affecting baseline-id isolation tests"

requirements-completed: [CAM-01, CAM-02, CAM-03]

coverage:
  - id: D1
    description: Ghost overlay src updates on shelf switch without stale shelf-1 blob URL (D-19)
    requirement: CAM-02
    verification:
      - kind: integration
        ref: "src/App.shelfIsolation.integration.test.tsx#updates ghost overlay src on shelf switch"
        status: pass
    human_judgment: false
  - id: D2
    description: Phase 3 targeted test bundle (orientation, ghost, shelf isolation)
    requirement: CAM-03
    verification:
      - kind: unit
        ref: "bun run test -- src/hooks/useDeviceOrientation.test.ts src/components/CameraView.ghost.test.tsx src/components/CameraView.orientation.test.tsx src/App.shelfIsolation.integration.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: Full project lint, build, and test suite
    verification:
      - kind: other
        ref: "bun run lint && bun run build && bun run test"
        status: pass
    human_judgment: false
  - id: D4
    description: iOS orientation permission prompt on live-camera gesture with level gauge after grant (CAM-07)
    requirement: CAM-07
    verification:
      - kind: manual_procedural
        ref: "iOS Safari/PWA device checkpoint — Task 3 in 03-03-PLAN.md"
        status: unknown
    human_judgment: true
    rationale: CI cannot verify native Motion & Orientation permission dialog or haptic feedback on real iOS hardware

duration: 8min
completed: 2026-09-22
status: complete
---

# Phase 3 Plan 03: Shelf Ghost Integration & Phase Verification Gate Summary

**Ghost overlay src swap proven by integration test; Phase 3 automated gate green; iOS CAM-07 device verification pending**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-22T08:28:00Z
- **Completed:** 2026-09-22T08:36:00Z
- **Tasks:** 2 automated / 3 total (iOS manual checkpoint pending)
- **Files modified:** 2

## Accomplishments

- Extended `App.shelfIsolation.integration.test.tsx` with live-camera ghost overlay src swap test (D-03, D-19, CAM-02)
- Fixed `objectUrlRegistry` to accept blob-like objects from fake-indexeddb (cross-realm Blob deserialization)
- Phase 3 automated verification gate passed: lint, build, 60/60 tests including all Phase 3 targeted files

## Task Commits

Each automated task was committed atomically:

1. **Task 1: Shelf switch ghost source integration test (D-03, D-19, CAM-02)** - `45250ad` (test)

**Plan metadata:** `0e76d0d` (docs: complete plan)

## Files Created/Modified

- `src/App.shelfIsolation.integration.test.tsx` - Ghost src swap integration test; live-camera and orientation mocks extended
- `src/lib/objectUrlRegistry.ts` - `isBlobLike` guard replaces strict `instanceof Blob` check

## Decisions Made

- Switch-back test asserts `restoredSrc !== shelf1Src` (no stale leak) rather than exact URL identity, because `handleShelfChange` calls `revokeAll()` and creates fresh object URLs per switch
- iOS CAM-07 manual device checkpoint documented as pending — automated tasks complete per user instruction

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] objectUrlRegistry rejected fake-indexeddb blob-like objects**
- **Found during:** Task 1 (ghost integration test)
- **Issue:** `instanceof Blob` returned false for IndexedDB-deserialized blobs in jsdom, causing empty ghost `src` attributes
- **Fix:** Added `isBlobLike` guard and try/catch around `createObjectURL`
- **Files modified:** `src/lib/objectUrlRegistry.ts`
- **Committed in:** `45250ad`

**2. [Rule 1 - Bug] Switch-back URL identity assertion incompatible with revokeAll behavior**
- **Found during:** Task 1 (ghost integration test)
- **Issue:** Plan expected original shelf-0 blob URL string on switch-back, but App revokes all URLs on shelf change
- **Fix:** Assert switch-back src is a valid blob URL and not the shelf-1 URL (D-19 stale-leak semantics preserved)
- **Files modified:** `src/App.shelfIsolation.integration.test.tsx`
- **Committed in:** `45250ad`

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes required for integration test correctness; no scope creep.

## Pending Manual Verification (CAM-07)

**Status:** NOT VERIFIED — requires iOS device

The plan's Task 3 checkpoint (`checkpoint:human-verify`, gate=blocking) was not executed in this automated run. Complete on iOS Safari or installed PWA:

1. Deploy preview or run dev server accessible from iOS over HTTPS
2. Open ShelfGuard — confirm demo feed on launch (no auto camera start)
3. Tap demo/camera toggle — grant camera, then grant Motion & Orientation when prompted
4. Rotate phone — crosshair turns mint green within ±1.5° of level; haptic fires
5. Reset site permissions; deny orientation — confirm inline banner with Settings guide and Retry; camera feed still visible; ghost shows only on shelf with persisted baseline in live mode

**Resume signal:** Type "approved" if CAM-07 verified on device, or describe issues for gap closure.

## Test Results

| Gate | Command | Result |
|------|---------|--------|
| Ghost integration | `bun run test -- src/App.shelfIsolation.integration.test.tsx` | 5/5 pass |
| Phase 3 bundle | `bun run test -- src/hooks/useDeviceOrientation.test.ts src/components/CameraView.ghost.test.tsx src/components/CameraView.orientation.test.tsx src/App.shelfIsolation.integration.test.tsx` | 21/21 pass |
| Full suite | `bun run lint && bun run build && bun run test` | lint pass, build pass, 60/60 pass |

## Issues Encountered

None beyond auto-fixed blob deserialization (see Deviations).

## Next Phase Readiness

- Phase 3 automated success criteria met (CAM-01, CAM-02, CAM-03)
- CAM-07 blocked on iOS device verification — phase ship gate should treat orientation permission UX as pending human sign-off
- Ready for `/gsd-verify-work` on automated deliverables; manual CAM-07 UAT required before full phase closure

## Self-Check: PASSED

- [x] `src/App.shelfIsolation.integration.test.tsx` exists
- [x] `src/lib/objectUrlRegistry.ts` exists
- [x] Commit `45250ad` exists

---
*Phase: 03-guided-capture-quality*
*Completed: 2026-09-22*
