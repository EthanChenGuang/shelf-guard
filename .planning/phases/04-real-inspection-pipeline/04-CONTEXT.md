# Phase 4: Real Inspection Pipeline - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver **real client-side shelf inspection** — replace mock `analyzeShelfCapture()` with OpenCV.js pixel diff per 4-tier ROI, Web Worker execution, first-baseline calibration flow, and interactive result review — so users see genuine red (missing) and yellow (displaced) boxes from captured vs baseline comparison.

**In scope:** TECH-06 (OpenCV in Web Worker), VIS-01–VIS-04 (ROI-scoped diff, MISSING/MOVED classification, tolerance re-run, non-blocking worker), ROI-01–ROI-05 (baseline image background, 4 draggable dividers, magnifier, save/recalibrate actions), RSLT-01–RSLT-06 (overlay boxes, blink compare, tap-to-dismiss, stat capsule, tolerance slider, complete-inspection return).

**Out of scope:** PRD INITIAL_GUIDE onboarding (SHLF-05 — Phase 5), homography auto-align (VIS-07 — v2), PRD scan-line/shutter/top-bar polish (CAM-04/05/06 — Phase 5), swipe carousel (SHLF-01 — Phase 5), export/report PDF (v2), pixelmatch/Canvas-only diff (excluded by D-13).
</domain>

<decisions>
## Implementation Decisions

### First-Baseline Capture Flow (ROI-01, success criterion #1)
- **D-01:** When `hasPersistedBaseline === false`, **first shutter intercepts the normal inspect path** — capture frame, set it as pending baseline image, route directly to `ROI_CONFIG`. **No** `SCANNING_ANIM`, **no** diff, **no** `RESULT_INSPECT` until baseline is saved. — **Reversibility:** costly — FSM branch in `handleShutterClick` becomes contract for empty-shelf UX.
- **D-02:** `RoiSetupView` background image is the **just-captured frame** (pending baseline), not `DEFAULT_CALIBRATION` CDN or demo shelf. Pass `pendingBaselineImageUrl` from App when entering ROI setup from first capture.
- **D-03:** On ROI save ("确认并保存基准"), persist **captured frame as JPEG Blob** + `splitYPercentages` + `imageDimensions` to active shelf via `saveBaseline()`, set `hasPersistedBaseline = true`, return to `CAMERA_IDLE`. This satisfies per-shelf baseline creation without INITIAL_GUIDE.
- **D-04:** When `hasPersistedBaseline === true`, shutter follows existing flow: `SCANNING_ANIM` → worker diff → `RESULT_INSPECT` (with `PROCESSING` fallback if diff exceeds 800ms per STAB-03).
- **D-05:** Manual ROI re-entry (existing `onOpenRoiConfig` / upload-baseline paths) continues to work on persisted baselines — recalibrate dividers only; image source is current baseline unless user uploaded new photo.

### Missing vs Displaced Classification (VIS-02)
- **D-06:** **Per-tier pipeline** — for each of 4 ROI bands (defined by `splitYPercentages`), crop baseline and capture to same pixel dimensions, convert to grayscale, Gaussian blur (5×5), `absdiff`, binary threshold, morphological close (3×3), `findContours`. Run independently per tier; assign `rowIndex` from tier index.
- **D-07:** **MISSING (red):** diff contour whose region in the **capture** band has mean intensity significantly lower than baseline band (product void / empty slot). Heuristic: contour bounding box in capture ROI where `mean(capture) < mean(baseline) - voidThreshold` and contour area ≥ `minContourArea`. Label `type: 'MISSING'`.
- **D-08:** **MOVED (yellow):** diff contour where **both** baseline and capture bands show foreground content (edge density or local variance above floor), but **centroid displacement** between matched baseline and capture blob centroids exceeds `displacementThresholdPx` (scaled to image width). Use nearest-neighbor blob matching within tier. Label `type: 'MOVED'`.
- **D-09:** **De-duplication:** if a region qualifies as both, prefer **MISSING** when capture void score is dominant; otherwise **MOVED**. Cap anomalies per tier (e.g., 8) sorted by contour area descending to avoid box spam.
- **D-10:** Output **normalized bounding boxes** (0.0–1.0) in full-frame coordinates — reuse existing `DetectedAnomaly.boundingBox` contract. Generate stable `id` from tier + bbox hash. Drop mock `INITIAL_MOCK_ANOMALIES` entirely from production path.

