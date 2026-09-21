# Phase 2: Multi-Shelf Data Layer - Research

**Researched:** 2026-09-21
**Domain:** Client-side IndexedDB multi-tenant shelf persistence (idb-keyval, Blob storage, schema migration)
**Confidence:** HIGH

## Summary

Phase 2 replaces the flat single-shelf IndexedDB schema in `src/lib/storage.ts` with five isolated shelf namespaces, migrates legacy data to shelf index 0, and cuts quota pressure by persisting JPEG Blobs instead of base64 data URLs. The brownfield storage layer already uses `idb-keyval` 6.3.0 with keys `shelfguard_baseline` and `shelfguard_audit_history` [VERIFIED: src/lib/storage.ts:5,14]; history is capped at 50 records via `.slice(0, 50)` [VERIFIED: src/lib/storage.ts:65]. Phase 2 introduces namespaced keys, a schema version marker, Blob-based baseline and thumbnail storage, FIFO history cap of 20 per shelf, and structured `{ ok, error }` returns for quota failures surfaced as an inline CameraView banner.

**Primary recommendation:** Extract a shelf-aware storage module (`src/lib/shelfStorage.ts`) that (1) runs a one-time v1→v2 migration with `setMany` before App hydration, (2) stores composite persisted records with embedded `Blob` fields at flat prefixed keys (no custom serializer — idb-keyval natively structured-clones Blobs [CITED: github.com/jakearchibald/idb-keyval README]), (3) resolves display URLs via `URL.createObjectURL` with revocation on shelf switch, and (4) ships integration tests proving shelf A data never appears when `activeShelfId` is B.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Legacy Migration (DATA-03)
- **D-01:** Migrate legacy single-key data to **shelf index 0** — user-facing "Shelf 1" maps to `shelf:0:*`. DATA-03 wording "shelf-1" means first shelf, not index 1.
- **D-02:** Migrate **both** legacy baseline and audit history to shelf 0 in a single atomic migration pass — preserves the user's existing workflow as one calibrated unit.
- **D-03:** After successful migration, **delete** legacy keys (`shelfguard_baseline`, `shelfguard_audit_history`) — no dual-read of old keys in steady state.
- **D-04:** Write global marker `shelfguard_schema_version: 2` after migration completes; skip re-migration on subsequent launches. — **Reversibility:** one-way — downgrading schema version without a reverse migration would corrupt or duplicate data.

#### Blob Storage & Type Cutover (DATA-02)
- **D-05:** Persist baseline images as **JPEG Blob** in IndexedDB, not base64 data URLs — satisfies DATA-02 quota pressure from CONCERNS.md.
- **D-06:** During v1→v2 migration, **convert existing data URL strings to Blobs** in the same pass as shelf namespacing — no indefinite dual-format steady state.
- **D-07:** **Break the persisted shape** at the storage boundary: shelf baseline record stores `imageBlob` + metadata (`splitYPercentages`, `imageDimensions`, etc.). Components receive a **resolved object URL** via a storage helper (e.g., `getBaselineDisplayUrl(shelfId)`) — do not pass raw Blobs into view props. Revoke object URLs on shelf switch/unmount to avoid leaks.
- **D-08:** Audit record thumbnails also stored as **Blob** (compressed JPEG), not data URLs — consistent quota strategy across baseline and history.

#### Key Namespace Layout (DATA-01)
- **D-09:** Use flat namespaced keys per shelf:
  - `shelf:{0-4}:baseline` — serialized baseline metadata + Blob reference (via idb-keyval custom serializer or separate blob key `shelf:{0-4}:baseline:blob`)
  - `shelf:{0-4}:history` — `AuditRecord[]` capped at 20
  - `shelfguard_active_shelf` — integer 0–4, default `0`
  - `shelfguard_schema_version` — integer, current `2`
  - Global unchanged: `shelfguard_lang`, `shelfguard_tolerance`
- **D-10:** Shelves 1–4 (indices 1–3 and empty index 4) start **empty** after migration — `DEFAULT_CALIBRATION` equivalent with no persisted baseline until user calibrates in Phase 4/5.

#### History Cap & Thumbnails (DATA-05)
- **D-11:** Cap per-shelf history at **20 records** (down from current global 50) — FIFO eviction: on insert, drop oldest when length > 20.
- **D-12:** Generate audit thumbnails at **320px max width**, **JPEG quality 0.75** — balance visibility vs quota.
- **D-13:** Eviction policy: **oldest-first (FIFO)** on new audit insert — simplest, matches "recent inspections matter most" field use.

