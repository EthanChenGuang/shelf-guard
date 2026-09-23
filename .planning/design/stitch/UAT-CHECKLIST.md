# Phase 5 Stitch Visual UAT Checklist

**Requirement:** DSGN-04  
**Decision:** D-19, D-34  
**Measurement authority:** [05-UI-SPEC.md](../../phases/05-prd-ui-multi-shelf-experience/05-UI-SPEC.md)  
**Method:** Manual side-by-side screenshot comparison — no CI pixel diff in v1

## Reference Screenshots

| View | Stitch export | Implementation screenshot | Status |
|------|---------------|---------------------------|--------|
| Camera | `camera.png` (drop when available) | Capture from dev build at `CAMERA_IDLE` | ☐ Ready |
| ROI setup | `roi.png` (drop when available) | Capture from dev build at `ROI_CONFIG` | ☐ Ready |
| Result inspect | `result.png` (drop when available) | Capture from dev build at `RESULT_INSPECT` | ☐ Ready |

**Instructions:** Place Google Stitch exports in `.planning/design/stitch/` using the filenames above. Capture implementation screenshots at 390×844 (iPhone 14 Pro logical) or device under test.

---

## Camera View (`camera.png` vs implementation)

| # | Criterion | Pass | Fail | Notes |
|---|-----------|:----:|:----:|-------|
| C1 | Top bar 3-zone layout: baseline pill (left), level badge (center), torch + language (right) | ☐ | ☐ | |
| C2 | Baseline pill shows established vs not-established copy with green pulse dot when established | ☐ | ☐ | |
| C3 | 5-dot carousel strip centered below top bar; active dot filled `#10B981` | ☐ | ☐ | |
| C4 | Camera shell background `#0F172A` (dark) | ☐ | ☐ | |
| C5 | Shutter: 76px double-ring outer diameter with breathing glow when ready | ☐ | ☐ | |
| C6 | Last-inspection thumbnail 48×48 bottom-right, border `#E2E8F0` | ☐ | ☐ | |
| C7 | Demo/Cam utility pill bottom-left (not in top bar) | ☐ | ☐ | |
| C8 | Glassmorphism on floating controls: `backdrop-blur-md bg-white/75`, rounded-full/2xl | ☐ | ☐ | |
| C9 | INITIAL_GUIDE overlay (empty shelf): 3-step full-screen overlay visible when no baseline | ☐ | ☐ | |
| C10 | Scan beam animation: cyan `#38BDF8`, 0.8s duration on inspection capture | ☐ | ☐ | |
| C11 | Bilingual toggle switches all visible strings immediately (`中` / `EN`) | ☐ | ☐ | |

---

## ROI Setup View (`roi.png` vs implementation)

| # | Criterion | Pass | Fail | Notes |
|---|-----------|:----:|:----:|-------|
| R1 | Light theme background `#F8FAFC` / `#FFFFFF` (not dark camera shell) | ☐ | ☐ | |
| R2 | 4 horizontal ROI divider lines with tier pills and magnifier on active tier | ☐ | ☐ | |
| R3 | Magnifier lens 80px diameter, 2× zoom reference (Phase 4 contract) | ☐ | ☐ | |
| R4 | Glassmorphism on floating controls and bottom drawer | ☐ | ☐ | |
| R5 | First-baseline hint copy visible when `isFirstBaseline === true` | ☐ | ☐ | |
| R6 | Primary CTA uses success accent `#10B981` | ☐ | ☐ | |
| R7 | Typography: primary `#0F172A`, secondary `#64748B` | ☐ | ☐ | |
| R8 | Bilingual copy on all ROI labels and buttons | ☐ | ☐ | |

---

## Result Inspect View (`result.png` vs implementation)

| # | Criterion | Pass | Fail | Notes |
|---|-----------|:----:|:----:|-------|
| S1 | Light theme background `#F8FAFC` / `#FFFFFF` | ☐ | ☐ | |
| S2 | MISSING anomaly box: `#EF4444` 2px border + 15% red fill | ☐ | ☐ | |
| S3 | MOVED/Displaced anomaly box: `#F59E0B` 2px border + 15% yellow fill | ☐ | ☐ | |
| S4 | Stat capsule chips: red/amber active states match anomaly hues | ☐ | ☐ | |
| S5 | Continuous tolerance slider 0–100 with preset ticks at 25/50/75 | ☐ | ☐ | |
| S6 | Glassmorphism on drawer controls and filter bar | ☐ | ☐ | |
| S7 | Long-press blink compare hint visible; baseline swap on hold | ☐ | ☐ | |
| S8 | Bilingual copy on stat labels, tolerance, and CTAs | ☐ | ☐ | |

---

## Cross-View Checks

| # | Criterion | Pass | Fail | Notes |
|---|-----------|:----:|:----:|-------|
| X1 | PRD token colors consistent across all three views (no arbitrary hex drift) | ☐ | ☐ | |
| X2 | View background split: camera dark, ROI/Result light (D-15) | ☐ | ☐ | |
| X3 | No segmented ShelfSelector in top bar (replaced by carousel dots) | ☐ | ☐ | |
| X4 | Shelf swipe 50px threshold switches shelves without mid-capture bleed | ☐ | ☐ | |

---

## Sign-Off

| Field | Value |
|-------|-------|
| Tester | |
| Date | |
| Build / commit | |
| Device / viewport | |
| Overall result | ☐ PASS ☐ FAIL |

**Fail criteria:** Any row marked Fail on a shipped criterion blocks DSGN-04 sign-off until remediated and re-checked.

**Pass criteria:** All rows Pass, or Fail rows documented as accepted deviation with rationale in Notes column.

---

*Authority: 05-UI-SPEC.md · D-19 manual verification path · D-34 phase gate*
