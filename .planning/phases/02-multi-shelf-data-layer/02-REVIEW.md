---
phase: 02-multi-shelf-data-layer
reviewed: 2026-09-21T12:05:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/shelfStorage.ts
  - src/lib/blobUtils.ts
  - src/types/persisted.ts
  - src/lib/objectUrlRegistry.ts
  - src/components/ShelfSelector.tsx
  - src/App.tsx
  - src/components/CameraView.tsx
  - src/lib/storage.ts
  - src/lib/constants.ts
  - vitest.setup.ts
findings:
  critical: 3
  warning: 6
  info: 2
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-21T12:05:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 02 introduces a solid multi-shelf IndexedDB layer (`shelfStorage.ts`), blob compression utilities, and App wiring with an object-URL registry. Unit and integration tests cover the happy paths for migration, isolation, quota, and FIFO caps. However, three correctness gaps threaten shelf isolation and migration safety: (1) legacy baseline data can be deleted without being migrated when validation fails, (2) a failed `saveActiveShelfId` during shelf switch leaves UI state inconsistent with revoked blob URLs, and (3) rapid shelf switching has no in-flight guard, allowing stale `loadShelfData` results to overwrite the active shelf's displayed data. Object-URL lifecycle is mostly sound (`revokeAll` on switch/unmount) but evicted FIFO history entries leak registry entries until the next full revoke.

## Critical Issues

### CR-01: Legacy baseline deleted without migration when splitY validation fails

**File:** `src/lib/shelfStorage.ts:119-133,162-168`
**Issue:** Migration always writes `shelfguard_schema_version=2` and deletes `shelfguard_baseline` whenever `legacyBaseline` is truthy — even when `isValidSplitY(legacyBaseline.splitYPercentages)` fails and the baseline is never copied to `shelf:0:baseline`. On the next launch migration is a no-op (schema already 2), so the user's legacy baseline is permanently lost.
**Fix:**
```typescript
const migratedBaseline =
  legacyBaseline && isValidSplitY(legacyBaseline.splitYPercentages);
// ...
if (migratedBaseline) {
  // build persisted baseline and push to entries
}
// ...
if (migratedBaseline) legacyKeys.push(LEGACY_KEY_BASELINE);
```

### CR-02: Shelf switch on quota failure desynchronizes UI and revokes live URLs

**File:** `src/App.tsx:171-179`
**Issue:** `handleShelfChange` calls `revokeAll()` and `setActiveShelfId(newShelfId)` before `saveActiveShelfId`. If the save returns `{ok: false, error: 'QUOTA_EXCEEDED'}`, the handler returns early without calling `loadShelfData` or rolling back. The selector shows the new shelf index, but `baseline` / `auditHistory` still hold the previous shelf's data whose blob URLs were just revoked — broken images and a mismatched active-shelf indicator.
**Fix:**
```typescript
const handleShelfChange = async (newShelfId: number) => {
  const prevShelfId = activeShelfId;
  const saveResult = await saveActiveShelfId(newShelfId);
  if (!saveResult.ok) {
    setQuotaError(true);
    return;
  }
  urlRegistryRef.current.revokeAll();
  setActiveShelfId(newShelfId);
  await loadShelfData(newShelfId);
};
```
Alternatively, on failure revert `activeShelfId` to `prevShelfId` and skip `revokeAll` until the save succeeds.

### CR-03: Concurrent shelf switches allow stale data to overwrite active shelf

**File:** `src/App.tsx:100-117,171-179`
**Issue:** `handleShelfChange` is async with no generation token or abort guard. If the user switches shelf 2 then quickly to shelf 1, two `loadShelfData` calls run concurrently. Whichever finishes last wins, regardless of the final `activeShelfId`. A slower load for shelf 2 can paint shelf 2 baseline/history while the selector shows shelf 1 — a direct shelf-isolation violation.
**Fix:**
```typescript
const shelfLoadGenRef = useRef(0);

const loadShelfData = useCallback(async (shelfId: number) => {
  const gen = ++shelfLoadGenRef.current;
  // ... fetch and build nextBaseline / nextHistory ...
  if (gen !== shelfLoadGenRef.current) return; // stale
  setBaseline(nextBaseline);
  setAuditHistory(nextHistory);
}, []);
```

## Warnings

### WR-01: Migration uses separate transactions for write and legacy-key deletion

**File:** `src/lib/shelfStorage.ts:160-168`
**Issue:** `setMany(entries)` and `delMany(legacyKeys)` are separate IndexedDB transactions. If the app crashes or `delMany` fails after `setMany` succeeds, legacy keys remain alongside v2 keys. Schema version 2 prevents re-migration, leaving orphaned v1 keys (not data loss of migrated content, but breaks the "one-way cleanup" contract).
**Fix:** Wrap both operations in a single `idb-keyval` custom transaction, or delete legacy keys inside the same `setMany` batch via a dedicated migration helper that uses raw IDB transactions.

