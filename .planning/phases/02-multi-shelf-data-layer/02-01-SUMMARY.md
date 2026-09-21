---
phase: 02-multi-shelf-data-layer
plan: 01
subsystem: database
tags: [indexeddb, idb-keyval, blob, migration, vitest, fake-indexeddb]

requires:
  - phase: 01-next-js-migration-capture-foundation
    provides: idb-keyval storage baseline, ShelfCalibration/AuditRecord types
provides:
  - shelfStorage.ts multi-shelf IndexedDB API with v1→v2 migration
  - blobUtils.ts JPEG compression and quota detection helpers
  - persisted.ts storage boundary types with Blob fields
  - Unit tests for migration, isolation, cap, quota, active shelf
affects: [02-02, 02-03, phase-3, phase-4, phase-5]

actuals:
  tokens: 42000
  tasks: 3
  commits: 3
  plan_head_before: 32487fb0b60186f06b7a74dda53ca85203e6ddb1

tech-stack:
  added: [fake-indexeddb@6.2.5]
  patterns:
    - "Embedded Blob in composite idb-keyval keys (Option A)"
    - "StorageWriteResult for quota-exceeded writes"
    - "validateShelfId clamp 0-4 on all shelf APIs"
    - "setMany then delMany atomic one-way migration"

key-files:
  created:
    - src/lib/shelfStorage.ts
    - src/lib/shelfStorage.test.ts
    - src/lib/blobUtils.ts
    - src/lib/blobUtils.test.ts
    - src/types/persisted.ts
  modified:
    - package.json
    - vitest.setup.ts

key-decisions:
  - "Option A approved: embedded Blob at shelf:{0-4}:baseline/history keys (D-04, D-17)"
  - "HISTORY_CAP=20 FIFO per shelf; global lang/tolerance remain in storage.ts"
  - "One-way schema v2 migration deletes legacy keys after setMany"

patterns-established:
  - "Pattern: runSchemaMigrationIfNeeded gates on shelfguard_schema_version=2"
  - "Pattern: toViewBaseline/toViewAuditRecord map persisted Blobs to view URL strings"
  - "Pattern: TDD RED→GREEN with fake-indexeddb and ESM-safe idb-keyval mock"

requirements-completed: [TECH-04, DATA-01, DATA-02, DATA-03, SHLF-04]

coverage:
  - id: D1
    description: "Legacy shelfguard_* keys migrate to shelf:0 with schema_version=2"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "src/lib/shelfStorage.test.ts#migrates legacy baseline and history"
        status: pass
    human_judgment: false
  - id: D2
    description: "Shelf-scoped baseline CRUD with Blob imageBlob storage"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "src/lib/shelfStorage.test.ts#isolates baseline data per shelfId"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-shelf audit history capped at 20 FIFO with compressed thumbnails"
    requirement: DATA-05
    verification:
      - kind: unit
        ref: "src/lib/shelfStorage.test.ts#caps per-shelf history at 20 FIFO"
        status: pass
    human_judgment: false
  - id: D4
    description: "QuotaExceededError returns structured StorageWriteResult"
    requirement: DATA-04
    verification:
      - kind: unit
        ref: "src/lib/shelfStorage.test.ts#returns QUOTA_EXCEEDED when saveBaseline"
        status: pass
    human_judgment: false
  - id: D5
    description: "Active shelf ID persists via shelfguard_active_shelf key"
    requirement: SHLF-04
    verification:
      - kind: unit
        ref: "src/lib/shelfStorage.test.ts#saveActiveShelfId(3) then loadActiveShelfId"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-21
status: complete
---

# Phase 02 Plan 01: Storage Foundation Summary

