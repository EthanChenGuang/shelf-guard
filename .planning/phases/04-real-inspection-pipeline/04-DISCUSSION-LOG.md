# Phase 4: Real Inspection Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 4-Real Inspection Pipeline
**Areas discussed:** First-baseline capture flow, Missing vs displaced classification, Tolerance slider semantics, Viewpoint drift without homography
**Mode:** Auto-accept recommended defaults (all 4 areas)

---

## First-Baseline Capture Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-route to ROI setup on first shutter | Capture frame → ROI_CONFIG with captured image as baseline background; no diff until saved | ✓ |
| Explicit ROI config only | User must open ROI config manually; shutter on empty shelf shows error or mock result | |
| INITIAL_GUIDE wizard | Full onboarding flow before calibration | Deferred to Phase 5 |

**User's choice:** Auto-accept recommended — auto-route to ROI setup on first shutter
**Notes:** Aligns with ROADMAP success criterion #1. Pending capture becomes baseline image on ROI save.

---

## Missing vs Displaced Classification

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tier absdiff + contour heuristics | MISSING = void in capture vs baseline; MOVED = centroid shift with content in both | ✓ |
| Any diff blob = displaced unless area drop | Simpler single-path classification | |
| Template matching per product slot | Higher accuracy, much higher complexity | Deferred to v2+ |

**User's choice:** Auto-accept recommended — per-tier absdiff + dual heuristic (void vs displacement)
**Notes:** OpenCV findContours per ROI band; normalized bbox output preserves existing UI contract.

---

## Tolerance Slider Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Continuous 0–100 slider → threshold + min area + displacement | Full worker re-diff on debounced change; migrate enum to integer | ✓ |
| Keep 3 discrete presets only | strict/normal/loose buttons filter or re-parameterize | |
| Single threshold only | Slider maps to one OpenCV threshold value | |

**User's choice:** Auto-accept recommended — continuous slider with multi-parameter mapping
**Notes:** Matches PRD RSLT-05 horizontal slider. Migration: strict=25, normal=50, loose=75.

---

## Viewpoint Drift Without Homography

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tier crop + accept false positives + tap-to-dismiss | No homography; 2% edge inset; document drift limitation | ✓ |
| Strict diff, high false-positive rate | Flag everything, user dismisses heavily | |
| Per-tier scale/normalize alignment | Partial alignment without full homography | Partial — crop-only within D-16, no scale warp |

**User's choice:** Auto-accept recommended — per-tier crop, accept residual drift, dismiss UX as mitigation
**Notes:** Homography deferred to v2 VIS-07. Golden test fixtures required in planning.

---

## Claude's Discretion

- OpenCV kernel sizes and exact void/displacement thresholds within mapped tolerance ranges
- Worker bundling via Vite worker import
- `standardCount` derivation approach
- First-baseline "重拍" behavior in RoiSetupView

## Deferred Ideas

- Homography auto-align (VIS-07) — v2
- INITIAL_GUIDE onboarding — Phase 5
- PRD animation/top-bar polish — Phase 5
- Export/report — v2
