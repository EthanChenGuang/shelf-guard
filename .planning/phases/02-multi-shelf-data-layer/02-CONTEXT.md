# Phase 2: Multi-Shelf Data Layer - Context

**Gathered:** 2026-09-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver **five isolated shelf datasets** in IndexedDB — per-shelf baseline, per-shelf inspection history, active-shelf persistence, legacy single-key migration, Blob-based image storage, quota UX, and bounded history — so Phase 3+ can read/write shelf-scoped data without cross-contamination.

**In scope:** Namespaced IndexedDB keys (`shelf:0`–`shelf:4`), Blob storage for baseline images, one-time migration from `shelfguard_baseline` / `shelfguard_audit_history`, `activeShelfId` persistence (SHLF-04), per-shelf history cap with compressed thumbnails (DATA-05), QuotaExceededError UI (DATA-04), minimal in-app shelf switcher for QA (not PRD swipe carousel).

**Out of scope:** PRD swipe carousel and active-shelf indicator polish (Phase 5 / SHLF-01), INITIAL_GUIDE onboarding (Phase 5 / SHLF-05), real vision diff (Phase 4), OpenCV.js, per-shelf tolerance/language settings (remain global), export/delete-audit management UI beyond error guidance copy.
</domain>

<decisions>
## Implementation Decisions

### Legacy Migration (DATA-03)
- **D-01:** Migrate legacy single-key data to **shelf index 0** — user-facing "Shelf 1" maps to `shelf:0:*`. DATA-03 wording "shelf-1" means first shelf, not index 1.
- **D-02:** Migrate **both** legacy baseline and audit history to shelf 0 in a single atomic migration pass — preserves the user's existing workflow as one calibrated unit.
- **D-03:** After successful migration, **delete** legacy keys (`shelfguard_baseline`, `shelfguard_audit_history`) — no dual-read of old keys in steady state.
- **D-04:** Write global marker `shelfguard_schema_version: 2` after migration completes; skip re-migration on subsequent launches. — **Reversibility:** one-way — downgrading schema version without a reverse migration would corrupt or duplicate data.

### Blob Storage & Type Cutover (DATA-02)
- **D-05:** Persist baseline images as **JPEG Blob** in IndexedDB, not base64 data URLs — satisfies DATA-02 quota pressure from CONCERNS.md.
- **D-06:** During v1→v2 migration, **convert existing data URL strings to Blobs** in the same pass as shelf namespacing — no indefinite dual-format steady state.
- **D-07:** **Break the persisted shape** at the storage boundary: shelf baseline record stores `imageBlob` + metadata (`splitYPercentages`, `imageDimensions`, etc.). Components receive a **resolved object URL** via a storage helper (e.g., `getBaselineDisplayUrl(shelfId)`) — do not pass raw Blobs into view props. Revoke object URLs on shelf switch/unmount to avoid leaks.
- **D-08:** Audit record thumbnails also stored as **Blob** (compressed JPEG), not data URLs — consistent quota strategy across baseline and history.

### Key Namespace Layout (DATA-01)
- **D-09:** Use flat namespaced keys per shelf:
  - `shelf:{0-4}:baseline` — serialized baseline metadata + Blob reference (via idb-keyval custom serializer or separate blob key `shelf:{0-4}:baseline:blob`)
  - `shelf:{0-4}:history` — `AuditRecord[]` capped at 20
  - `shelfguard_active_shelf` — integer 0–4, default `0`
  - `shelfguard_schema_version` — integer, current `2`
  - Global unchanged: `shelfguard_lang`, `shelfguard_tolerance`
- **D-10:** Shelves 1–4 (indices 1–3 and empty index 4) start **empty** after migration — `DEFAULT_CALIBRATION` equivalent with no persisted baseline until user calibrates in Phase 4/5.

### History Cap & Thumbnails (DATA-05)
- **D-11:** Cap per-shelf history at **20 records** (down from current global 50) — FIFO eviction: on insert, drop oldest when length > 20.
- **D-12:** Generate audit thumbnails at **320px max width**, **JPEG quality 0.75** — balance visibility vs quota.
- **D-13:** Eviction policy: **oldest-first (FIFO)** on new audit insert — simplest, matches "recent inspections matter most" field use.

