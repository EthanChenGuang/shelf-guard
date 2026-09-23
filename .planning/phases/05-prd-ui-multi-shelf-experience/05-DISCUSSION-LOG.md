# Phase 5: PRD UI & Multi-Shelf Experience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 5-PRD UI & Multi-Shelf Experience
**Mode:** `--auto` (all gray areas auto-selected with recommended defaults)
**Areas discussed:** Shelf swipe carousel, INITIAL_GUIDE onboarding, Minimalist Light tokens, Camera top bar PRD layout

---

## Shelf Swipe Carousel

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal swipe on viewport + dot indicator | Touch pan switches shelves; 5-dot strip below top bar; uses existing `handleShelfChange` | ✓ |
| Keep segmented ShelfSelector in top bar | Phase 2 QA control; no swipe gesture | |
| CSS scroll-snap only (no motion) | Zero animation dependency | |

**Auto choice:** Horizontal swipe + dot indicator with `motion` snap animation; remove top-bar ShelfSelector.
**Notes:** Swipe disabled during scan/ROI/result modes. 50px horizontal threshold.

---

## INITIAL_GUIDE Onboarding

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen 3-step overlay per empty shelf | Welcome → tips → capture CTA; no demo baseline image; skip allowed | ✓ |
| Silent demo baseline (brownfield) | DEFAULT_CALIBRATION on empty shelves | |
| Block app until baseline captured | Hard gate with no skip | |

**Auto choice:** Per-shelf INITIAL_GUIDE overlay when `!hasPersistedBaseline`; integrates with Phase 4 first-capture → ROI path.
**Notes:** Skip not persisted; guide reappears on empty shelf until baseline saved.

---

## Minimalist Light Design System

| Option | Description | Selected |
|--------|-------------|----------|
| Centralize tokens in `@theme` + designTokens.ts | Single source; glassmorphism pattern; light ROI/result backgrounds | ✓ |
| Inline arbitrary hex only | Match current brownfield | |
| Full component library rewrite | New design-system package | |

**Auto choice:** Token centralization + uniform glass controls + DSGN-02 anomaly box styling update.

---

## Camera Top Bar PRD Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Left baseline pill / Center level badge / Right torch+lang | PRD CAM-04; demo toggle to bottom-left utility | ✓ |
| Current cluttered top bar (shelf + demo + PWA + torch + lang) | Brownfield layout | |
| Hide demo mode entirely | Breaks CAM-01 QA path | |

**Auto choice:** PRD 3-zone top bar; demo/PWA demoted out of primary chrome.

---

## Claude's Discretion

- motion spring parameters, INITIAL_GUIDE progress styling, ShelfCarousel extraction vs inline, demo toggle visibility rules, ±4px spacing tolerance.

## Phase 4 Drift Review (2026-09-23)

**Trigger:** User requested verification against shipped Phase 4 implementation.

| Finding | Action |
|---------|--------|
| D-04 claimed motion in package.json | **Corrected** — motion must be installed in Wave 0 |
| DSGN-02 anomaly colors already in ResultInspectView | **Scoped D-16** to tokenization, not reimplementation |
| First-baseline FSM + pendingBaselineImageUrl shipped | **Added D-35, D-36** preservation contracts |
| analysisError banner added to CameraView | **Added D-37** — preserve through top bar refactor |
| prewarmVisionWorker on CAMERA_IDLE + baseline | **Added D-38** — INITIAL_GUIDE must not prewarm |
| Tolerance slider 0–100 shipped | **Added D-39** — polish only |
| 83-test regression gate | **Added D-40** |
| loadShelfData always lands CAMERA_IDLE | **Added D-41** resolveAppModeAfterShelfLoad |
| Empty shelf still shows DEFAULT_CALIBRATION in demo | **Clarified D-09** — override feed in Phase 5 |
| Baseline pill always shows "established" | **Noted under D-21** — wire hasPersistedBaseline |

**Plans impact:** Existing 7 plans remain valid; `05-02` already covers motion install; `05-06` scope reduced to tokenize existing DSGN-02. Optional: add D-35–D-41 preservation notes to `05-04`/`05-05` task actions during execute.

## Deferred Ideas

- Homography (v2), per-shelf settings, delete-audit UI, automated Stitch CI pixel diff, Next.js migration.
