---
status: partial
phase: 01-next-js-migration-capture-foundation
source: [01-VERIFICATION.md, autonomous-self-verify 2026-09-20, human-verify 2026-09-21, fix G-01-7 deploy 2026-09-21]
started: 2026-09-20T18:30:00Z
updated: 2026-09-21T00:14:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Install PWA from Vercel preview and verify offline app shell
expected: PWA installs; offline reload serves cached shell; demo capture + analysis completes without network
result: pass
source: human+automated
note: "Human 2026-09-21: PWA install + offline reload OK on shelf-guard-pearl.vercel.app. Demo capture failed pre-fix (G-01-7). Post-fix commits a5e7401+5a65bd3: baseline /demo-shelf.jpg, IndexedDB migration off google CDN; autonomous Vercel verify 2026-09-21 — shutter reaches 展架巡检比对结果, no canvas CORS errors."

### 2. Deny camera permission on iOS Safari standalone PWA
expected: Inline banner shows cameraPermissionDenied headline and cameraErrorIosGuide body; demo feed remains usable
result: blocked
blocked_by: physical-device
reason: "Requires iOS Safari standalone PWA on physical device. Autonomous proxy: CameraView.error.test.tsx 3/3 pass."

### 3. Tap shutter with analyzeShelfCapture delayed >800ms
expected: UI transitions to PROCESSING overlay before results appear
result: pass
source: automated
note: "App.processing.integration.test.tsx 1/1 pass."

### 4. View offline pill at 320px viewport width
expected: Offline indicator text does not clip and does not overlap shutter control
result: pass
source: automated
note: "Playwright on Vercel at 320×640: bottom-28, verticalGap +4px, clearsShutter true."

## Summary

total: 4
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

- gap_id: G-01-7
  truth: "Demo capture + analysis completes on production Vercel (PWA-01 / CAM-09 runtime)"
  status: resolved
  reason: "Fixed: DEFAULT_SHELF_IMAGE_URL → /demo-shelf.jpg; crossOrigin for http(s); IndexedDB migration rewrites legacy googleusercontent baseline."
  severity: major
  test: 1
  resolved_by: "commits a5e7401, 5a65bd3"
  resolved_at: 2026-09-21