#### App Wiring Depth (Phase 2 vs Phase 5)
- **D-14:** Wire **`activeShelfId`** into `App.tsx` state; all baseline/history load/save calls go through shelf-scoped storage API — required for SHLF-02, SHLF-03, SHLF-04.
- **D-15:** Add a **minimal temporary shelf selector** (simple segmented control or dropdown, 5 labels "1–5") — **not** the PRD swipe carousel. Purpose: manual QA and success-criteria verification only; Phase 5 replaces with polished carousel (SHLF-01). Style: functional, can use existing Tailwind tokens but no PRD animation investment.
- **D-16:** Add **integration tests** proving shelf A baseline/history does not leak when `activeShelfId` switches to shelf B — tests are mandatory; UI switcher supplements manual QA.
- **D-17:** Begin **light storage extraction** from monolithic `App.tsx` — introduce `src/lib/shelfStorage.ts` (or refactor `storage.ts`) with shelf-aware API; full `useAuditFlow` hook decomposition remains optional/discretionary unless planner sees clear win. — **Reversibility:** costly — storage API becomes contract for Phases 3–5.

#### Quota-Exceeded UX (DATA-04)
- **D-18:** Surface QuotaExceededError as an **inline banner** on the camera main view — same pattern as Phase 1 camera error banner (D-07), not a modal or separate route.
- **D-19:** **Block the failed write** — do not silently swallow; return `{ ok: false, error: 'QUOTA_EXCEEDED' }` from storage functions so App can show banner.
- **D-20:** Trigger user-visible quota errors on: **baseline save**, **audit append**, and **migration** (if migration write fails). Read failures fall back to defaults with console warn (existing pattern).
- **D-21:** Banner copy (I18N in `constants.ts`): explain storage is full, suggest completing audits on other shelves or clearing old history — **no delete UI in Phase 2**; message only. Phase 5+ may add management actions.

### Claude's Discretion
- Exact idb-keyval Blob serialization approach (custom deserializer vs separate blob keys per shelf).
- Segmented control vs dropdown for temporary shelf selector placement.
- Whether to extract `useActiveShelf` hook vs inline state in App.tsx.
- Unit test file layout (`storage.test.ts` vs `shelfStorage.test.ts`).
- Exact I18N key names for quota banner strings.