### WR-02: Non-quota migration errors become unhandled promise rejections in App init

**File:** `src/App.tsx:120-141`, `src/lib/shelfStorage.ts:172-177`
**Issue:** `runSchemaMigrationIfNeeded` re-throws non-quota errors. The mount `useEffect` calls `init()` without `.catch()`, so a corrupt legacy record (e.g. missing `thumbnailUrl` causing `.startsWith` to throw at line 138) surfaces as an unhandled rejection and leaves the app on `DEFAULT_CALIBRATION` with no user-facing error.
**Fix:** Wrap `init()` in try/catch, surface a fatal-init banner, and/or return `{ok: false, error: 'MIGRATION_FAILED'}` instead of throwing for recoverable migration faults.

### WR-03: Legacy history migration assumes `thumbnailUrl` is always present

**File:** `src/lib/shelfStorage.ts:138-140`
**Issue:** `record.thumbnailUrl.startsWith('data:')` throws if `thumbnailUrl` is `undefined`/`null`, aborting the entire migration before `setMany`. Any partially migrated v1 install with a malformed history entry blocks all users from completing migration.
**Fix:**
```typescript
const thumb = record.thumbnailUrl ?? '';
const thumbnailBlob = thumb.startsWith('data:')
  ? await dataUrlToBlob(thumb)
  : thumb
    ? await compressToJpegBlob(thumb)
    : new Blob([], {type: 'image/jpeg'});
```

### WR-04: Compression failures in `appendAuditRecord` bypass structured quota handling

**File:** `src/lib/shelfStorage.ts:274-291`, `src/lib/blobUtils.ts:13-38`
**Issue:** Only IndexedDB `QuotaExceededError` is mapped to `StorageWriteResult`. Failures in `compressToJpegBlob` (canvas unavailable, `toBlob` failure, corrupt capture URL) propagate as unhandled exceptions from `handleCompleteAudit`, bypassing the quota banner UX and leaving audit state inconsistent.
**Fix:** Catch errors in `appendAuditRecord`, distinguish quota vs. compression failures, and return `{ok: false, error: 'QUOTA_EXCEEDED'}` or a new `'COMPRESSION_FAILED'` code; handle both in App.

### WR-05: FIFO history eviction leaves orphaned object URLs in the registry

**File:** `src/App.tsx:276-284`, `src/lib/objectUrlRegistry.ts:5-28`
**Issue:** When `appendAuditRecord` drops records beyond `HISTORY_CAP`, the App adds a URL for the new record but never revokes registry keys for evicted record IDs (`history:{shelfId}:{recordId}`). Over many audits on one shelf, revoked-only-on-switch URLs accumulate until `revokeAll`.
**Fix:** After append, diff previous and new history IDs and call `registry.revoke` for dropped IDs, or rebuild history URLs from scratch each append.

### WR-06: `isQuotaError` may miss platform-specific quota signals

**File:** `src/lib/blobUtils.ts:8-10`
**Issue:** Detection requires `err instanceof DOMException && err.name === 'QuotaExceededError'`. Some browsers/environments surface quota exhaustion as generic `DOMException` with code 22 or a non-DOM error, causing throws instead of `{ok: false, error: 'QUOTA_EXCEEDED'}`.
**Fix:** Broaden detection:
```typescript
export function isQuotaError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'QuotaExceededError' || err.code === 22;
  }
  return err instanceof Error && /quota/i.test(err.message);
}
```

## Info

### IN-01: `ShelfSelector` accepts unused `lang` prop

**File:** `src/components/ShelfSelector.tsx:6-15`
**Issue:** `lang` is declared in the props interface and passed from `CameraView` but never destructured or used. Dead prop adds noise and may confuse future i18n work.
**Fix:** Remove `lang` from `ShelfSelectorProps` and the `CameraView` call site until shelf labels need localization.

### IN-02: Global settings writes in `storage.ts` silently swallow quota errors

**File:** `src/lib/storage.ts:18-24,37-43`
**Issue:** `saveLanguage` / `saveTolerance` log to console on failure but do not surface quota exhaustion to the App layer (unlike shelf writes). Low severity because these payloads are tiny, but inconsistent with the Phase 02 quota-handling pattern.
**Fix:** Return `StorageWriteResult` or rethrow quota errors for optional App-level handling.

---

_Reviewed: 2026-09-21T12:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
