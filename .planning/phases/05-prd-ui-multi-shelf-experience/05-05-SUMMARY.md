---
phase: 05-prd-ui-multi-shelf-experience
plan: 05
subsystem: ui
tags: [camera, prd-chrome, glass-panel, shutter-breathe, i18n]

requires:
  - phase: 05-prd-ui-multi-shelf-experience
    provides: design tokens, glass-panel utility, ShelfCarousel, InitialGuideOverlay from plans 05-02 through 05-04
provides:
  - PRD 3-zone camera top bar (baseline pill / level badge / torch+lang)
  - Demo utility pill below carousel dots with I18N labels
  - 76px double-ring breathing shutter with capture flash feedback
  - 48×48 last-inspection thumbnail with sg-border token
  - Polished 0.8s cyan scan beam overlay
  - CameraView.topBar.test.tsx covering baseline and language display
affects:
  - 05-06-roi-result-polish
  - 05-07-i18n-audit

actuals:
  tokens: 18000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "PRD 3-zone grid top bar with glass-panel pills"
    - "shutter-breathe + animate-pulse outer ring when camera ready"
    - "Demo feed toggle relocated to bottom-left utility pill"

key-files:
  created:
    - src/components/CameraView.topBar.test.tsx
  modified:
    - src/components/CameraView.tsx
    - src/components/ScanningAnimationOverlay.tsx
    - src/index.css

key-decisions:
  - "Infer camera-ready for shutter breathing via !isUsingDemoFeed && !cameraError && !showInitialGuide (CameraView has no appMode prop)"
  - "Language toggle shows 中/EN per UI spec instead of CN/EN uppercase"
  - "PWA install removed from top bar; optional props retained for App.tsx compatibility"

patterns-established:
  - "data-testid hooks on baseline pill, level badge, language toggle, demo utility pill for CAM-04 tests"

requirements-completed: [CAM-04, CAM-05, CAM-06]

coverage:
  - id: D1
    description: PRD 3-zone top bar without ShelfSelector or hardcoded Demo/Cam strings
    requirement: CAM-04
    verification:
      - kind: unit
        ref: "src/components/CameraView.topBar.test.tsx"
        status: pass
      - kind: other
        ref: "grep baselineNotSet|useSampleFeed|ShelfSelector CameraView"
        status: pass
    human_judgment: false
  - id: D2
    description: 76px breathing shutter, 48×48 thumbnail, capture flash overlay
    requirement: CAM-05
    verification:
      - kind: other
        ref: "grep 76px|shutter-breathe|w-12 h-12 CameraView.tsx"
        status: pass
    human_judgment: true
    rationale: Breathing glow and double-ring visual quality require Stitch screenshot comparison (DSGN-04)"
  - id: D3
    description: Scan beam cyan polish at locked 800ms duration
    requirement: CAM-06
    verification:
      - kind: other
        ref: "grep 0.8s|animate-scan-beam ScanningAnimationOverlay.tsx"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-09-24
status: complete
plan_head_before: ecf7418493adc569c90b8cda00b43d74944de170
commits: 4
---

# Phase 05 Plan 05: Camera PRD Chrome Summary

**PRD 3-zone camera top bar, breathing 76px shutter with capture flash, and polished 0.8s scan beam — matching CAM-04 through CAM-06.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-23T22:04:00Z
- **Completed:** 2026-09-23T22:07:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Refactored CameraView top bar to fixed 3-zone grid: baseline status pill (left), level micro-badge (center), torch + 中/EN language toggle (right)
- Relocated demo/camera toggle to bottom-left glass utility pill below carousel dots using `useSampleFeed` / `useRealCamera` I18N
- Added 76px double-ring shutter with `shutter-breathe` animation when camera ready, plus 150ms white flash on tap
- Resized last-inspection thumbnail to 48×48 with `border-sg-border`
- Strengthened ScanningAnimationOverlay cyan glow while preserving 800ms `animate-scan-beam` timing
- Added `CameraView.topBar.test.tsx` with baseline state and language label coverage

## Task Commits

1. **Task 1: PRD 3-zone top bar refactor** - `e91db0f` (feat)
2. **Task 2: 76px breathing shutter + thumbnail + flash** - `164c0b9` (feat)
3. **Task 3: Scan line polish + top bar tests** - `9c300ab` (test), `56b110a` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Task 3 carried `tdd="true"`. Top bar behavior tests were written after Task 1 implementation; tests passed on first run (GREEN without intentional RED — behavior landed in Task 1). Scan overlay polish committed separately. No refactor commit needed.

## Self-Check: PASSED

- FOUND: src/components/CameraView.topBar.test.tsx
- FOUND: src/components/CameraView.tsx (modified)
- FOUND: src/components/ScanningAnimationOverlay.tsx (modified)
- FOUND: src/index.css (modified)
- FOUND: e91db0f, 164c0b9, 9c300ab, 56b110a