### Tolerance Slider Semantics (VIS-03, RSLT-05)
- **D-11:** Replace discrete `'strict' | 'normal' | 'loose'` UI with a **continuous horizontal slider 0–100** (PRD RSLT-05). Internal storage migrates from enum to integer `toleranceValue: number` in IndexedDB key `shelfguard_tolerance`. Migration map: `strict → 25`, `normal → 50`, `loose → 75`. — **Reversibility:** costly — type change in `AuditRecord.tolerance`, storage, and UI.
- **D-12:** Slider maps to **two diff parameters** re-run on every change (debounced ~150ms, full worker pipeline — not client-side filter):
  - `diffThreshold = round(lerp(60, 15, toleranceValue / 100))` — lower slider = stricter (lower threshold catches smaller diffs)
  - `minContourArea = round(lerp(200, 1200, toleranceValue / 100))` — lower slider = flags smaller blobs
  - `displacementThresholdPx = round(lerp(8, 35, toleranceValue / 100))` — lower slider = smaller shifts flagged as MOVED
- **D-13:** Tolerance change **re-invokes worker diff** on current `capturedFrame` + active shelf baseline — same code path as initial capture analysis. Update stat capsule counts from fresh result.
- **D-14:** Show preset tick labels at 25/50/75 on slider for strict/normal/loose mental model; no discrete-only mode.

### Viewpoint Drift Without Homography (VIS-01, STATE.md concern)
- **D-15:** **No homography** in Phase 4 — defer to v2 VIS-07. Rely on ghost overlay + level gauge (Phase 3) for operator alignment.
- **D-16:** **Per-tier crop-only normalization** before diff: both images cropped to identical tier band rectangles at baseline resolution; optional **2% horizontal edge inset** per tier to reduce frame-edge false positives from slight pan.
- **D-17:** **Accept residual false positives** from 2–5° viewpoint drift as known v1 limitation. Primary mitigation: **tap-to-dismiss** (RSLT-03) + blink compare for human verification. Document in planner golden-test requirements.
- **D-18:** Do **not** block ship on perfect alignment — success criteria met when real diff runs and boxes respond to actual shelf changes on aligned test captures; drift cases handled via dismiss UX.

### Web Worker & OpenCV Architecture (TECH-06, VIS-04)
- **D-19:** Install `@techstark/opencv-js`; load WASM **inside dedicated worker** `src/workers/visionWorker.ts` — never on main thread. Main thread only decodes images to `ImageBitmap` and posts to worker. — **Reversibility:** one-way — worker message protocol becomes vision API contract.
- **D-20:** Worker message protocol: `{ type: 'analyze', captureBitmap, baselineBitmap, splitYPercentages, toleranceValue }` → `{ anomalies, complianceRate, standardCount, actualCount, missingCount, displacedCount }`. Use **Transferable** `ImageBitmap` where supported.
- **D-21:** OpenCV init once per worker lifetime; expose `analyzeShelfCapture()` as thin main-thread wrapper posting to worker with timeout fallback error state.
- **D-22:** Diff runs **in parallel** with 800ms scan animation — existing `PROCESSING` transition when worker exceeds 800ms (STAB-03). Worker must not block React render or scan overlay.

### Result Interaction (RSLT-01–RSLT-06)
- **D-23:** **Tap-to-dismiss** sets `dismissed: true` on anomaly in session state; stat capsule decrements immediately (existing `handleDismissAnomaly` pattern). Dismissals **persist in `AuditRecord.anomalies`** when user completes inspection — not written back to baseline.
- **D-24:** **Blink compare** (long-press): hide AR boxes, swap capture image for baseline image; release restores capture + boxes — retain existing `ResultInspectView` long-press behavior.
- **D-25:** **Filter by type** (stat capsule tap): highlight/filter MISSING vs MOVED — retain existing `filterType` state in `ResultInspectView`.
- **D-26:** **Complete inspection** saves audit with active anomalies (including dismissed flags), returns to **current shelf** `CAMERA_IDLE` — existing `handleCompleteAudit` shelf-scoped path.

### Testing & Golden Set
- **D-27:** Add **unit tests** for tolerance→parameter mapping and bbox normalization helpers. Add **worker integration test** with mocked OpenCV or fixture images (at least 2 aligned pairs + 1 intentional missing + 1 displaced).
- **D-28:** Planner must include **golden test image pair** (baseline + capture) checked into `public/test-fixtures/` or test assets — validates diff replaces mock on CI without manual device.

### Claude's Discretion
- Exact OpenCV function calls and morph kernel sizes within D-06/D-07/D-08 heuristics.
- Worker bundling approach (Vite `?worker` import vs inline Worker constructor).
- `standardCount` derivation (fixed 24 vs contour-count from baseline) — prefer baseline foreground blob count per tier if feasible.
- I18N keys for slider labels and first-baseline ROI prompt copy.
- Whether `RoiSetupView` "重拍" on first-baseline flow returns to camera discarding pending capture or re-captures in place.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — TECH-06, VIS-01–VIS-04, ROI-01–ROI-05, RSLT-01–RSLT-06 (Phase 4 scope)
- `.planning/ROADMAP.md` — Phase 4 goal and six success criteria (real diff, ROI calibration, tolerance re-run, blink/dismiss, worker non-blocking, complete inspection return)
- `.planning/PROJECT.md` — Core value (30s inspection), OpenCV constraint, pure-client PWA

