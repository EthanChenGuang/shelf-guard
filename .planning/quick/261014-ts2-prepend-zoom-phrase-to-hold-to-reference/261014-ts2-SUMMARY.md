---
phase: quick-261014-ts2
plan: 1
subsystem: inspect-ui
tags: [gesture-hints, hold-hint, i18n, verify-shelfguard]

requires:
  - phase: quick-261012-hld
    provides: hold hint below the comparison frame
provides:
  - zoom+hold copy on one line (it/cn/en)
  - nowrap caption with fluid type and ellipsis fallback
affects: [inspect-results, verify-shelfguard]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4
plan_head_before: 4b69788

key-files:
  created: []
  modified:
    - src/lib/constants.ts
    - src/components/ResultInspectView.tsx
    - src/index.css
    - src/components/ResultInspectView.zoom.test.tsx
    - src/components/ResultInspectView.tolerance.test.tsx
    - .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs
    - .cursor/skills/verify-shelfguard/SKILL.md
    - .cursor/skills/verify-shelfguard/features/inspect-scan.md

key-decisions:
  - "pressHoldCompare prepends a zoom phrase; Italian default is Puoi ingrandire · Tieni premuto per vedere il riferimento"
  - "Caption is nowrap with clamp() font-size and ellipsis fallback"
  - "Hold graphic lives inside the pill so the full Italian line fits on narrow portrait phones"
  - "Did not touch pinch-zoom overflow/transform to avoid the parallel Android clipping branch"

requirements-completed: [QUICK-261014-ts2]
status: complete
completed: 2026-10-14
---

# Phase quick-261014-ts2 Summary

Prepended a zoom phrase to the hold-to-reference hint under the comparison image. Copy stays on one line below the photo; the hold press/ring animation remains.

- it: `Puoi ingrandire · Tieni premuto per vedere il riferimento`
- cn: `可以放大显示 · 按住显示参考图`
- en: `Pinch to zoom · Hold to see reference`

verify-shelfguard run `ts2-hold-hint-copy-v2`: caption `whiteSpace=nowrap`, `rects=1`, `fits=true`, `intersect=false`, `below=true` on 390×844 / 844×390 and on iPhone 14, iPhone 15 Pro Max (WebKit), Pixel 7, Galaxy S9+ (Chromium), portrait and landscape. 21 targeted unit tests; `tsc --noEmit` clean. PR #10, do not merge.
