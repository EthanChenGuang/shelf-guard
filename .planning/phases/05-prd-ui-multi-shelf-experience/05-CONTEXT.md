# Phase 5: PRD UI & Multi-Shelf Experience - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver **100% PRD-fidelity UI/UX** across all three views — Minimalist Light design tokens, 5-shelf swipe carousel with active indicator, INITIAL_GUIDE onboarding for empty shelves, PRD camera chrome (top bar, breathing shutter, scan transition), and complete bilingual copy — so field reps experience the polished product vision on real inspection data from Phase 4.

**In scope:** DSGN-01–DSGN-04 (Minimalist Light tokens, state colors, glassmorphism controls, Stitch-aligned visual verification), SHLF-01 (horizontal swipe between 5 shelves + active indicator), SHLF-05 (INITIAL_GUIDE per shelf without silent demo baseline), CAM-04 (PRD top bar: baseline pill, level badge, torch + language), CAM-05 (76px breathing shutter + last-inspection thumbnail), CAM-06 (0.8s scan-line transition polish), I18N-01–I18N-02 (full three-view copy + persisted language).

**Out of scope:** Real vision diff / OpenCV worker (Phase 4), homography alignment (v2 VIS-07), new backend or Stitch code generation pipeline automation, per-shelf tolerance/language settings, delete-audit storage management UI, export/report PDF (v2), Next.js migration (v2+), changing shelf storage schema (Phase 2 contract), ghost opacity IndexedDB persistence (optional v2).
</domain>

<decisions>
## Implementation Decisions

### Shelf Swipe Carousel (SHLF-01)
- **D-01:** Replace top-bar segmented `ShelfSelector` buttons with a **horizontal swipe carousel** on the camera viewport — touch pan left/right (or pointer drag on desktop) switches shelves. Minimum horizontal delta **50px** with dominant horizontal axis; ignore vertical-dominant gestures to avoid conflict with ghost slider. — **Reversibility:** costly — `CameraView` layout and gesture layer become PRD contract.
- **D-02:** Swipe calls existing **`handleShelfChange(newShelfId)`** in `App.tsx` — same `saveActiveShelfId`, `loadShelfData`, and `objectUrlRegistry.revokeAll` path from Phase 2; no new storage API.
- **D-03:** **Active-shelf indicator:** centered **5-dot strip** below the PRD top bar (filled emerald `#10B981` active dot, outline inactive, `aria-current` on active). Optional shelf label chip: `柜架 N` / `Shelf N` from I18N. Remove `ShelfSelector` from top bar entirely.
- **D-04:** Use **`motion`** (already in `package.json`, currently unused) for shelf cross-fade / slide snap on change — spring with ~300ms duration. CSS scroll-snap acceptable as fallback for reduced-motion preference.
- **D-05:** Carousel works in **`CAMERA_IDLE` and `INITIAL_GUIDE`** only — disable swipe during `SCANNING_ANIM`, `PROCESSING`, `ROI_CONFIG`, `RESULT_INSPECT` to prevent mid-capture shelf bleed.
- **D-06:** Each shelf switch reloads ghost overlay and baseline state per Phase 3 rules (`hasPersistedBaseline`, live-only ghost) — extend Phase 3 integration tests for swipe path.

### INITIAL_GUIDE Onboarding (SHLF-05)
- **D-07:** Wire **`INITIAL_GUIDE` AppMode** when active shelf has **`!hasPersistedBaseline`** on: app init landing, shelf switch to empty shelf, or return from audit on empty shelf. Per-shelf, not global first-run only. — **Reversibility:** costly — FSM entry conditions become UX contract with Phase 4 first-capture path.
- **D-08:** **Full-screen overlay** on camera shell (same `CameraView` container, not a new route) with **3 steps:** (1) welcome + shelf name, (2) alignment tips (ghost/level will apply after baseline exists), (3) primary CTA **「拍摄基准图」/ "Capture baseline"** → dismisses guide to `CAMERA_IDLE`.
- **D-09:** **No silent demo baseline** in INITIAL_GUIDE — do not render `DEFAULT_CALIBRATION` CDN image as the shelf feed. Show neutral dark placeholder with iconography + copy, or live camera if already enabled. Empty shelf demo feed must not masquerade as established baseline.
- **D-10:** Shutter on empty shelf after guide dismiss follows **Phase 4 first-baseline contract** — intercept to `ROI_CONFIG` with pending capture (no scan animation until baseline saved). INITIAL_GUIDE is pre-shutter education only; it does not replace ROI calibration.
- **D-11:** User can **skip guide** via secondary text button (`跳过` / `Skip`) — lands on `CAMERA_IDLE` with same empty-shelf rules. Skip preference **not persisted** (show guide again on next visit to that empty shelf until baseline exists).
- **D-12:** When shelf gains persisted baseline, **never show INITIAL_GUIDE** for that shelf again unless baseline cleared via reset flow.

