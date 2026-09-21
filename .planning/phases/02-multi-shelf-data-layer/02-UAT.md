---
status: testing
phase: 02-multi-shelf-data-layer
source: [02-VERIFICATION.md]
started: 2026-09-21T12:08:00Z
updated: 2026-09-21T12:08:00Z
---

## Current Test

number: 1
name: Migration quota banner (D-20)
expected: |
  Seed legacy shelfguard_baseline in IndexedDB. Trigger QuotaExceededError during migration (DevTools quota reduction or mock). Reload app.
  Amber inline quota banner on camera view with localized title; shelf data does not hydrate.
awaiting: user response

## Tests

### 1. Migration Quota Banner (D-20)
expected: Amber inline quota banner on camera view with localized title; shelf data does not hydrate when migration write fails with QuotaExceededError
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
