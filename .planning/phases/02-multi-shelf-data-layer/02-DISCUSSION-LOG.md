# Phase 2: Multi-Shelf Data Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-21
**Phase:** 2-Multi-Shelf Data Layer
**Areas discussed:** Legacy migration target, Blob cutover strategy, History cap & thumbnail compression, Phase 2 App wiring depth, Quota-exceeded UX

---

## Legacy Migration Target

| Option | Description | Selected |
|--------|-------------|----------|
| Shelf 0 | User-facing "Shelf 1" = index 0; default active shelf | ✓ |
| Shelf 1 | Literally index 1; shelf 0 stays empty | |
| Other | Custom numbering | |

**User's choice:** Shelf 0 (option 1), then auto-accept recommended for remaining questions.
**Notes:** Also migrate audit history to shelf 0; delete legacy keys after success; write `shelfguard_schema_version: 2` marker.

---

## Blob Cutover Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy migrate + adapter | Convert data URLs on read; keep component-facing URL helper | ✓ (hybrid) |
| Break interface now | `imageBlob` at storage layer; object URLs at render via helper | ✓ |
| Dual-read window | Support both formats indefinitely | |

**User's choice:** Recommended hybrid — one-time migration converts data URLs to Blobs; storage boundary uses Blob; components get resolved object URLs via helper; no indefinite dual-read.

---

## History Cap & Thumbnail Compression

| Option | Description | Selected |
|--------|-------------|----------|
| 20 records, 320px, Q0.75, FIFO | Per REQUIREMENTS DATA-05; oldest evicted first | ✓ |
| Keep 50 global cap | Current code behavior | |
| Quality-based eviction | Keep highest compliance audits | |

**User's choice:** Recommended — 20 per shelf, 320px thumbnails, JPEG 0.75, FIFO eviction.

---

## Phase 2 App Wiring Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Storage + tests only | No UI shelf switch | |
| Hidden dev picker | Debug-only switcher | |
| activeShelfId + temp selector | Minimal dropdown/segmented control for QA | ✓ |

**User's choice:** Recommended — wire `activeShelfId` in App.tsx, temporary functional selector (not PRD carousel), plus integration tests for isolation.

---

## Quota-Exceeded UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline banner | Same pattern as camera error banner (Phase 1 D-07) | ✓ |
| Modal | Full-screen interrupt | |
| Console only | Current partial behavior | |

**User's choice:** Recommended — inline banner, block failed writes, surface on baseline save / audit append / migration failure; I18N copy with guidance text, no delete UI in Phase 2.

---

## Claude's Discretion

Blob serialization details, selector UI control type, optional `useActiveShelf` hook extraction, test file layout, exact I18N key names.

## Deferred Ideas

PRD swipe carousel (Phase 5), INITIAL_GUIDE (Phase 5), delete-audit management UI, per-shelf tolerance/language, full hook decomposition.