### Deferred Ideas (OUT OF SCOPE)
- **PRD swipe carousel + active-shelf indicator** — Phase 5 (SHLF-01).
- **INITIAL_GUIDE when shelf has no baseline** — Phase 5 (SHLF-05); Phase 2 empty shelves use existing default calibration behavior.
- **Delete-audit / free-storage management UI** — quota banner mentions clearing history; actionable UI deferred.
- **Per-shelf tolerance or language** — not in requirements; keep global.
- **Full `useAuditFlow` hook extraction** — optional in Phase 2; mandatory only if App.tsx becomes unmanageable during shelf wiring.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TECH-04 | Use `idb-keyval` for large images, ROI, history, settings | Keep idb-keyval 6.3.0; extend with namespaced keys + `setMany` atomic migration [VERIFIED: npm registry + Context7] |
| DATA-01 | Namespaced keys `shelf:{0-4}:*` isolate 5 shelves | Flat key prefix pattern; no multi-store migration needed [CITED: idb-keyval custom-stores.md] |
| DATA-02 | Baseline as JPEG Blob, not base64 DataURL | Native Blob structured-clone in idb-keyval; composite persisted type at storage boundary |
| DATA-03 | Legacy single-key data migrates to first shelf | One-time migration to `shelf:0:*`; delete legacy keys; schema version gate |
| DATA-04 | QuotaExceededError shown in UI | Structured error returns + inline CameraView banner (reuse CAM-08 pattern) |
| DATA-05 | Per-shelf history cap ~20 with compressed thumbnails | FIFO `.slice(0, 20)`; Canvas resize to 320px @ JPEG 0.75 before persist |
| SHLF-02 | Each shelf has independent baseline | `loadBaseline(shelfId)` / `saveBaseline(shelfId, …)` keyed by active shelf |
| SHLF-03 | Each shelf has independent history | `loadAuditHistory(shelfId)` / `saveAuditRecord(shelfId, …)` with isolation tests |
| SHLF-04 | Active shelf ID persists across restarts | `shelfguard_active_shelf` key 0–4, loaded before shelf-scoped hydration |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Namespaced IndexedDB read/write | Browser / Client (`src/lib/shelfStorage.ts`) | — | idb-keyval runs in browser; no backend |
| v1→v2 schema migration | Browser / Client (app init, before hydration) | — | Must complete before App reads shelf data |
| Blob persistence (baseline + thumbnails) | Browser / Client (storage module) | — | IndexedDB structured clone; quota is client-side |
| Object URL create/revoke for display | Browser / Client (storage helper or hook in App) | Presentation (`CameraView`, etc.) | Components receive resolved URL strings, not Blobs |
| Thumbnail compression (320px JPEG) | Browser / Client (Canvas in lib helper) | — | Runs before write; no server |
| Active shelf selection + persistence | Application Controller (`App.tsx`) | Browser / Client (storage) | FSM owns `activeShelfId`; storage persists it |
| Temporary 5-shelf QA selector | Presentation (`CameraView` or App chrome) | Application Controller | UI-only bridge; calls App shelf-switch handler |
| Quota-exceeded banner | Presentation (`CameraView`) | Application Controller | Banner surface exists for camera errors; App passes quota message |
| Shelf isolation integration tests | Dev tooling (Vitest + fake-indexeddb) | — | Validates storage contract before Phase 3+ |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb-keyval | 6.3.0 | IndexedDB KV for shelf data | Already integrated [VERIFIED: package.json:18]; native Blob support via structured clone [CITED: github.com/jakearchibald/idb-keyval README] |
| Canvas API | (browser) | dataURL→Blob conversion, thumbnail resize | No dependency; required for D-06/D-12 |
| URL.createObjectURL / revokeObjectURL | (browser) | Display resolved image URLs from Blobs | Standard pattern for Blob display without base64 in React state [CITED: developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fake-indexeddb | 6.2.5 | In-memory IndexedDB for unit tests | Storage/migration tests in Vitest [ASSUMED] — not yet in package.json |
| vitest | 5.0.1 | Test runner | Phase 1 established pattern [VERIFIED: package.json:38-39] |
| @testing-library/react | 16.3.3 | App integration tests | Shelf isolation integration test (D-16) [VERIFIED: package.json:27] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Embedded Blob in composite key value | Separate `shelf:{n}:baseline:blob` key | Separate keys allow metadata-only updates without re-writing blob; adds read coordination — defer unless profiling shows need |
| idb-keyval flat prefixes | `idb` full library (Jake Archibald) | Needed for multi-store transactions and schema callbacks; overkill for prefix-key v1 [CITED: idb-keyval custom-stores.md] |
| Custom idb-keyval serializer | Native structured clone | idb-keyval already stores Blob; custom serializer adds complexity with no quota benefit |

**Installation:**

```bash
# Production deps unchanged — idb-keyval already present
npm install -D fake-indexeddb@6.2.5
```

**Version verification:**

```bash
npm view idb-keyval version          # 6.3.0
npm view fake-indexeddb version      # 6.2.5
npm view vitest version              # 5.0.1
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| idb-keyval | npm | ~2 mo (6.3.0) | ~6.5M/wk | github.com/jakearchibald/idb-keyval | OK | Approved |
| fake-indexeddb | npm | ~4 mo (6.2.5) | ~4.8M/wk | github.com/dumbmatter/fakeIndexedDB | OK | Approved (dev only) |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

**Postinstall scripts:** idb-keyval and fake-indexeddb both have `null` postinstall [VERIFIED: npm view this session]

## Architecture Patterns

### System Architecture Diagram

```text
App mount (App.tsx useEffect init)
    │
    ▼
runSchemaMigrationIfNeeded()          ──► read legacy keys
    │                                      convert dataURL → Blob
    │                                      setMany(new shelf:0 keys, schema_version=2)
    │                                      delMany(legacy keys)
    │                                      on QuotaExceeded → { ok: false } → quota banner
    ▼
loadActiveShelfId()                   ──► shelfguard_active_shelf (default 0)
    │
    ▼
parallel load for activeShelfId:
    loadBaseline(shelfId)             ──► shelf:{n}:baseline → PersistedBaseline
    loadAuditHistory(shelfId)         ──► shelf:{n}:history → PersistedAuditRecord[]
    loadSavedLanguage/Tolerance()     ──► global keys (unchanged)
    │
    ▼
resolveDisplayUrls(blobs)             ──► URL.createObjectURL → ShelfCalibration.imageDataUrl
    │                                      AuditRecord.thumbnailUrl (in-memory view shape)
    ▼
React state hydration → CameraView / modals

User switches shelf (QA selector):
    revokeObjectURLs(previous shelf)
    loadBaseline/newHistory(newShelfId)
    resolveDisplayUrls → setState
    saveActiveShelfId(newShelfId)

User saves baseline / completes audit:
    compress thumbnail if audit (320px, q=0.75)
    saveBaseline(shelfId) / appendAuditRecord(shelfId)
    FIFO cap history at 20
    on QuotaExceeded → return error → App sets quotaBanner
```

### Recommended Project Structure

```text
src/lib/
├── storage.ts              # thin re-export or global settings (lang, tolerance) — keep
├── shelfStorage.ts         # NEW: migration, shelf-scoped CRUD, quota results
├── blobUtils.ts            # NEW: dataUrlToBlob, compressToJpegBlob, isQuotaError
├── objectUrlRegistry.ts    # NEW (optional): create/revoke display URLs per shelf
├── imageDimensions.ts      # existing — extend to accept Blob via object URL
└── constants.ts            # add quota I18N keys

src/types/
├── persisted.ts            # NEW: PersistedBaseline, PersistedAuditRecord (Blob fields)
└── (types.ts view shapes unchanged for components)

src/lib/shelfStorage.test.ts           # unit: migration, cap, isolation, quota mock
src/App.shelfIsolation.integration.test.tsx  # integration: switch shelf, no leak
```

### Pattern 1: Embedded Blob in Composite Persisted Record (Recommended)

**What:** Store `{ imageBlob, splitYPercentages, imageDimensions, id, createdAt, tierLabels }` as a single value at `shelf:{n}:baseline`. History array items store `thumbnailBlob` instead of `thumbnailUrl`.

**When to use:** Default for Phase 2 — idb-keyval documents that Blob is structured-clonable without custom serializer [CITED: github.com/jakearchibald/idb-keyval README].

**Why not separate blob keys:** Separate `shelf:{n}:baseline:blob` keys help when metadata updates frequently without touching the image; Phase 2 baseline saves always include the image blob or metadata together. Embedded Blob reduces read round-trips and migration complexity.

**Example:**

```typescript
// Source: idb-keyval README + Phase 2 CONTEXT D-05/D-09
import { get, set, setMany, delMany } from 'idb-keyval';

export interface PersistedBaseline {
  id: string;
  createdAt: number;
  imageBlob: Blob; // JPEG
  imageDimensions: { width: number; height: number };
  splitYPercentages: [number, number, number, number];
  tierLabels: [string, string, string, string];
}

const baselineKey = (shelfId: number) => `shelf:${shelfId}:baseline`;

export async function saveBaseline(
  shelfId: number,
  record: PersistedBaseline,
): Promise<{ ok: true } | { ok: false; error: 'QUOTA_EXCEEDED' }> {
  try {
    await set(baselineKey(shelfId), record);
    return { ok: true };
  } catch (err) {
    if (isQuotaError(err)) return { ok: false, error: 'QUOTA_EXCEEDED' };
    throw err;
  }
}
```

### Pattern 2: Atomic v1→v2 Migration with setMany

**What:** Read legacy keys, convert to shelf 0 persisted shape, write all new keys in one atomic `setMany`, then delete legacy keys.

**When to use:** App init before any shelf-scoped hydration (D-02, D-03, D-04).

**Example:**

```typescript
// Source: Context7 /jakearchibald/idb-keyval setMany docs
import { get, setMany, delMany } from 'idb-keyval';

const LEGACY_BASELINE = 'shelfguard_baseline';
const LEGACY_HISTORY = 'shelfguard_audit_history';
const SCHEMA_VERSION_KEY = 'shelfguard_schema_version';
const CURRENT_SCHEMA = 2;

export async function runSchemaMigrationIfNeeded(): Promise<
  { ok: true } | { ok: false; error: 'QUOTA_EXCEEDED' }
> {
  const version = await get<number>(SCHEMA_VERSION_KEY);
  if (version === CURRENT_SCHEMA) return { ok: true };

  const legacyBaseline = await get<ShelfCalibration>(LEGACY_BASELINE);
  const legacyHistory = await get<AuditRecord[]>(LEGACY_HISTORY);

  const entries: [string, unknown][] = [[SCHEMA_VERSION_KEY, CURRENT_SCHEMA]];

  if (legacyBaseline?.splitYPercentages?.length === 4) {
    entries.push([
      'shelf:0:baseline',
      {
        ...legacyBaseline,
        imageBlob: await dataUrlToBlob(legacyBaseline.imageDataUrl),
      },
    ]);
  }
  if (Array.isArray(legacyHistory)) {
    entries.push([
      'shelf:0:history',
      await Promise.all(legacyHistory.map migrateAuditToPersisted),
    ]);
  }

  try {
    await setMany(entries);
    await delMany([LEGACY_BASELINE, LEGACY_HISTORY]);
    return { ok: true };
  } catch (err) {
    if (isQuotaError(err)) return { ok: false, error: 'QUOTA_EXCEEDED' };
    throw err;
  }
}
```

### Pattern 3: Display URL Registry with Revocation on Shelf Switch

**What:** Storage layer (or `useShelfDisplayUrls` hook) converts Blobs to object URLs for the view-layer `ShelfCalibration.imageDataUrl` and `AuditRecord.thumbnailUrl` fields. Revoke previous URLs when `activeShelfId` changes or component unmounts.

**When to use:** Every shelf load/switch (D-07).

**Example:**

```typescript
// Source: MDN URL.revokeObjectURL + React effect cleanup pattern
export function createDisplayUrlRegistry() {
  const urls = new Map<string, string>();

  function set(key: string, blob: Blob): string {
    revoke(key);
    const url = URL.createObjectURL(blob);
    urls.set(key, url);
    return url;
  }

  function revoke(key: string) {
    const prev = urls.get(key);
    if (prev) {
      URL.revokeObjectURL(prev);
      urls.delete(key);
    }
  }

  function revokeAll() {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  }

  return { set, revoke, revokeAll };
}

// In App.tsx shelf switch handler:
// registry.revokeAll(); load new shelf; registry.set('baseline', blob) → imageDataUrl
```

### Pattern 4: Thumbnail Compression Before Persist

**What:** Canvas downscale to max width 320px, export as JPEG quality 0.75 Blob before append to history.

**When to use:** `appendAuditRecord` / `handleCompleteAudit` path (D-12).

**Example:**

```typescript
// Source: Phase 2 CONTEXT D-12; Canvas API [ASSUMED] browser support
export async function compressToJpegBlob(
  source: Blob | string,
  maxWidth = 320,
  quality = 0.75,
): Promise<Blob> {
  const bitmap = source instanceof Blob
    ? await createImageBitmap(source)
    : await loadBitmapFromDataUrl(source);

  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      quality,
    );
  });
}
```

### Pattern 5: FIFO History Cap

**What:** Prepend new record, slice to 20 — replaces current global 50 cap [VERIFIED: src/lib/storage.ts:65].

```typescript
const HISTORY_CAP = 20;