### Prior Phase Context
- `.planning/phases/01-next-js-migration-capture-foundation/01-CONTEXT.md` — OpenCV-only v1 lock (D-13), PROCESSING mode (D-15), no OpenCV install in Phase 1
- `.planning/phases/02-multi-shelf-data-layer/02-CONTEXT.md` — Per-shelf baseline Blob storage, empty shelves start without persisted baseline (D-10), `saveBaseline`/`loadBaselineRaw` API
- `.planning/phases/03-guided-capture-quality/03-CONTEXT.md` — Ghost overlay only when live + persisted baseline (D-01/D-02), alignment guidance before diff

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — FSM flow, `analyzeShelfCapture` mock location, capture→scan→result path
- `.planning/codebase/CONCERNS.md` — Mock vision debt, ROI drag fragility, tolerance re-analysis on stale capture, viewpoint drift risk
- `.planning/codebase/STACK.md` — Vite worker bundling, no OpenCV yet installed

### Implementation Targets
- `src/lib/vision.ts` — Replace mock with worker wrapper; keep `InspectionAnalysisResult` interface stable
- `src/workers/visionWorker.ts` — New: OpenCV WASM load + per-tier diff (create)
- `src/App.tsx` — First-baseline FSM branch, pending baseline state, tolerance migration
- `src/components/RoiSetupView.tsx` — Accept pending capture as background; first-baseline save flow
- `src/components/ResultInspectView.tsx` — Continuous tolerance slider (replace 3-button UI)
- `src/lib/shelfStorage.ts` — Baseline save from first capture
- `src/types.ts` — `ToleranceLevel` → numeric tolerance migration
- `src/lib/storage.ts` — Tolerance persistence migration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/vision.ts`** — Stable `InspectionAnalysisResult` interface and `analyzeShelfCapture()` signature; swap body for worker dispatch.
- **`src/components/RoiSetupView.tsx`** — 4-tier draggable dividers, magnifier, save/reset/recapture actions — wire first-baseline capture as image source.
- **`src/components/ResultInspectView.tsx`** — Blink compare, tap-to-dismiss animation, filter by type, stat capsule — already implemented; needs real anomaly data + slider UI update.
- **`src/App.tsx`** — Shutter handler with scan timer + PROCESSING fallback; `handleSaveRoiCalibration`, `handleToleranceChange` (re-run analysis), shelf-scoped baseline via `hasPersistedBaseline`.
- **`src/components/ScanningAnimationOverlay.tsx`** — 800ms animation; diff must run concurrently in worker.

### Established Patterns
- **FSM in App.tsx** — New first-baseline branch extends `handleShutterClick`; no hook extraction required in Phase 4.
- **Shelf-scoped persistence** — `saveBaseline(activeShelfId, ...)` / `loadBaselineRaw` from Phase 2.
- **Object URL registry** — Baseline display URLs; worker receives decoded bitmaps, not registry URLs.
- **Integration tests with mocked vision** — Extend to test first-baseline routing and real worker with fixtures.

### Integration Points
- **`handleShutterClick`** — Branch on `hasPersistedBaseline`; pending baseline state before ROI_CONFIG.
- **`handleToleranceChange`** — Debounced worker re-diff with numeric tolerance.
- **`handleCompleteAudit`** — Stores anomalies with dismissed flags to shelf history.
- **Upload baseline path** — Already routes to ROI_CONFIG after save; align first-capture path with same save contract.

</code_context>

<specifics>
## Specific Ideas

- All four gray areas resolved with **recommended defaults** via user auto-accept — no per-area custom overrides.
- Primary technical bet: **per-tier absdiff + contour heuristics** (not homography) with **continuous tolerance slider** driving threshold + min area + displacement params.
- First capture on empty shelf = **calibration session**, not inspection — matches ROADMAP success criterion #1 without Phase 5 INITIAL_GUIDE.

</specifics>

<deferred>
## Deferred Ideas

- **Homography / advanced alignment (VIS-07)** — v2; ghost overlay + dismiss UX sufficient for v1.
- **INITIAL_GUIDE first-run wizard (SHLF-05)** — Phase 5; Phase 4 uses direct ROI_CONFIG routing on first shutter.
- **PRD scan-line / breathing shutter / top bar polish** — Phase 5 (CAM-04/05/06).
- **Export/report generation** — v2; share button remains toast-only.
- **pixelmatch / Canvas-only diff** — excluded by Phase 1 D-13.

</deferred>

---

*Phase: 4-Real Inspection Pipeline*
*Context gathered: 2026-09-23*
