---
phase: "4"
slug: "real-inspection-pipeline"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-23"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^5.0.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bun run test -- <file> -x` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- <new-test-file> -x`
- **After every plan wave:** Run `bun run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | TECH-06 | T-4-01 | Worker validates message schema before Mat ops | integration | `bun run test -- src/workers/visionWorker.integration.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | VIS-01 | — | Per-tier diff on aligned pair | integration | `bun run test -- src/workers/visionWorker.integration.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | VIS-02 | — | Classifies MISSING vs MOVED | unit | `bun run test -- src/lib/vision/classifyContour.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | VIS-02 | — | Normalized bbox 0.0–1.0 contract | unit | `bun run test -- src/lib/vision/bboxUtils.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | RSLT-01 | — | Real worker anomalies render overlay boxes | integration | `bun run test -- src/workers/visionWorker.integration.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | ROI-01 | — | First-baseline guard in handleShutterClick | static | `awk '/const handleShutterClick = async/,/^  };/' src/App.tsx \| grep -c '!hasPersistedBaseline' \| grep -qx '1'` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | ROI-01 | — | handleShutterClick routes to ROI_CONFIG without scan | static | `awk '/const handleShutterClick = async/,/^  };/' src/App.tsx \| grep -c 'ROI_CONFIG' \| grep -qv '^0$'` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | ROI-02 | — | 4 draggable dividers on pending baseline | component | `grep -c 'splitYPercentages' src/components/RoiSetupView.tsx \| grep -qv '^0$'` | ✅ | ⬜ pending |
| 04-02-04 | 02 | 2 | ROI-03 | — | Pointer capture drag handles | component | `grep -c 'setPointerCapture' src/components/RoiSetupView.tsx \| grep -qv '^0$'` | ✅ | ⬜ pending |
| 04-02-05 | 02 | 2 | ROI-04 | — | Magnifier 80px 2× zoom | component | `grep -c 'magnifier' src/components/RoiSetupView.tsx \| grep -qv '^0$'` | ✅ | ⬜ pending |
| 04-02-06 | 02 | 2 | ROI-05 | — | First-baseline retake/save actions | integration | `bun run test -- src/App.firstBaseline.integration.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-02-07 | 02 | 2 | VIS-03 | — | Tolerance params lerp mapping | unit | `bun run test -- src/lib/vision/toleranceParams.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-08 | 02 | 2 | VIS-03 | — | Slider change re-invokes worker diff | integration | `bun run test -- src/App.toleranceReDiff.integration.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-02-09 | 02 | 2 | RSLT-05 | — | Slider replaces 3-button UI | component | `bun run test -- src/components/ResultInspectView.tolerance.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-02-10 | 02 | 2 | RSLT-03 | — | Tap-to-dismiss decrements stat counts | unit | `grep -c 'handleDismissAnomaly' src/App.tsx \| grep -qv '^0$'` | ✅ | ⬜ pending |
| 04-02-11 | 02 | 2 | RSLT-04 | — | Stat capsule filter by type | component | `grep -c 'filterType' src/components/ResultInspectView.tsx \| grep -qv '^0$'` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 3 | ROI-01 | — | First baseline → ROI_CONFIG, no scan, no diff | integration | `bun run test -- src/App.firstBaseline.integration.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | VIS-04 | T-4-08 | PROCESSING when >800ms | integration | `bun run test -- src/App.processing.integration.test.tsx -x` | ✅ | ⬜ pending |
| 04-03-03 | 03 | 3 | RSLT-06 | — | Complete inspection saves audit, returns to shelf camera | integration | `bun run test -- src/App.completeAudit.integration.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-03-04 | 03 | 3 | STAB-03 | — | Shutter lock during scan/process | unit | `bun run test -- src/App.capture.test.ts -x` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/vision/toleranceParams.ts` + `toleranceParams.test.ts` — covers VIS-03 mapping
- [ ] `src/lib/vision/bboxUtils.ts` + `bboxUtils.test.ts` — covers VIS-02 output contract
- [ ] `src/lib/vision/complianceStats.ts` — dedupe formula from App + vision
- [ ] `src/workers/visionWorker.ts` + integration test with golden fixtures — covers TECH-06, VIS-01
- [ ] `public/test-fixtures/` — baseline + capture JPEG pairs (D-28)
- [ ] `src/App.firstBaseline.integration.test.tsx` — covers ROI-01, D-01
- [ ] `src/App.toleranceReDiff.integration.test.tsx` — covers VIS-03 re-diff trigger, D-13
- [ ] `src/App.completeAudit.integration.test.tsx` — covers RSLT-06, D-26
- [ ] `bun add @techstark/opencv-js` — OpenCV WASM dependency

---

## Manual-Only Verifications

| Requirement | Reason | Checkpoint |
|-------------|--------|------------|
| VIS-01 aligned capture | Viewpoint drift false positives need device framing | Manual aligned-capture checkpoint on device |
| RSLT-02 blink compare | Long-press gesture timing on mobile | Device smoke test |