**shelfStorage.ts with one-way v2 migration, five-shelf Blob CRUD, and fake-indexeddb unit tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-21T11:53:00Z
- **Completed:** 2026-09-21T12:01:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Installed fake-indexeddb and scaffolded blobUtils + persisted types (Wave 0 harness)
- Human approved Option A at checkpoint: embedded Blob keys, HISTORY_CAP=20, one-way schema v2 (D-04, D-17)
- Implemented shelfStorage.ts with migration, shelf-scoped CRUD, active shelf, quota handling
- 13 unit tests green (blobUtils + shelfStorage)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install fake-indexeddb and scaffold blobUtils + persisted types** - `c80801a` (feat)
2. **Task 2: Confirm schema v2 and shelfStorage API contract** - checkpoint approved Option A (no commit)
3. **Task 3: Implement shelfStorage migration and shelf-scoped CRUD** - `dec5ebb` (test RED) + `c9d0e50` (feat GREEN)

**Plan metadata:** pending final docs commit

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `dec5ebb` test(02-01): RED shelfStorage tests | Pass (9 tests failed on assertions) |
| GREEN | `c9d0e50` feat(02-01): implement shelfStorage migration and CRUD | Pass (13 tests green) |
| REFACTOR | — | Skipped (no cleanup needed) |

## Files Created/Modified

- `src/lib/shelfStorage.ts` - Migration, shelf CRUD, active shelf, view mappers
- `src/lib/shelfStorage.test.ts` - Migration, isolation, cap, quota, active shelf tests
- `src/lib/blobUtils.ts` - dataUrlToBlob, compressToJpegBlob, isQuotaError
- `src/lib/blobUtils.test.ts` - Quota detection and JPEG compression tests
- `src/types/persisted.ts` - PersistedBaseline, PersistedAuditRecord, StorageWriteResult
- `vitest.setup.ts` - fake-indexeddb/auto import
- `package.json` - fake-indexeddb devDependency

## Decisions Made

- **Option A (checkpoint):** Embedded Blob in composite keys at `shelf:{0-4}:baseline` and history items with `thumbnailBlob`; HISTORY_CAP=20; global lang/tolerance stay in `storage.ts`; one-way schema v2 migration approved (D-04, D-17)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] fake-indexeddb Blob instanceof mismatch in tests**
- **Found during:** Task 3 (GREEN verification)
- **Issue:** `toBeInstanceOf(Blob)` failed because fake-indexeddb uses a different Blob constructor
- **Fix:** Added `expectBlob` helper checking size/type instead of constructor identity
- **Files modified:** src/lib/shelfStorage.test.ts
- **Committed in:** c9d0e50

**2. [Rule 3 - Blocking] ESM module spy on idb-keyval.set**
- **Found during:** Task 3 (quota test)
- **Issue:** `vi.spyOn(idbKeyval, 'set')` fails — ESM namespace not configurable
- **Fix:** vi.mock('idb-keyval') with vi.fn wrapper; vi.mocked(set) in quota test
- **Files modified:** src/lib/shelfStorage.test.ts
- **Committed in:** c9d0e50

**3. [Rule 3 - Blocking] compressToJpegBlob timeout in history cap test**
- **Found during:** Task 3 (history cap test)
- **Issue:** appendAuditRecord calls compressToJpegBlob which hung without Canvas mocks
- **Fix:** Added MockImage/canvas stubs to global beforeEach
- **Files modified:** src/lib/shelfStorage.test.ts
- **Committed in:** c9d0e50

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** Test infrastructure fixes only; implementation matches approved Option A contract.

## Issues Encountered

None beyond auto-fixed test environment issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- shelfStorage API ready for App.tsx wiring in plan 02-02 (migration on init, activeShelfId, shelf-scoped hydration)
- objectUrlRegistry and display URL resolution deferred to 02-02 per D-07
- Integration tests for shelf isolation in 02-03

## Self-Check: PASSED

- FOUND: src/lib/shelfStorage.ts
- FOUND: src/lib/shelfStorage.test.ts
- FOUND: src/lib/blobUtils.ts
- FOUND: src/types/persisted.ts
- FOUND: commit c80801a
- FOUND: commit dec5ebb
- FOUND: commit c9d0e50

---
*Phase: 02-multi-shelf-data-layer*
*Completed: 2026-09-21*
