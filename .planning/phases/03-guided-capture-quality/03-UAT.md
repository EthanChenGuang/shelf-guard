---
status: testing
phase: 03-guided-capture-quality
source: [03-VERIFICATION.md]
started: 2026-09-23T08:12:00Z
updated: 2026-09-23T08:12:00Z
---

## Current Test

number: 1
name: iOS CAM-07 device checkpoint per 03-03-PLAN Task 3
expected: |
  Demo feed on launch; live-camera toggle triggers camera then orientation prompts; level gauge active after grant; denied path shows banner with Settings guide and Retry; ghost visible only on live + persisted baseline shelf
awaiting: user response

## Tests

### 1. iOS CAM-07 device checkpoint per 03-03-PLAN Task 3
expected: Demo feed on launch; live-camera toggle triggers camera then orientation prompts; level gauge active after grant; denied path shows banner with Settings guide and Retry; ghost visible only on live + persisted baseline shelf
result: [pending]

### 2. Verify iOS transient user activation chain (CR-01 from 03-REVIEW.md)
expected: Motion & Orientation prompt appears after camera grant on same tap — if prompt never appears, CR-01 fix (fire orientation request synchronously before await startCamera) is required
result: [pending]

### 3. Demo-first launch UX smoke check
expected: App opens to demo baseline feed without auto camera start; toggle switches to live rear camera
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

[pending human verification]