export async function appendAuditRecord(
  shelfId: number,
  record: PersistedAuditRecord,
): Promise<StorageWriteResult> {
  const existing = await loadAuditHistoryRaw(shelfId);
  const updated = [record, ...existing].slice(0, HISTORY_CAP);
  return saveHistory(shelfId, updated);
}
```

### Anti-Patterns to Avoid

- **Dual-read legacy keys in steady state:** Violates D-03; migration must be one-time gated by `shelfguard_schema_version`.
- **Passing Blob through React props to views:** Violates D-07; resolve to object URL at App/hook boundary.
- **Silent catch on quota errors:** Current `saveBaseline` only `console.error`s [VERIFIED: src/lib/storage.ts:37-38]; Phase 2 must return structured errors (D-19).
- **Storing base64 in IndexedDB after migration:** Violates D-06; convert at migration boundary only.
- **Using separate idb DB per shelf:** idb-keyval `createStore` cannot share one DB with multiple stores [CITED: idb-keyval custom-stores.md]; use key prefixes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB promise wrapper | Raw IDB boilerplate | idb-keyval `get`/`set`/`setMany` | Already in project; battle-tested atomic batch writes |
| Blob serialization codec | Custom ArrayBuffer encoder | Native structured clone via idb-keyval | README confirms Blob support; custom codec adds bugs |
| Full ORM / Dexie schema | Multi-table IndexedDB layer | Flat prefixed keys + migration function | v1 scope is 5 shelves × 2 keys + globals; Dexie is Phase 2+ if query needs grow |
| Object URL lifecycle hook | Ad-hoc create without revoke | Registry + `useEffect` cleanup | Memory leaks on 5 shelves × history thumbnails |
| Quota detection | String matching error messages | `err instanceof DOMException && err.name === 'QuotaExceededError'` | Standard DOMException name [CITED: developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria] |
| Thumbnail resize library | npm image processing dep | Canvas 2D `drawImage` + `toBlob` | Zero deps; sufficient for 320px thumbs |

**Key insight:** idb-keyval is intentionally minimal — namespaced flat keys + `setMany` cover Phase 2 without migrating to the heavier `idb` package. Complexity belongs in `shelfStorage.ts` (migration, type mapping, quota results), not in a new persistence library.

## Common Pitfalls

### Pitfall 1: QuotaExceededError Not Surfacing on Promise Reject

**What goes wrong:** Write appears to succeed in UI but data is not persisted; `saveBaseline` currently swallows errors [VERIFIED: src/lib/storage.ts:34-39].

**Why it happens:** idb-keyval rejects the `set()` promise on quota failure; App never checks return value.

**How to avoid:** Return `{ ok: false, error: 'QUOTA_EXCEEDED' }`; App sets `quotaError` state passed to CameraView banner (parallel to `cameraError` at [VERIFIED: src/components/CameraView.tsx:341-351]).

**Warning signs:** History count stops increasing; `console.error` only.

### Pitfall 2: Object URL Leaks on Shelf Switch

**What goes wrong:** Memory climbs after switching shelves repeatedly; detached blob URLs remain referenced.

**Why it happens:** `URL.createObjectURL` without paired `revokeObjectURL` on shelf change [CITED: developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static].

**How to avoid:** Central registry; `revokeAll()` before loading new shelf; cleanup on App unmount.

**Warning signs:** Safari Web Inspector memory growth after 10+ shelf switches.

### Pitfall 3: Migration Partial Write

**What goes wrong:** Legacy keys deleted but shelf 0 data incomplete — user loses baseline.

**Why it happens:** Non-atomic sequence: write shelf 0, delete legacy, crash mid-flight.

**How to avoid:** Use `setMany` for all new keys + schema version before `delMany` legacy keys [CITED: Context7 idb-keyval setMany atomic semantics]. Do not delete legacy until `setMany` resolves.

**Warning signs:** `shelfguard_schema_version` is 2 but shelf 0 empty and legacy keys gone.

### Pitfall 4: Shelf Index Off-by-One (DATA-03 vs D-01)

**What goes wrong:** Legacy data lands on shelf index 1 instead of 0; user-facing "Shelf 1" shows empty data.

**Why it happens:** ROADMAP success criteria text says "shelf-1" [VERIFIED: .planning/ROADMAP.md:70] while CONTEXT locks index 0 (D-01).

**How to avoid:** Migrate to `shelf:0:*`; QA selector label "1" maps to index 0.

**Warning signs:** Integration test passes on index 1 but user sees wrong shelf.

### Pitfall 5: O(n) Full History Rewrite

**What goes wrong:** Every audit reads/writes entire history array — acceptable at 20 records but scales poorly.

**Why it happens:** Same pattern as current `saveAuditRecord` [VERIFIED: src/lib/storage.ts:62-69].

**How to avoid:** Accept for Phase 2 (20 cap × 5 shelves = 100 records max); document per-record keys as future optimization if cap rises.

**Warning signs:** Noticeable delay on audit complete on low-end Android — monitor in Phase 4+.

### Pitfall 6: jsdom IndexedDB Incomplete for Storage Tests

**What goes wrong:** Storage unit tests pass in mock but fail in real browser; or jsdom lacks IndexedDB.

**Why it happens:** Vitest uses jsdom [VERIFIED: vitest.config.ts:6]; native IndexedDB support is limited.

**How to avoid:** Install `fake-indexeddb` and import in `vitest.setup.ts` before storage tests [ASSUMED].

**Warning signs:** `indexedDB is not defined` in test runs.

## Code Examples

### dataUrl → Blob (Migration + Upload Path)

```typescript
// Source: standard fetch pattern for data URLs
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
```

### Quota Error Detection

```typescript
// Source: MDN Storage quotas + DOMException
export function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'QuotaExceededError';
}

