---
status: complete
phase: 01-next-js-migration-capture-foundation
source: [01-VERIFICATION.md, autonomous-self-verify 2026-09-20, human-verify 2026-09-21, fix G-01-7 deploy 2026-09-21, autonomous re-verify 2026-09-22]
started: 2026-09-20T18:30:00Z
updated: 2026-09-22T08:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Install PWA from Vercel preview and verify offline app shell
expected: PWA installs; offline reload serves cached shell; demo capture + analysis completes without network
result: pass
source: human+automated
note: "Human 2026-09-21: PWA install + offline reload OK on shelf-guard-pearl.vercel.app. Demo capture verified post G-01-7 fix (a5e7401, 5a65bd3). Human confirmed pass 2026-09-21."

### 2. Deny camera permission on iOS Safari standalone PWA
expected: Inline banner shows cameraPermissionDenied headline and cameraErrorIosGuide body; demo feed remains usable
result: pass
source: human
note: "Human confirmed pass 2026-09-21. Cam-mode real capture deferred to Phase 3 per roadmap; Phase 1 CAM-08 banner + Demo fallback accepted."

### 3. Tap shutter with analyzeShelfCapture delayed >800ms
expected: UI transitions to PROCESSING overlay before results appear
result: pass
source: automated
note: "App.processing.integration.test.tsx 1/1 pass."

### 4. View offline pill at 320px viewport width
expected: Offline indicator text does not clip and does not overlap shutter control
result: pass
source: automated
note: "Playwright on Vercel at 320×640: bottom-28, verticalGap +4px, clearsShutter true. Re-confirmed 2026-09-22: npm test OfflineIndicator.test.tsx (shutter-top 532px clearance) + full suite 43/43 pass."

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-01-7
  truth: "Demo capture + analysis completes on production Vercel (PWA-01 / CAM-09 runtime)"
  status: resolved
  reason: "Fixed: DEFAULT_SHELF_IMAGE_URL → /demo-shelf.jpg; crossOrigin for http(s); IndexedDB migration rewrites legacy googleusercontent baseline."
  severity: major
  test: 1
  resolved_by: "commits a5e7401, 5a65bd3"
  resolved_at: 2026-09-21