### App Wiring Depth (Phase 2 vs Phase 5)
- **D-14:** Wire **`activeShelfId`** into `App.tsx` state; all baseline/history load/save calls go through shelf-scoped storage API — required for SHLF-02, SHLF-03, SHLF-04.
- **D-15:** Add a **minimal temporary shelf selector** (simple segmented control or dropdown, 5 labels "1–5") — **not** the PRD swipe carousel. Purpose: manual QA and success-criteria verification only; Phase 5 replaces with polished carousel (SHLF-01). Style: functional, can use existing Tailwind tokens but no PRD animation investment.
- **D-16:** Add **integration tests** proving shelf A baseline/history does not leak when `activeShelfId` switches to shelf B — tests are mandatory; UI switcher supplements manual QA.
- **D-17:** Begin **light storage extraction** from monolithic `App.tsx` — introduce `src/lib/shelfStorage.ts` (or refactor `storage.ts`) with shelf-aware API; full `useAuditFlow` hook decomposition remains optional/discretionary unless planner sees clear win. — **Reversibility:** costly — storage API becomes contract for Phases 3–5.

### Quota-Exceeded UX (DATA-04)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — TECH-04, DATA-01 through DATA-05, SHLF-02, SHLF-03, SHLF-04
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria (isolation, migration, quota, history bounds)
- `.planning/PROJECT.md` — 5-shelf independent data model decision, IndexedDB + idb-keyval constraint

### Prior Phase Context
- `.planning/phases/01-next-js-migration-capture-foundation/01-CONTEXT.md` — Vite retention (D-01), minimal FSM patch defer hook extraction to Phase 2+ (D-14), camera error banner pattern (D-07)

### Codebase Maps
- `.planning/codebase/STACK.md` — idb-keyval, current flat key layout
- `.planning/codebase/ARCHITECTURE.md` — App.tsx FSM, storage hydration on mount, AuditRecord/ShelfCalibration types
- `.planning/codebase/CONCERNS.md` — IndexedDB bloat from data URLs, 50-record cap, quota risks

### Implementation Targets
- `src/lib/storage.ts` — current flat-key API to refactor or wrap
- `src/types.ts` — `ShelfCalibration`, `AuditRecord` shapes
- `src/App.tsx` — hydration, baseline/history handlers, future `activeShelfId`
- `src/lib/constants.ts` — I18N strings for quota banner
- `src/components/CameraView.tsx` — inline banner surface (reuse error banner slot or adjacent)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/storage.ts`** — All persistence functions; refactor in place or split into `shelfStorage.ts` with shelf-scoped wrappers.
- **`src/types.ts`** — `ShelfCalibration` and `AuditRecord` — extend or add parallel persisted types with Blob fields.
- **`src/App.tsx`** — Mount-time parallel load (`loadBaseline`, `loadAuditHistory`) becomes shelf-aware keyed by `activeShelfId`.
- **`src/components/CameraView.tsx`** — Already receives props from App; can host quota banner alongside camera error banner.
- **`src/lib/imageDimensions.ts`** — Reuse for baseline dimension extraction after Blob→Image decode.

### Established Patterns
- **idb-keyval flat keys** — Phase 2 introduces namespaced keys; migration runs once on app init before hydration.
- **Try/catch + console warn at storage boundary** — extend with structured `{ ok, error }` returns for quota cases App must surface.
- **I18N via `I18N[lang]`** — extend for quota messages; no parallel string tables.
- **Phase 1 banner pattern** — inline banner on CameraView for errors; quota follows same UX contract.

### Integration Points
- **App init `useEffect`** — run migration check → set schema version → load active shelf → load shelf-scoped baseline/history.
- **Shutter/audit completion handlers** — `saveAuditRecord` becomes shelf-scoped; thumbnail compression runs before persist.
- **ROI save / baseline upload** — `saveBaseline` becomes shelf-scoped with Blob write.
- **Phase 5 carousel** — will call the same shelf-scoped storage API; Phase 2 selector is throwaway UI only.

</code_context>

<specifics>
## Specific Ideas

- User confirmed shelf index **0** for legacy migration; all remaining questions answered with **recommended defaults** (auto-accept).
- "Shelf-1" in DATA-03 interpreted as user-facing first shelf = index 0, not literal index 1.
- Temporary shelf selector is a **QA bridge** — explicitly not PRD swipe carousel investment.

</specifics>

<deferred>
## Deferred Ideas

- **PRD swipe carousel + active-shelf indicator** — Phase 5 (SHLF-01).
- **INITIAL_GUIDE when shelf has no baseline** — Phase 5 (SHLF-05); Phase 2 empty shelves use existing default calibration behavior.
- **Delete-audit / free-storage management UI** — quota banner mentions clearing history; actionable UI deferred.
- **Per-shelf tolerance or language** — not in requirements; keep global.
- **Full `useAuditFlow` hook extraction** — optional in Phase 2; mandatory only if App.tsx becomes unmanageable during shelf wiring.

</deferred>

---

*Phase: 2-Multi-Shelf Data Layer*
*Context gathered: 2026-09-21*