### Minimalist Light Design System (DSGN-01–DSGN-03)
- **D-13:** Centralize PRD tokens in **`src/index.css` `@theme` block** (Tailwind v4) and/or **`src/lib/designTokens.ts`** exporting named constants — single source for `#FFFFFF`, `#F8FAFC`, `#0F172A`, `#64748B`, `#E2E8F0`, `#10B981`, `#EF4444`, `#F59E0B`. Replace scattered arbitrary hex in touched components. — **Reversibility:** costly — token names become cross-view contract.
- **D-14:** **Glassmorphism control pattern** (DSGN-03) applied uniformly on floating UI: `rounded-2xl` or `rounded-full`, `backdrop-blur-md bg-white/75`, `shadow-sm`–`shadow-md`, `border border-[#E2E8F0]/60`. Audit all three views during implementation waves.
- **D-15:** **View background split:** Camera shell stays **dark** `#0F172A`; ROI setup and Result inspect use **light** `#F8FAFC` / `#FFFFFF` backgrounds per Minimalist Light PRD (align `RoiSetupView`, `ResultInspectView` wrappers).
- **D-16:** **Anomaly overlays (DSGN-02):** Missing = `#EF4444` **2px bold border** + **15% opacity red fill**; Displaced = `#F59E0B` **2px bold border** + **15% yellow fill**. Update `ResultInspectView` box styles; stat capsule dots match same hues.
- **D-17:** Typography: primary `#0F172A`, secondary `#64748B`; borders `#E2E8F0`. Success/ready accents `#10B981` (baseline pill, level snap, active shelf dot).

### Stitch Visual Verification (DSGN-04)
- **D-18:** Planner produces **`05-UI-SPEC.md`** before implementation (via `/gsd-ui-phase 5` or plan-phase UI wave) documenting token table, component inventory, and PRD layout measurements (76px shutter, 80px magnifier, 0.8s scan).
- **D-19:** Store Stitch reference screenshots or export metadata under **`.planning/design/stitch/`** (create if missing) — three views: camera, ROI, result. Implementation acceptance = side-by-side screenshot checklist in phase UAT, not automated pixel diff in CI for v1.
- **D-20:** Use existing brownfield components as base — **polish in place** rather than rewrite-from-scratch unless layout contract cannot be met.

### Camera Top Bar & Controls (CAM-04)
- **D-21:** PRD top bar layout: **Left** = baseline status pill (「基准图 · 已建立」/「未建立」with green pulse dot when established); **Center** = level micro-badge (`0.0°` mint when level, amber tilt otherwise — compact, non-interactive except existing simulate toggle on desktop); **Right** = torch (when supported + live camera) + language toggle (`中`/`EN`). — **Reversibility:** costly — top bar becomes visual signature.
- **D-22:** **Remove from top bar:** segmented shelf selector (→ carousel dots), Demo/Cam toggle (→ relocate), PWA install button (→ bottom-left utility chip or omit if install prompt handled by browser).
- **D-23:** **Demo/Cam toggle** moves to **bottom-left utility** small pill (below carousel dots) — retains CAM-01 demo path for QA without cluttering PRD chrome. Label via I18N (`t.useSampleFeed` / `t.useRealCamera`).
- **D-24:** Baseline pill tap opens existing **`ResetBaselineModal`** / recalibrate flow — no new modal type.

