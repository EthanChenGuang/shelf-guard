---
phase: quick-260928-p4l
plan: 1
status: incomplete
subsystem: vision, result-page
tags: [added-items, classification, alignment, parallax]
provides:
  - ADDED anomaly type with symmetric (brightness-polarity-free) classification
  - MISSING+ADDED pairing into MOVED for objects moved between shots
  - added chip / sky-blue boxes / confidence on added and moved badges; addedCount persisted
not-shipped:
  - local (parallax) alignment refinement — did not meet acceptance criteria
key-files:
  - src/lib/vision/classifyContour.ts
  - src/workers/visionWorker.ts
  - src/workers/visionWorker.added.test.ts
  - src/components/ResultInspectView.tsx
commits:
  - 35333c3 feat(vision): report items added between shots as ADDED
  - 9f9390b feat(result): show added items and confidence on moved/added badges
---

# Quick 260928-p4l: added items + local alignment

## Shipped (Tasks 1–2)

Added items used to be detected but never labelled as added (harness `added-items.harness.ts`):
light shelf 24/24 → MISSING, dark shelf 24/24 → MOVED, desk 9 MOVED / 3 MISSING. The old first
rule ("region got darker → MISSING") assumed a dark shelf back.

Classification is now symmetric on texture and contrast against the surroundings: vanished →
MISSING, appeared → ADDED, both → MOVED; a nearby, similar MISSING+ADDED pair → both MOVED.
After: light shelf 24/24 ADDED, dark shelf 24/24 ADDED, desk 12/12 ADDED.

Verification (orchestrator, after the executor stopped on an API spend limit): `bunx vitest run`
49 files / 229 tests pass; `bunx tsc --noEmit` clean; `HANDHELD_SEEDS=12` 48/48;
`HANDHELD_SEEDS=12 HANDHELD_STRENGTH=1.5` 48/48; `DESK_SEEDS=10` desk test passes.

## Not shipped (Task 3 — local alignment)

Global homography alignment already exists. Parallax harness (`parallax.harness.ts`, near layer
displaced vs far layer, nothing changed) — false alarms in 8 unchanged scenes today:
0% → 0, 0.5%/1% zoom → 0, 1%/2% → 0, 2%/4% → 4 (2 at ≥85%), 3%/6% → 11 (3 at ≥85%).

Attempts, measured:
1. Dense Farneback flow on a downscaled pair, weighted Gaussian smoothing, clamp 4%: worse — even
   with no parallax the raw flow reached 128–698 px on textureless/repetitive areas; 6–8
   high-confidence false alarms per level.
2. Quadratic fit of ORB-match residuals after the homography (trimmed LS): parallax false alarms
   0 at every level, but the 1.5x hand-held sweep regressed 48/48 → 47/48 (portrait dark #9: the fit
   of pure noise, median residual 2.37 → 2.30 px, extrapolated to a 3.5 px field).
3. Same plus a significance gate (median residual gain ≥ 1 px and ≥ 30%, no extrapolation beyond
   match coverage): no regression, but parallax back to 4 / 11 — the gate also rejects real
   parallax because ORB matches concentrate on the far, textured layer (monitor text, plant);
   p90 residual gains overlap between parallax (0.23–1.99 px) and noise (0.14–0.24 px).

Per the plan's stop condition the refinement was reverted; nothing from Task 3 is committed.
A viable next step needs matches spread over the near layer (grid-bucketed features) or real
hand-held photo pairs to calibrate against.
