---
status: testing
phase: 01-next-js-migration-capture-foundation
source: [01-VERIFICATION.md]
started: 2026-09-20T18:30:00Z
updated: 2026-09-20T19:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Install PWA from Vercel preview and verify offline app shell
expected: PWA installs; offline reload serves cached shell; demo capture + analysis completes without network
result: blocked
blocked_by: release-build
reason: "Automated verify: SW registered (1 reg), manifest.json present (ShelfGuard PWA), offline reload serves app shell on localhost:4173 preview. Vercel preview HTTPS install flow not exercised. Demo capture in Playwright failed with canvas CORS taint on CDN baseline image (SecurityError toDataURL) — CAM-09 covered by unit tests."

### 2. Deny camera permission on iOS Safari standalone PWA
expected: Inline banner shows cameraPermissionDenied headline and cameraErrorIosGuide body; demo feed remains usable
result: blocked
blocked_by: physical-device
reason: "Requires iOS Safari standalone PWA on physical device. Banner copy/rendering verified by CameraView.error.test.tsx (3/3 pass)."

### 3. Tap shutter with analyzeShelfCapture delayed >800ms
expected: UI transitions to PROCESSING overlay before results appear
result: pass
source: automated
note: "App.processing.integration.test.tsx — mocked slow analyzeShelfCapture; PROCESSING overlay with Loader2 + 正在分析展架差异 copy shown at 800ms."

### 4. View offline pill at 320px viewport width
expected: Offline indicator text does not clip and does not overlap shutter control
result: pass
source: automated
note: "Gap closure plan 01-05: OfflineIndicator raised to bottom-24; G-01-4 layout regression test passes (3/3 OfflineIndicator tests)."

## Summary

total: 4
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 2

## Gaps

(none — G-01-4 closed by plan 01-05)