export type StorageWriteResult =
  | { ok: true }
  | { ok: false; error: 'QUOTA_EXCEEDED' };
```

### Map Persisted → View Shape for Components

```typescript
// Source: Phase 2 CONTEXT D-07
export function toViewBaseline(
  persisted: PersistedBaseline,
  displayUrl: string,
): ShelfCalibration {
  return {
    id: persisted.id,
    createdAt: persisted.createdAt,
    imageDataUrl: displayUrl,
    imageDimensions: persisted.imageDimensions,
    splitYPercentages: persisted.splitYPercentages,
    tierLabels: persisted.tierLabels,
  };
}
```

### Vitest Storage Test Setup (fake-indexeddb)

```typescript
// Source: .planning/codebase/TESTING.md pattern + fake-indexeddb [ASSUMED]
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clear, set, get } from 'idb-keyval';
import { runSchemaMigrationIfNeeded, loadBaseline } from './shelfStorage';

beforeEach(async () => {
  await clear();
});

describe('migration', () => {
  it('moves legacy baseline to shelf:0', async () => {
    await set('shelfguard_baseline', {
      id: 'test',
      imageDataUrl: 'data:image/jpeg;base64,...',
      splitYPercentages: [0.2, 0.4, 0.6, 0.8],
      /* ... */
    });
    await runSchemaMigrationIfNeeded();
    const v = await get('shelfguard_schema_version');
    expect(v).toBe(2);
    const baseline = await loadBaseline(0);
    expect(baseline.ok).toBe(true);
  });
});
```

### Shelf Isolation Integration Test Sketch

```typescript
// Source: Phase 1 App.processing.integration.test.tsx mock pattern
vi.mock('./lib/shelfStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/shelfStorage')>();
  return { ...actual /* or use fake-indexeddb without mock */ };
});

