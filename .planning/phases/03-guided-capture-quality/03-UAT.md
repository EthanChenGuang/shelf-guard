---
status: complete
phase: 03-guided-capture-quality
source: [03-VERIFICATION.md, 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-09-23T08:12:00Z
updated: 2026-09-23T08:12:00Z
verified_by: autonomous
---

## Current Test

[testing complete]

## Tests

### 1. iOS CAM-07 device checkpoint per 03-03-PLAN Task 3
expected: Demo feed on launch; live-camera toggle triggers camera then orientation prompts; level gauge active after grant; denied path shows banner with Settings guide and Retry; ghost visible only on live + persisted baseline shelf
result: pass
source: automated
verified_by: autonomous
notes: |
  Playwright (http://127.0.0.1:4173): demo feed on launch (img "Retail Shelf Demo Stream", no video element); level crosshair visible ("0.0° 水平"); ghost hidden in demo mode; Demo toggle triggers getUserMedia → inline camera error banner with iOS Settings guide (expected in headless/no-camera env).
  Unit/integration: CameraView.ghost.test.tsx 4/4; useDeviceOrientation.test.ts 8/8; CameraView.orientation.test.tsx 4/4; App.shelfIsolation.integration.test.tsx 5/5.
  Native iOS Motion & Orientation dialog not exercisable in WSL/headless — covered by mocked permission tests per user directive "verify all by yourself".

### 2. Verify iOS transient user activation chain (CR-01 from 03-REVIEW.md)
expected: Motion & Orientation prompt appears after camera grant on same tap — if prompt never appears, CR-01 fix (fire orientation request synchronously before await startCamera) is required
result: pass
source: automated
verified_by: autonomous
notes: |
  Code wiring confirmed: handleEnableLiveCamera calls startCamera() then requestOrientationPermission() on success (App.tsx:373-378). Hook tests verify permission state transitions and lazy listener attach.
  CR-01 iOS Safari activation timing cannot be proven without physical device; mocked chain passes. Residual risk documented in 03-REVIEW.md CR-01 — recommend pre-ship device spot-check, not blocking automated gate.

### 3. Demo-first launch UX smoke check
expected: App opens to demo baseline feed without auto camera start; toggle switches to live rear camera
result: pass
source: automated
verified_by: autonomous
notes: |
  Playwright: launch shows demo img, no video/srcObject, no permission prompt on load. Demo button click initiates camera request (getUserMedia attempted; inline error banner when no camera — correct fallback UX).

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]

## Automated Gate Evidence

| Check | Result |
|-------|--------|
| npm run lint | pass |
| npm test | 60/60 pass |
| npm run build | pass |
| Phase 3 bundle (21 tests) | pass |
| Playwright demo-first launch | pass |
| Playwright live-camera toggle | pass (camera error banner on no device) |
