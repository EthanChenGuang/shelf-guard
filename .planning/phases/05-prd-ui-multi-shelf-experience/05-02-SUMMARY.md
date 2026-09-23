---
phase: 05-prd-ui-multi-shelf-experience
plan: 02
subsystem: ui
tags: [tailwind, motion, design-tokens, css-theme, glassmorphism]

requires:
  - phase: 05-01
    provides: 05-UI-SPEC.md design contract and Stitch UAT checklist authority
provides:
  - PRD @theme color tokens in src/index.css
  - SG_COLORS mirror in src/lib/designTokens.ts for JS/canvas access
  - glass-panel Tailwind utility for floating controls
  - shutter-breathe keyframe (defined, not wired)
  - motion@^13.4.2 dependency for shelf carousel cross-fade
affects: [05-03, 05-04, 05-05, carousel, camera-chrome, anomaly-overlays]

actuals:
  tokens: 1250
  tasks: 3
  commits: 1
plan_head_before: 490b4ac5b1a566e9e889b6bd094a7f227c6e2020

tech-stack:
  added: [motion@13.4.2]
  patterns: ["@theme --color-sg-* tokens with SG_COLORS JS mirror", "glass-panel @utility for DSGN-03 glassmorphism"]

key-files:
  created: [src/lib/designTokens.ts]
  modified: [src/index.css, package.json, bun.lock]

key-decisions:
  - "Used bun.lock (not package-lock.json) — project uses Bun; plan listed package-lock.json but repo has bun.lock only"
  - "shutter-breathe keyframe defined at 0.98–1.02 scale; wiring deferred to CAM-05 tasks in 05-04+"

patterns-established:
  - "PRD palette: @theme --color-sg-* generates bg-sg-*, text-sg-*, border-sg-* utilities"
  - "JS/canvas colors: import SG_COLORS from designTokens.ts — never duplicate hex in components"

requirements-completed: [DSGN-01, DSGN-03]

coverage:
  - id: D1
    description: "PRD color tokens in @theme block mirroring 05-UI-SPEC palette"
    requirement: DSGN-01
    verification:
      - kind: other
        ref: "grep color-sg-success src/index.css"
        status: pass
    human_judgment: false
  - id: D2
    description: "SG_COLORS export in designTokens.ts matching @theme hex values"
    requirement: DSGN-01
    verification:
      - kind: other
        ref: "grep SG_COLORS src/lib/designTokens.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "glass-panel utility for floating control glassmorphism"
    requirement: DSGN-03
    verification:
      - kind: other
        ref: "grep glass-panel src/index.css"
        status: pass
    human_judgment: false
  - id: D4
    description: "motion@^13.4.2 installed for shelf carousel cross-fade"
    requirement: DSGN-03
    verification:
      - kind: other
        ref: "grep motion package.json && bun run build"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-23
status: complete
---

# Phase 05 Plan 02: Design Tokens + Motion Dependency Foundation Summary

**PRD Minimalist Light palette centralized in @theme + SG_COLORS mirror; motion@13.4.2 installed for shelf cross-fade**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-23T21:55:00Z
- **Completed:** 2026-09-23T22:01:00Z
- **Tasks:** 3 (1 checkpoint approved, 2 auto)
- **Files modified:** 4

## Accomplishments

- Human-verified motion package (Motion Division / motiondivision/motion) before install per T-05-SC threat mitigation
- Installed `motion@13.4.2` via Bun for D-04 shelf carousel cross-fade in 05-03+
- Added full PRD `@theme` token block (`--color-sg-white` through `--color-sg-scan`) per D-13 and 05-UI-SPEC
- Created `src/lib/designTokens.ts` with `SG_COLORS` constant mirroring CSS tokens for JS/canvas use
- Added `@utility glass-panel` for DSGN-03 glassmorphism on floating controls
- Defined `@keyframes shutter-breathe` (scale 0.98–1.02) for later CAM-05 wiring
- Production build passes with motion in dependency tree (no component imports yet)

## Task Commits

Each task was committed atomically where file changes occurred:

1. **Task 1: Verify motion package legitimacy** — checkpoint approved (no commit)
2. **Task 2: Install motion and add PRD @theme tokens** — `a59d949` (feat)
3. **Task 3: Verify build with motion tree-shaking** — verification-only (no file changes; build green)

## Files Created/Modified

- `src/lib/designTokens.ts` — SG_COLORS export mirroring @theme hex values
- `src/index.css` — @theme tokens, glass-panel utility, shutter-breathe keyframe
- `package.json` — motion@^13.4.2 dependency
- `bun.lock` — lockfile updated

## Decisions Made

- Used `bun.lock` instead of `package-lock.json` (project package manager is Bun)
- Token foundation only — no component hex migration in this plan (deferred to 05-03+)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written after checkpoint approval.

---

**Total deviations:** 0
**Impact on plan:** N/A

## Issues Encountered

- Pre-existing `bun run lint` failure in `ResultInspectView.tolerance.test.tsx` (rowIndex type mismatch) — unrelated to this plan's changes; build passes. Deferred to future lint cleanup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Token foundation and motion dependency ready for 05-03 ShelfCarousel tracer
- `@theme` utilities available: `bg-sg-surface`, `text-sg-primary`, `border-sg-border`, etc.
- `glass-panel` utility ready for camera/ROI/result floating controls refactor
- `motion/react` import path available for ~300ms shelf cross-fade spring animation

---
*Phase: 05-prd-ui-multi-shelf-experience*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `.planning/phases/05-prd-ui-multi-shelf-experience/05-02-SUMMARY.md`
- FOUND: `src/lib/designTokens.ts`
- FOUND: commit `a59d949`
