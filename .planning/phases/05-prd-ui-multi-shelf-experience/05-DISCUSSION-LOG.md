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

## Deferred Ideas

- Homography (v2), per-shelf settings, delete-audit UI, automated Stitch CI pixel diff, Next.js migration.
