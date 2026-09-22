# Roadmap: ShelfGuard

## Overview

ShelfGuard v1 delivers a 30-second shelf inspection loop for retail field reps: capture a fixture photo, compare against a per-shelf baseline, and see exactly what's missing or displaced. This roadmap balances the user's UI-first priority (100% PRD fidelity + 5-shelf swipe carousel) with research-backed technical sequencing — camera/FSM hardening and multi-shelf storage migration must land before real vision and PRD polish sign-off, or mock data and quota bugs will mask core value failures.

## Phases

**Phase Numbering:**

- Integer phases (1–6): Planned v1 milestone work
- Decimal phases (e.g., 2.1): Urgent insertions via `/gsd-phase --insert`

- [x] **Phase 1: Capture Foundation & Vercel Deploy** - Retain Vite 8 pure-client PWA on Vercel, fix FSM/camera bugs, remove backend deps (completed 2026-09-22)
- [x] **Phase 2: Multi-Shelf Data Layer** - Namespaced IndexedDB schema with Blob storage and legacy migration before carousel UI (completed 2026-09-21)
- [ ] **Phase 3: Guided Capture Quality** - Ghost overlay, level gauge, and iOS orientation permission for aligned re-shoots
- [ ] **Phase 4: Real Inspection Pipeline** - Replace mock vision with ROI-scoped pixel diff, Web Worker analysis, and result interactions
- [ ] **Phase 5: PRD UI & Multi-Shelf Experience** - Minimalist Light design system, shelf carousel swipe, PRD animations, and i18n polish

## Phase Details

### Phase 1: Capture Foundation & Vercel Deploy

**Goal**: App runs as a Vite 8 pure-client PWA deployed to Vercel with no backend dependencies; users can reliably capture shelf photos without race conditions, silent camera failures, or broken demo-mode frames.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: TECH-01, TECH-02, TECH-03, TECH-05, TECH-07, STAB-01, STAB-02, STAB-03, STAB-04, CAM-08, CAM-09, PWA-01, PWA-02, PWA-03
**Success Criteria** (what must be TRUE):

  1. App builds with Vite 8 and deploys to Vercel static hosting; all camera/Canvas/IndexedDB code runs client-side in the SPA with no server-side business logic
  2. `@google/genai`, `express`, `dotenv` removed from dependencies; no backend or API routes for inspection workflow
  3. User cannot double-trigger the shutter during the 800ms scan animation; a second tap is ignored until capture completes
  4. User sees a clear in-app message (not console-only) when camera permission is denied or the stream fails — including iOS standalone PWA fallback guidance
  5. Demo mode captures the currently displayed frame, not a fixed CDN URL
  6. User sees an offline indicator when disconnected; PWA installable and usable offline via vite-plugin-pwa Service Worker (app shell only)
  7. When analysis exceeds the scan animation duration, the UI transitions to a visible PROCESSING state instead of appearing frozen

**Plans**: 6/6 plans executed

Plans:

- [x] 01-06-PLAN.md — G-01-4 gap closure: raise offline pill to bottom-28 + fix shutter-top layout test
- [x] 01-05-PLAN.md

**Wave 1**

- [x] 01-01-PLAN.md — Docs reconciliation (Vite stack) + Vitest Wave 0 scaffold
- [x] 01-02-PLAN.md — Vercel deploy tracer + demo capture fix + dependency hygiene

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-03-PLAN.md — FSM stability (shutter lock, PROCESSING, torch, baseline dimensions)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Camera error banner + offline indicator i18n + verification gate

**UI hint**: yes

### Phase 2: Multi-Shelf Data Layer

**Goal**: Five independent shelf datasets (baseline + history) persist correctly in IndexedDB with efficient Blob storage and safe migration from the legacy single-shelf schema.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: TECH-04, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, SHLF-02, SHLF-03, SHLF-04
**Success Criteria** (what must be TRUE):

  1. User's baseline and inspection history for shelf A do not appear when switching to shelf B — data is fully isolated per shelf (0–4)
  2. User reopens the app and lands on the same shelf they last selected
  3. Existing single-key baseline data from the brownfield prototype migrates automatically to shelf-1 without user action
  4. User sees a friendly storage-full message (not console-only) if IndexedDB quota is exceeded
  5. Per-shelf history stays bounded (≤20 records) with compressed thumbnails so five shelves don't exhaust device storage

