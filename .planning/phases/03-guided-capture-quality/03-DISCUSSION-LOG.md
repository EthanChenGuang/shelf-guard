# Phase 3: Guided Capture Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-22
**Phase:** 3-Guided Capture Quality
**Mode:** --auto (all gray areas auto-selected with recommended defaults)
**Areas discussed:** Ghost Overlay Visibility, iOS Orientation Permission, Level Gauge Fallback, Live Camera Feed

---

## Ghost Overlay Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Always show ghost | Ghost visible in demo mode and on empty shelves | |
| Live-only + persisted baseline | Hide ghost in demo mode; hide when shelf has no persisted baseline | ✓ |
| Hide ghost entirely | Remove ghost feature | |

**Auto-selected:** Live-only + persisted baseline
**Notes:** `[auto] Ghost Overlay — Q: "When should ghost overlay render?" → Selected: "Only when live camera active AND shelf has persisted baseline" (recommended default)`

| Option | Description | Selected |
|--------|-------------|----------|
| Per-shelf opacity | Each shelf remembers ghost opacity | |
| Global opacity, default 45% | App-level state, not persisted | ✓ |

**Auto-selected:** Global opacity, default 45%

---

## iOS Orientation Permission

| Option | Description | Selected |
|--------|-------------|----------|
| Request on app mount | Prompt immediately | |
| Request on enable-camera gesture | Chain after getUserMedia on user tap | ✓ |
| Request on level crosshair tap | Separate gesture | |

**Auto-selected:** Request on enable-camera gesture
**Notes:** `[auto] iOS Orientation — Q: "When to request DeviceOrientation permission?" → Selected: "Same gesture as live camera enable" (recommended default)`

| Option | Description | Selected |
|--------|-------------|----------|
| Silent failure | No UI if denied | |
| Inline banner + retry | Same pattern as camera error banner | ✓ |

**Auto-selected:** Inline banner + retry

---

## Level Gauge Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Hide level gauge without sensor | Remove crosshair | |
| Always show; simulate on desktop | Keep crosshair; simulate toggle when no sensor | ✓ |
| Static "level OK" badge | Fake level state | |

**Auto-selected:** Always show; simulate on desktop only when no sensor detected
**Notes:** `[auto] Level Gauge — Q: "No-sensor fallback?" → Selected: "Simulate toggle for desktop QA; orientation banner on denied iOS" (recommended default)`

| Option | Description | Selected |
|--------|-------------|----------|
| Beta (pitch) axis | Forward/back tilt | |
| Gamma (roll) axis | Left/right tilt in portrait | ✓ |

**Auto-selected:** Gamma axis, ±1.5° threshold (existing implementation)

---

## Live Camera Feed

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-start camera on mount | Immediate live feed | |
| Demo-first, user opts in | Retain Phase 1 default | ✓ |

**Auto-selected:** Demo-first, user opts in
**Notes:** `[auto] Live Camera — Q: "Camera start behavior?" → Selected: "Demo-first default, opt-in live camera" (recommended default — Phase 1 D-10)`

---

## Claude's Discretion

- i18n key naming for orientation banner
- `hasPersistedBaseline` prop vs internal App derivation
- Banner stacking vs combined device-permissions banner

## Deferred Ideas

- PRD top bar polish (Phase 5)
- Ghost opacity IndexedDB persistence
- INITIAL_GUIDE for empty shelves (Phase 5)
