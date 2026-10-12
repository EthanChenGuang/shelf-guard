---
phase: quick-261012-hld
plan: 1
subsystem: inspect-ui
tags: [gesture-hints, hold-hint, landscape, verify-shelfguard]

requires:
  - phase: quick-261012-r7i
    provides: sequenced animated pinch and hold hints
provides:
  - hold hint and viewing-reference badge below the comparison frame
  - landscape image shrink so the strip stays in the viewport
affects: [inspect-results, verify-shelfguard]

actuals:
  tokens: 14000
  tasks: 2
  commits: 5
plan_head_before: 0ab5183

key-files:
  created: []
  modified:
    - src/index.css
    - src/components/ResultInspectView.tsx
    - src/components/ResultInspectView.zoom.test.tsx
    - .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs
    - .cursor/skills/verify-shelfguard/SKILL.md
    - .cursor/skills/verify-shelfguard/features/inspect-scan.md

key-decisions:
  - "Hold caption lives in a reserved strip below the frame, not absolute-inset on the photo"
  - "Pinch overlay stays on the image as a transient overlay"
  - "Frame max-height is 100dvh minus chrome minus strip so the caption fits on short phone viewports"
  - "Harness asserts hold/status rects do not intersect the image and sit fully in the viewport"

requirements-completed: [QUICK-261012-hld]
status: complete
completed: 2026-10-12
---

# Phase quick-261012-hld Summary

Moved the hold-to-reference animation and the viewing-reference badge below the comparison image. Pinch overlay stays on the photo. Landscape (and short portrait) shrinks the frame so the strip is on-screen.

verify-shelfguard run `1791839087`: hold/status `intersect=false`, `below=true`, `inViewport=true` on 390×844 / 844×390 and on iPhone 14, iPhone 15 Pro Max, Pixel 7, Galaxy S9+ (portrait + landscape). Pinch zoom and zoomed blink-compare still pass.

279 unit tests; `tsc --noEmit` clean. PR #8, do not merge.