### Shutter, Scan & Thumbnail (CAM-05, CAM-06)
- **D-25:** Shutter button **76px outer ring** with **double-ring** styling; **breathing glow** when ready (`CAMERA_IDLE`, `!isShutterLocked`, camera available) — CSS keyframe scale 0.98–1.02 + outer ring `animate-pulse` opacity. Disable breathing during scan/processing/locked.
- **D-26:** **Last inspection thumbnail** bottom-right: **48×48** `rounded-xl`, border `#E2E8F0`, tap opens history modal — align position relative to 76px shutter (existing bottom bar layout, PRD spacing).
- **D-27:** **Scan line (CAM-06):** Retain `ScanningAnimationOverlay` 0.8s cyan `#38BDF8` beam — polish gradient/glow to match PRD; optional `motion` enhancement only if CSS keyframe insufficient. Do not change 800ms duration (STAB-01/03 contract).
- **D-28:** Shutter flash overlay on tap (brief white fade) — add if missing for PRD capture feedback.

### Internationalization (I18N-01, I18N-02)
- **D-29:** Audit **all user-visible strings** in `CameraView`, `RoiSetupView`, `ResultInspectView`, modals, INITIAL_GUIDE, carousel labels — extend **`I18N` in `src/lib/constants.ts`** with both `cn` and `en` entries. No new hardcoded UI strings in Phase 5 touched files.
- **D-30:** Add INITIAL_GUIDE step copy, baseline pill states (`established` / `not established`), shelf carousel labels, demo toggle, and any new top-bar strings.
- **D-31:** Language toggle persists via existing **`loadSavedLanguage` / `saveLanguage`** (IndexedDB `shelfguard_lang`) — verify new keys render immediately on toggle without reload.

### Testing & Verification
- **D-32:** Component tests: carousel dot active state, INITIAL_GUIDE visibility when `!hasPersistedBaseline`, hidden when baseline exists, swipe disabled during non-idle modes.
- **D-33:** Integration test: swipe shelf B → shelf A isolation (extend Phase 2 pattern); switch to empty shelf → INITIAL_GUIDE shown.
- **D-34:** Manual UAT checklist: three-view Stitch screenshot comparison per DSGN-04.

### Claude's Discretion
- Exact `motion` spring parameters and reduced-motion fallbacks.
- INITIAL_GUIDE step indicator styling (dots vs progress bar).
- Whether to extract `ShelfCarousel.tsx` vs inline in `CameraView.tsx`.
- Demo toggle visibility rules on first launch vs returning user.
- Minor spacing tweaks within PRD measurements ±4px.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — DSGN-01–04, SHLF-01, SHLF-05, CAM-04–06, I18N-01–02 (Phase 5 scope)
- `.planning/ROADMAP.md` — Phase 5 goal and five success criteria (swipe carousel, INITIAL_GUIDE, Minimalist Light, camera PRD chrome, bilingual)
- `.planning/PROJECT.md` — UI-first v1 priority, Stitch + Minimalist Light, 5-shelf swipe vision

### Prior Phase Context
- `.planning/phases/02-multi-shelf-data-layer/02-CONTEXT.md` — Per-shelf storage API, temporary ShelfSelector is QA-only (D-15), carousel replaces it
- `.planning/phases/03-guided-capture-quality/03-CONTEXT.md` — Ghost visibility rules (live + persisted baseline), level gauge behavior, demo-first default
- `.planning/phases/04-real-inspection-pipeline/04-CONTEXT.md` — First-baseline shutter → ROI_CONFIG path; Phase 5 adds INITIAL_GUIDE before that; CAM/DSGN polish deferred here

### Research & Architecture
- `.planning/research/SUMMARY.md` — motion library for swipe/scan; INITIAL_GUIDE per shelf; design-before-swipe sequencing
- `.planning/research/ARCHITECTURE.md` — ShelfCarousel component sketch, INITIAL_GUIDE trigger on `baseline === null`, AppMode wiring table
- `.planning/research/FEATURES.md` — INITIAL_GUIDE conflicts with silent demo baseline; multi-shelf swipe MVP definition
- `.planning/research/STACK.md` — motion 13.4.0 recommendation for PRD animations

### Codebase Maps
- `.planning/codebase/CONVENTIONS.md` — Tailwind token palette, I18N pattern, component naming
- `.planning/codebase/STRUCTURE.md` — Flat components/, where to add ShelfCarousel / design tokens
- `.planning/codebase/CONCERNS.md` — INITIAL_GUIDE never wired; motion dependency unused

### Phase 4 UI Reference (partial — Phase 5 owns full DSGN)
- `.planning/phases/04-real-inspection-pipeline/04-UI-SPEC.md` — Notes Phase 5 owns full Minimalist Light; reuse interaction contracts

