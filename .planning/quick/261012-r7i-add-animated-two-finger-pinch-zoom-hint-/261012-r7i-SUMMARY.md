---
phase: quick-261012-r7i
plan: 1
subsystem: inspect-ui
tags: [gesture-hints, pinch-zoom, hold-hint, italian, verify-shelfguard]

requires:
  - phase: quick-261012-qce
    provides: whole-screen inline pinch-zoom
provides:
  - first-view two-finger pinch overlay (pointer-events none, fades then sequences)
  - animated hold-to-reference overlay (finger press + ripple/progress ring)
  - sequenced pinch-then-hold so the two hints never overlap
  - hold hint stays visible while zoomed
affects: [inspect-results, verify-shelfguard]

actuals:
  tokens: 22000
  tasks: 3
  commits: 14
plan_head_before: 25a4ae1

key-files:
  created: []
  modified:
    - src/lib/constants.ts
    - src/index.css
    - src/components/ResultInspectView.tsx
    - src/components/ResultInspectView.zoom.test.tsx
    - .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs
    - .cursor/skills/verify-shelfguard/SKILL.md
    - .cursor/skills/verify-shelfguard/features/inspect-scan.md

key-decisions:
  - "Pinch overlay is a sibling of the zoom layer (not transformed with scale) with pointer-events none so gestures pass through"
  - "Hold overlay sits on the viewport at z-70 so it remains visible while zoomed"
  - "Sequence pinch (8s) then hold; they never overlap"
  - "prefers-reduced-motion disables pinch/press/ring/pulse; overlays still show then hide"
  - "Italian copy: Pizzica con due dita per ingrandire / Tieni premuto per vedere il riferimento"
  - "Landscape CSS sizes only the hint graphic SVG, not the Lucide eye in the pill"

requirements-completed: [QUICK-261012-r7i]
status: complete
completed: 2026-10-12
---

# Phase quick-261012-r7i Summary

Added sequenced, animated, non-blocking gesture hints on the results comparison image.

1. Pinch overlay first (`Pizzica con due dita per ingrandire`) with two-finger animation. Fades after 8s or first interaction.
2. Hold overlay next (`Tieni premuto per vedere il riferimento`) with finger press, ripple, and progress ring. Stays visible while zoomed (`z-[70]`).
3. Both `pointer-events: none`. `prefers-reduced-motion` skips motion.

verify-shelfguard run `1791836751` on preview `:4173`:

inspect-scan: pinch then hold, Italian copy, pointer-events none, frames at 0/400/800ms in portrait and landscape; pinch scale 2.75 at 390×844 / 844×390 / 932×430; blink-compare, centering, flicker, rotate-offset still pass.

Cross-platform (unclipped zoom, pinch+hold frames both orientations):

| Platform | Engine | Device | Portrait | Landscape |
|---|---|---|---|---|
| iOS | WebKit | iPhone 14 | 5 (max), unclipped | 2.75, unclipped |
| iOS | WebKit | iPhone 15 Pro Max | 2.75, unclipped | 2.75, unclipped |
| Android | Chromium | Pixel 7 | 2.75, unclipped | 2.75, unclipped |
| Android | Chromium | Galaxy S9+ | 2.75, unclipped | 2.75, unclipped |

277 unit tests; `tsc --noEmit` clean. PR #8, do not merge.