it('shelf B baseline does not appear when active shelf is A', async () => {
  // seed shelf 0 and shelf 1 with distinct baseline ids
  // render App, switch selector to shelf 2 (index 1)
  // expect baseline.id !== shelf0Id
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single keys `shelfguard_baseline` / `shelfguard_audit_history` | Prefixed `shelf:{0-4}:*` + schema version | Phase 2 | Enables 5-shelf isolation |
| base64 data URLs in IndexedDB | JPEG Blob structured clone | Phase 2 (D-05/D-08) | ~33% size reduction vs base64; lower parse cost |
| Global 50-record history cap | Per-shelf 20-record FIFO | Phase 2 (D-11) | Bounds 5× storage growth |
| Silent storage errors | `{ ok, error }` + UI banner | Phase 2 (D-18–D-21) | User-visible quota failures |
| No active shelf persistence | `shelfguard_active_shelf` | Phase 2 (SHLF-04) | Restore last shelf on reopen |

**Deprecated/outdated:**
- Flat `loadBaseline()` / `loadAuditHistory()` without shelfId — replace with shelf-scoped API; keep thin wrappers only during transition if needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Embedded Blob in composite idb-keyval value performs adequately for 1080p baseline JPEGs | Pattern 1 | May need separate blob key split if write latency unacceptable |
| A2 | `fake-indexeddb@6.2.5` behaves sufficiently like browser IndexedDB for migration tests | Validation Architecture | Tests pass but real Safari fails — add manual QA on device |
| A3 | Canvas `toBlob('image/jpeg', 0.75)` at 320px produces thumbnails ~15–40KB each | Pattern 4 | Quota still exceeded on low-storage devices — may need lower quality |
| A4 | `fetch(dataUrl)` for dataURL→Blob works in all target PWA browsers | Code Examples | Safari edge cases — fallback to manual base64 decode |
| A5 | jsdom + fake-indexeddb sufficient without `@vitest/browser` for Phase 2 storage tests | Validation Architecture | Blob clone semantics differ — spot-check in Chromium manual test |

## Open Questions

1. **Separate blob keys vs embedded Blob**
   - What we know: Both work with idb-keyval structured clone [CITED: idb-keyval README].
   - What's unclear: Whether ROI-only saves (no new image) happen frequently enough to justify split keys in Phase 2.
   - Recommendation: Start with embedded Blob (simpler migration); split only if profiling shows redundant blob rewrites.

2. **View type evolution**
   - What we know: Components consume `imageDataUrl` / `thumbnailUrl` strings today [VERIFIED: src/types.ts:14,48].
   - What's unclear: Whether to rename view fields to `imageUrl` for clarity.
   - Recommendation: Keep `imageDataUrl` / `thumbnailUrl` as display URL strings in view types; persisted types use `*Blob` suffix at storage boundary only.

3. **ROADMAP "shelf-1" wording vs index 0**
   - What we know: CONTEXT D-01 locks index 0; ROADMAP criterion #3 says "shelf-1".
   - Recommendation: Treat ROADMAP as user-facing Shelf 1 = index 0; update verification wording in plan, not migration target.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, build | ✓ | v23.10.0 | — |
| npm | Package management | ✓ | 11.4.2 | bun (lockfile present) |
| idb-keyval | All shelf persistence | ✓ (installed) | 6.3.0 | — |
| IndexedDB (browser) | Production runtime | ✓ (target PWA) | — | None — core requirement |
| Canvas API | Thumbnail compression, dataURL→Blob | ✓ (browser) | — | Migration-only path fails without Canvas |
| fake-indexeddb | Storage unit tests | ✗ | — | Install as devDep; or mock idb-keyval (weaker) |
| navigator.storage.estimate | Optional quota pre-check | ✓ (modern browsers) | — | Skip pre-check; rely on write-time QuotaExceededError |

**Missing dependencies with no fallback:**
- None blocking implementation (fake-indexeddb strongly recommended for D-16 test quality).

**Missing dependencies with fallback:**
- `fake-indexeddb` — can mock `idb-keyval` like Phase 1 integration tests [VERIFIED: src/App.processing.integration.test.tsx:56-66], but isolation tests need real store semantics; install fake-indexeddb.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 5.0.1 [VERIFIED: package.json:38-39] |
| Config file | vitest.config.ts [VERIFIED: vitest.config.ts:1-15] |
| Quick run command | `npm test` |
| Full suite command | `npm test` (same — no split config yet) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Keys isolated per shelf 0–4 | unit | `npm test -- src/lib/shelfStorage.test.ts -x` | ❌ Wave 0 |
| DATA-02 | Baseline stored as Blob not dataURL string | unit | `npm test -- src/lib/shelfStorage.test.ts -x` | ❌ Wave 0 |
| DATA-03 | Legacy keys migrate to shelf:0, schema_version=2 | unit | `npm test -- src/lib/shelfStorage.test.ts -x` | ❌ Wave 0 |
| DATA-04 | QuotaExceeded returns error surfaced in UI | unit + component | `npm test -- src/lib/shelfStorage.test.ts src/components/CameraView.quota.test.tsx -x` | ❌ Wave 0 |
| DATA-05 | History capped at 20 with compressed thumb | unit | `npm test -- src/lib/blobUtils.test.ts src/lib/shelfStorage.test.ts -x` | ❌ Wave 0 |
| SHLF-02 | Switching shelf loads different baseline | integration | `npm test -- src/App.shelfIsolation.integration.test.tsx -x` | ❌ Wave 0 |
| SHLF-03 | Shelf A history not visible on shelf B | integration | `npm test -- src/App.shelfIsolation.integration.test.tsx -x` | ❌ Wave 0 |
| SHLF-04 | activeShelfId persists across reload | unit | `npm test -- src/lib/shelfStorage.test.ts -x` | ❌ Wave 0 |
| TECH-04 | idb-keyval used for shelf data | unit | covered by shelfStorage tests | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- <affected-test-file> -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `fake-indexeddb` devDependency + `vitest.setup.ts` import
- [ ] `src/lib/blobUtils.ts` — dataUrlToBlob, compressToJpegBlob, isQuotaError
- [ ] `src/lib/shelfStorage.ts` — migration, shelf CRUD, typed results
- [ ] `src/types/persisted.ts` — PersistedBaseline, PersistedAuditRecord
- [ ] `src/lib/shelfStorage.test.ts` — migration, cap, quota, active shelf
- [ ] `src/lib/blobUtils.test.ts` — compression dimensions/quality smoke
- [ ] `src/App.shelfIsolation.integration.test.tsx` — mandatory D-16 isolation proof
- [ ] `src/components/CameraView.quota.test.tsx` — quota banner renders (DATA-04)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — local PWA, no accounts |
| V3 Session Management | no | N/A |
| V4 Access Control | no | Single-user device storage |
| V5 Input Validation | yes | Validate `shelfId` ∈ 0–4; reject non-image uploads; optional max blob size before write |
| V6 Cryptography | no | No encryption requirement for local shelf photos in v1 |

### Known Threat Patterns for Client IndexedDB PWA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unbounded file upload to IndexedDB | Denial of Service (quota) | Compress/resize before persist; cap history; QuotaExceeded UI (D-18–D-21) |
| Malformed legacy data on migration | Tampering | Validate `splitYPercentages.length === 4` before migrate [VERIFIED: src/lib/storage.ts:21]; fallback to DEFAULT_CALIBRATION |
| Sensitive shelf imagery on shared device | Information Disclosure | Document local-only storage (existing CONCERNS.md); no network sync in Phase 2 |
| XSS → read local IndexedDB | Information Disclosure | React JSX default escaping; no `dangerouslySetInnerHTML` in storage path |

## Sources

### Primary (HIGH confidence)

- Context7 `/jakearchibald/idb-keyval` — set/setMany atomic writes, Blob structured-clone support, migration between stores pattern
- [idb-keyval README](https://github.com/jakearchibald/idb-keyval/blob/main/README.md) — structured-clonable values include Blob
- [idb-keyval custom-stores.md](https://github.com/jakearchibald/idb-keyval/blob/main/custom-stores.md) — key prefix vs multi-store limitation

### Secondary (MEDIUM confidence)

- [MDN Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — QuotaExceededError on write
- [MDN URL.revokeObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static) — object URL lifecycle

### Tertiary (LOW confidence)

- WebSearch — QuotaExceededError may surface on transaction abort; React object URL cleanup patterns (validate in implementation)

### Codebase (verified this session)

- `src/lib/storage.ts` — legacy keys, 50-record cap, error handling pattern
- `src/types.ts` — ShelfCalibration, AuditRecord view shapes
- `src/App.tsx` — hydration, save handlers
- `src/components/CameraView.tsx` — inline error banner pattern
- `vitest.config.ts`, `package.json` — test infrastructure from Phase 1
- `.planning/phases/02-multi-shelf-data-layer/02-CONTEXT.md` — locked decisions

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — idb-keyval verified in registry + official docs; no new production deps
- Architecture: **HIGH** — aligns with locked CONTEXT decisions and existing App/storage patterns
- Pitfalls: **MEDIUM** — quota and Safari PWA behavior varies by device; mitigations documented

**Research date:** 2026-09-21
**Valid until:** 2026-10-21 (stable API surface; idb-keyval 6.x)
