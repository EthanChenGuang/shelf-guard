# Google Stitch Reference Directory

**Purpose:** Store Google Stitch export screenshots and metadata for manual visual acceptance testing per D-19 and DSGN-04.

## Three Views

Phase 5 PRD fidelity is verified by side-by-side comparison of the React implementation against Stitch reference exports for:

| View | Screenshot file | App state |
|------|-----------------|-----------|
| Camera | `camera.png` | `CAMERA_IDLE` with PRD top bar, carousel dots, shutter |
| ROI setup | `roi.png` | `ROI_CONFIG` with light theme and 4-row dividers |
| Result inspect | `result.png` | `RESULT_INSPECT` with anomaly boxes and stat capsules |

## Adding Reference Screenshots

1. Export each view from Google Stitch (Minimalist Light preset).
2. Save exports to this directory using the filenames above.
3. Run the manual UAT checklist: [UAT-CHECKLIST.md](./UAT-CHECKLIST.md).

## Measurement Authority

All pixel-level measurements and color tokens are defined in:

`.planning/phases/05-prd-ui-multi-shelf-experience/05-UI-SPEC.md`

When Stitch exports and the UI spec disagree, the UI spec wins for implementation; update Stitch exports or document the deviation in UAT notes.

## Acceptance Method (v1)

- **Manual screenshot comparison** — Pass/Fail per checklist row (D-19, D-34).
- **No CI pixel diff** in v1 — automated visual regression deferred.

## Placeholder Status

Screenshot files are not committed until Stitch exports are available. Drop `camera.png`, `roi.png`, and `result.png` here when ready.
