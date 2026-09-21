---
phase: "02"
slug: "multi-shelf-data-layer"
status: complete
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-21"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.1 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- <affected-test-file> -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <affected-test-file> -x`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | DATA-01 | — | shelfId validated 0–4 | unit | `npm test -- src/lib/shelfStorage.test.ts -x` | ✅ | ✅ green |
| 02-01-02 | 01 | 0 | DATA-02 | — | Baseline stored as Blob | unit | `npm test -- src/lib/shelfStorage.test.ts -x` | ✅ | ✅ green |
| 02-01-03 | 01 | 0 | DATA-03 | T-02-01 | Legacy migrate to shelf:0 | unit | `npm test -- src/lib/shelfStorage.test.ts -x` | ✅ | ✅ green |
| 02-02-01 | 02 | 1 | SHLF-02 | — | Switch loads different baseline | integration | `npm test -- src/App.shelfIsolation.integration.test.tsx -x` | ✅ | ✅ green |
| 02-02-02 | 02 | 1 | SHLF-03 | — | Shelf A history not on shelf B | integration | `npm test -- src/App.shelfIsolation.integration.test.tsx -x` | ✅ | ✅ green |
| 02-02-03 | 02 | 1 | SHLF-04 | — | activeShelfId persists | unit | `npm test -- src/lib/shelfStorage.test.ts -x` | ✅ | ✅ green |
| 02-03-01 | 03 | 1 | DATA-04 | T-02-02 | QuotaExceeded surfaced in UI | unit + component | `npm test -- src/lib/shelfStorage.test.ts src/components/CameraView.quota.test.tsx -x` | ✅ | ✅ green |
| 02-03-02 | 03 | 1 | DATA-05 | — | History capped at 20 | unit | `npm test -- src/lib/blobUtils.test.ts src/lib/shelfStorage.test.ts -x` | ✅ | ✅ green |
| 02-03-03 | 03 | 1 | TECH-04 | — | idb-keyval shelf data | unit | covered by shelfStorage tests | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `fake-indexeddb` devDependency + `vitest.setup.ts` import
- [x] `src/lib/blobUtils.ts` — dataUrlToBlob, compressToJpegBlob, isQuotaError
- [x] `src/lib/shelfStorage.ts` — migration, shelf CRUD, typed results
- [x] `src/types/persisted.ts` — PersistedBaseline, PersistedAuditRecord
- [x] `src/lib/shelfStorage.test.ts` — migration, cap, quota, active shelf
- [x] `src/lib/blobUtils.test.ts` — compression dimensions/quality smoke
- [x] `src/App.shelfIsolation.integration.test.tsx` — mandatory D-16 isolation proof
- [x] `src/components/CameraView.quota.test.tsx` — quota banner renders (DATA-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Safari PWA quota behavior | DATA-04 | Browser-specific quota limits vary | Deploy to device, fill storage, verify banner appears |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete (2026-09-21)
