---
status: diagnosed
phase: 01-next-js-migration-capture-foundation
source: [01-VERIFICATION.md, automated-self-verify 2026-09-20]
started: 2026-09-20T18:30:00Z
updated: 2026-09-20T19:16:00Z
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
result: issue
reported: "Automated Playwright at 320×640: pill bottom-3 rect (top 598, bottom 628, left 16, width 189) overlaps shutter rect (top 532, bottom 608, center). verticalGap −96px. Text not clipped."
severity: major

## Summary

total: 4
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 2

## Gaps

- gap_id: G-01-4
  truth: "Offline indicator text does not clip and does not overlap shutter control at 320px viewport"
  status: failed
  reason: "Automated Playwright at 320×640: offline pill (fixed bottom-3 left-4) overlaps shutter button vertical band by ~96px"
  severity: major
  test: 4
  root_cause: "OfflineIndicator uses `fixed bottom-3 left-4` — on 320×640 the pill sits at y≈598–628 while the 76px shutter spans y≈532–608, causing bounding-box overlap"
  artifacts:
    - path: "src/components/OfflineIndicator.tsx"
      issue: "bottom-3 positioning too low relative to shutter row on narrow viewports"
  missing:
    - "Raise offline pill above shutter row (e.g. bottom-24 or responsive bottom offset) and add held-out 320px layout test"
  debug_session: ""
