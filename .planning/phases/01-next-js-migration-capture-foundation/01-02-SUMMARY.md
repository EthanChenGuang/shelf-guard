---
phase: 01-next-js-migration-capture-foundation
plan: 02
subsystem: infra
tags: [vercel, pwa, vite, capture]

requires:
  - phase: 01-01
    provides: Vitest scaffold and aligned planning docs
provides:
  - vercel.json SPA rewrite + PWA cache headers
  - captureFrame(baselineImageUrl) demo fix
  - shelfguard package name, pure-client deps
affects: [01-03, 01-04]

actuals:
  tokens: 12000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns: [vercel.json PWA headers, async demo capture from baseline URL]

key-files:
  created: [vercel.json, README.md]
  modified: [src/hooks/useCameraStream.ts, src/App.tsx, package.json]

requirements-completed: [TECH-01, TECH-02, TECH-03, TECH-05, TECH-07, CAM-09, PWA-01, PWA-02]

coverage:
  - id: D1
    description: Vercel deploy config with PWA-safe cache headers
    requirement: PWA-02
    verification:
      - kind: unit
        ref: "bun run build && dist/sw.js precache has no blob/data URLs"
        status: pass
    human_judgment: false
  - id: D2
    description: Demo capture uses displayed baseline frame
    requirement: CAM-09
    verification:
      - kind: unit
        ref: "src/hooks/useCameraStream.capture.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: Pure-client dependency hygiene
    requirement: TECH-03
    verification:
      - kind: unit
        ref: "package.json name shelfguard, no genai/express/dotenv/motion"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-20
status: complete
---

# Plan 01-02 Summary

**Vite PWA deploy path wired with vercel.json; demo capture snapshots displayed baseline; server deps removed.**

## Self-Check: PASSED

- `bun run lint && bun run build && bun run test` — all pass
- dist/sw.js precache: 0 blob/data:image patterns
- captureFrame(baseline.imageDataUrl) in App.tsx

## Deviations

None.
