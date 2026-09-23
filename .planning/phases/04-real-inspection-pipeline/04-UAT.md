---
status: testing
phase: 04-real-inspection-pipeline
source: [04-VERIFICATION.md]
started: 2026-09-23T21:46:00Z
updated: 2026-09-23T21:46:00Z
---

## Current Test

number: 1
name: VIS-01 aligned device capture with viewpoint drift
expected: |
  Real diff runs; boxes appear for genuine shelf changes; false positives from drift are dismissible via tap-to-dismiss
awaiting: user response

## Tests

### 1. VIS-01 aligned device capture with viewpoint drift
expected: On a physical device, capture a follow-up photo with 2–5° viewpoint drift from baseline (ghost overlay aligned as best possible). Real diff runs; boxes appear for genuine shelf changes; false positives from drift are dismissible via tap-to-dismiss.
result: [pending]

### 2. RSLT-02 blink compare mobile gesture
expected: On iOS/Android, long-press the result viewport image for blink compare. Boxes hide immediately on press; baseline image shown; release restores capture + boxes; no scroll/zoom interference.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

None — awaiting human UAT only.