**Plans**: 3/3 plans executed in 3 waves

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Wave 0: fake-indexeddb, blobUtils, persisted types, shelfStorage migration & CRUD
- [x] 02-02-PLAN.md — Wave 1 tracer: App shelf isolation, objectUrlRegistry, ShelfSelector, integration tests (D-16)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-03-PLAN.md — Wave 2: quota banner, thumbnail compression, FIFO history cap, phase verification gate

### Phase 3: Guided Capture Quality

**Goal**: Users can align re-shoots with the baseline using ghost overlay and a working level gauge — including iOS orientation permission — before vision analysis runs.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: CAM-01, CAM-02, CAM-03, CAM-07
**Success Criteria** (what must be TRUE):

  1. User sees a full-screen rear-camera live view (or demo baseline stream) on the camera main screen
  2. User sees the baseline ghost overlay at default 45% opacity and can adjust transparency via the right-side vertical slider
  3. User sees the crosshair level gauge snap to mint green with haptic feedback when tilt is within ±1.5°
  4. On iOS, orientation permission is requested on a user gesture and the level gauge works after grant

**Plans**: 2/3 plans executed

Plans:

**Wave 1**

- [x] 03-01-PLAN.md — Tracer: ghost overlay visibility (live + persisted baseline only)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — iOS orientation permission, level gauge hardening, denied banner

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 03-03-PLAN.md — Shelf ghost integration test + phase verification gate (iOS device check)

**UI hint**: yes

### Phase 4: Real Inspection Pipeline

**Goal**: Users get real missing/displaced detection from client-side pixel diff per ROI tier — with interactive result review — replacing all mock anomaly data.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: TECH-06, VIS-01, VIS-02, VIS-03, VIS-04, ROI-01, ROI-02, ROI-03, ROI-04, ROI-05, RSLT-01, RSLT-02, RSLT-03, RSLT-04, RSLT-05, RSLT-06
**Success Criteria** (what must be TRUE):

  1. User completes first capture on a shelf with no baseline and calibrates 4 draggable ROI dividers with magnifier assist, then saves a per-shelf baseline
  2. User captures a follow-up photo and sees red (missing) and yellow (displaced) bounding boxes from client-side diff (`@techstark/opencv-js` or Canvas pixel library in Web Worker) — not hardcoded mock anomalies
  3. User adjusts the tolerance slider and anomaly boxes update from a re-run diff pipeline, not pre-filtered mock data
  4. User long-presses to blink-compare against the baseline; tap-to-dismiss removes false-positive boxes and decrements counts
  5. Scan-line animation plays smoothly for 0.8s while diff runs in a Web Worker without UI jank
  6. User taps "Complete inspection" and returns to the current shelf's camera main screen

**Plans**: TBD
**UI hint**: yes

### Phase 5: PRD UI & Multi-Shelf Experience

**Goal**: Users experience 100% PRD-fidelity UI across all three views — including 5-shelf swipe carousel, Stitch-aligned design tokens, PRD animations, and bilingual copy.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: DSGN-01, DSGN-02, DSGN-03, DSGN-04, SHLF-01, SHLF-05, CAM-04, CAM-05, CAM-06, I18N-01, I18N-02
**Success Criteria** (what must be TRUE):

  1. User swipes left/right between 5 shelves with a clear active-shelf indicator; each shelf loads its own ghost overlay and baseline state
  2. User on a shelf with no baseline sees INITIAL_GUIDE (not a silent demo baseline) and is walked through first-time setup
  3. All three views match Minimalist Light design tokens — colors, rounded corners, glassmorphism containers, and shadows — verified against Google Stitch design output
  4. Camera view shows PRD-spec top bar (baseline pill, level badge, torch + language toggle), 76px breathing shutter, 0.8s scan-line transition, and last-inspection thumbnail
  5. User switches 中文/English and all three-view copy updates; language preference persists across sessions

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Capture Foundation & Vercel Deploy | 6/6 | Complete    | 2026-09-22 |
| 2. Multi-Shelf Data Layer | 3/3 | Complete    | 2026-09-21 |
| 3. Guided Capture Quality | 2/3 | In Progress|  |
| 4. Real Inspection Pipeline | 0/TBD | Not started | - |
| 5. PRD UI & Multi-Shelf Experience | 0/TBD | Not started | - |

---
*Roadmap created: 2026-09-20*
*Last updated: 2026-09-20 after tech stack constraint alignment*
*Requirements mapped: 54/54 v1*
