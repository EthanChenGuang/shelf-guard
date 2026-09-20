---
status: testing
phase: 01-next-js-migration-capture-foundation
source: [01-VERIFICATION.md]
started: 2026-09-20T18:30:00Z
updated: 2026-09-20T18:30:00Z
---

## Current Test

number: 1
name: Install PWA from Vercel preview and verify offline app shell
expected: |
  PWA installs; after going offline the app loads from Service Worker cache;
  demo capture + analysis completes without network
awaiting: user response

## Tests

### 1. Install PWA from Vercel preview and verify offline app shell
expected: PWA installs; offline reload serves cached shell; demo inspection works client-side
result: [pending]

### 2. Deny camera permission on iOS Safari standalone PWA
expected: Inline banner shows cameraPermissionDenied headline and cameraErrorIosGuide body; demo feed remains usable
result: [pending]

### 3. Tap shutter with analyzeShelfCapture delayed >800ms
expected: UI transitions to PROCESSING overlay before results appear
result: [pending]

### 4. View offline pill at 320px viewport width
expected: Offline indicator text does not clip and does not overlap shutter control
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

None — awaiting human verification.