### Implementation Targets
- `src/components/CameraView.tsx` — Top bar refactor, carousel gestures, shutter/thumbnail polish
- `src/components/ShelfSelector.tsx` — Deprecate or repurpose as carousel dots only
- `src/components/ShelfCarousel.tsx` — New (recommended): swipe + dot indicator
- `src/components/InitialGuideOverlay.tsx` — New: SHLF-05 three-step overlay
- `src/components/ScanningAnimationOverlay.tsx` — CAM-06 scan line polish
- `src/components/RoiSetupView.tsx` — Light theme + DSGN-03 controls
- `src/components/ResultInspectView.tsx` — DSGN-02 anomaly colors, light theme chrome
- `src/App.tsx` — INITIAL_GUIDE mode transitions, swipe guard by appMode
- `src/types.ts` — AppMode INITIAL_GUIDE wiring
- `src/lib/constants.ts` — I18N extensions
- `src/index.css` — @theme design tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/components/ShelfSelector.tsx`** — 5-button segmented control; replace with carousel dots, reuse shelf index 0–4 labels.
- **`src/components/CameraView.tsx`** — Already has PRD-adjacent top bar (baseline pill, torch, lang), 76px shutter skeleton, ghost slider, glassmorphism pills — polish and re-layout rather than rewrite.
- **`src/components/ScanningAnimationOverlay.tsx`** — 0.8s scan beam animation with `animate-scan-beam` keyframes — enhance glow, keep duration.
- **`src/App.tsx`** — `handleShelfChange`, `hasPersistedBaseline`, `loadShelfData` — carousel and INITIAL_GUIDE plug into existing shelf lifecycle.
- **`src/types.ts`** — `INITIAL_GUIDE` in `AppMode` union but never assigned — wire in Phase 5.
- **`motion` package** — Declared in `package.json`, zero imports — activate for carousel and optional transitions.

### Established Patterns
- **I18N via `I18N[lang]`** in `constants.ts` — all new strings follow cn/en pairs.
- **Inline Tailwind arbitrary hex** — migrate touched files to centralized tokens (D-13).
- **FSM in App.tsx** — INITIAL_GUIDE is new mode branch alongside existing modes; swipe disabled by `appMode` guard.
- **Phase 3 ghost rules** — INITIAL_GUIDE empty shelf shows no ghost; after baseline, ghost rules unchanged.
- **Banner pattern** — camera/quota/orientation inline banners; INITIAL_GUIDE is full-screen overlay, not banner.

### Integration Points
- **`handleShelfChange`** — carousel/swipe endpoint; add `resolveInitialGuideMode(shelfId)` after load.
- **`loadShelfData`** — sets `hasPersistedBaseline`; drives INITIAL_GUIDE vs CAMERA_IDLE on entry.
- **Phase 4 first capture** — INITIAL_GUIDE → CAMERA_IDLE → shutter → ROI_CONFIG (no change to ROI save contract).
- **Reset baseline flow** — clearing baseline on a shelf re-enables INITIAL_GUIDE on next camera entry.

</code_context>

<specifics>
## Specific Ideas

- All gray areas resolved via **`--auto` recommended defaults** — no user overrides.
- Primary UX bet: **motion-powered swipe carousel + per-shelf INITIAL_GUIDE overlay**, keeping Phase 2/4 data and FSM contracts intact.
- PRD top bar simplified to **3-zone layout**; QA/demo controls demoted to bottom utility strip.
- Stitch verification via **05-UI-SPEC + screenshot UAT**, not CI pixel diff in v1.

</specifics>

<deferred>
## Deferred Ideas

- **Homography / advanced alignment (VIS-07)** — v2.
- **Per-shelf language or tolerance** — not in requirements; remain global.
- **Delete-audit / storage management UI** — quota banner only; actionable clear deferred.
- **Persist INITIAL_GUIDE skip or ghost opacity** — optional v2.
- **Automated Stitch pixel-diff CI** — manual screenshot checklist sufficient for v1.
- **Next.js App Router migration** — v2+ per REQUIREMENTS Out of Scope.

</deferred>

---

*Phase: 5-PRD UI & Multi-Shelf Experience*
*Context gathered: 2026-09-23*
