# Project Research Summary

**Project:** ShelfGuard
**Domain:** Retail shelf inspection PWA — fixed-display planogram compliance via baseline photo diff
**Researched:** 2026-09-20
**Confidence:** HIGH

## Executive Summary

ShelfGuard is a **local-first, offline-capable PWA** for cosmetics retail field reps who need 30-second clarity on missing and displaced products across up to five fixed display fixtures. Industry leaders (Trax, FORM, Tevian) solve this with enterprise SKU image recognition and cloud backends; ShelfGuard's differentiated bet is **baseline-photo pixel diff per ROI tier** on-device, with optional Gemini Vision refinement for ambiguous cases — no IT integration required for pilot stores.

Research strongly recommends **extending the existing brownfield stack** (React 19 + Vite 8 + Tailwind 4 + idb-keyval + vite-plugin-pwa) rather than introducing OpenCV.js, TensorFlow.js, Redux, or a backend. The vision pipeline should be: Canvas ROI band extraction → `pixelmatch` diff → inline connected-components → MISSING/MOVED classification, optionally escalated to Gemini 2.5 Flash via **server-side API proxy** (never client-bundled keys). Architecture decomposes monolithic `App.tsx` into three hooks (`useShelfSession`, `useInspectionFlow`, `useAppSettings`) and a staged `lib/vision/` module without new state libraries.

The dominant risks are **not stack choices but brownfield traps**: mock vision masking missing core value, iOS PWA camera/orientation failures, naive pixel diff without alignment producing false-positive floods, and IndexedDB quota blowout when scaling to 5 shelves. Mitigation order is explicit: harden camera and FSM first, migrate storage schema before multi-shelf UI, gate capture quality (level sensor + alignment), then ship real diff behind golden-image tests. Gemini and homography auto-align belong in v1.x after client diff is validated on real fixture photos.

## Key Findings

### Recommended Stack

Keep the validated foundation; add a minimal vision layer. No framework migration, no WASM OpenCV, no Express backend for v1.

**Core technologies:**
- **React 19 + Vite 8 + Tailwind 4 + TypeScript 7** — brownfield FSM and PRD UI already wired; zero migration cost
- **pixelmatch 7.2.0 + Canvas 2D + inline connected-components** — browser-native ROI diff without 8 MB OpenCV.js WASM
- **comlink 4.4.2 + Web Worker/OffscreenCanvas** — keeps 0.8s scan animation responsive on mid-range Android
- **idb-keyval 6.3.0 (namespaced keys + Blob storage)** — 5 isolated shelf datasets without full `idb` migration
- **@google/genai 2.23.0 + zod + zod-to-json-schema** — optional Gemini 2.5 Flash with structured `DetectedAnomaly[]` output (v1.x)
- **motion 13.4.0** — activate existing dependency for PRD scan line, shelf swipe, magnifier animations

**Critical version constraints:** Images must be same dimensions before pixelmatch; tolerance maps to threshold (0.05/0.10/0.18) + min blob area; Gemini requires `propertyOrdering` on JSON schemas; store images as JPEG Blobs not base64 DataURLs.

### Expected Features

**Must have (table stakes):**
- **Guided photo capture** with ghost overlay + level gauge — fixed-fixture re-shoot alignment
- **Real client-side pixel diff** replacing mock — region-level MISSING/MOVED per 4 ROI tiers
- **5-shelf isolated baseline + history** — swipe between fixtures without cross-contamination
- **Visual anomaly map + compliance summary** — red/yellow boxes, stat capsule, tolerance slider with live re-analysis
- **Sub-60-second audit loop** — capture → result offline on mid-tier phone
- **INITIAL_GUIDE when no baseline** — no silent demo baseline in production path
- **Offline PWA shell** — full audit loop in airplane mode
- **PRD UI fidelity** — Minimalist Light tokens, 0.8s scan line, zh/en i18n

**Should have (competitive):**
- **Hybrid client diff + optional Gemini** — offline speed first, AI precision for ambiguous regions (v1.x)
- **Capture quality gate** — blur/glare/tilt warnings beyond level gauge (P2)
- **Per-row tolerance presets** — top-row glare vs bottom-row shadows (v1.x)
- **Export/share audit report** — manager proof outside app (v1.x)

**Defer (v2+):**
- SKU-level image recognition, share-of-shelf, price OCR, HQ dashboard, multi-store SaaS, homography auto-align (spike only if ghost overlay insufficient), photo stitching for wide bays

### Architecture Approach

ShelfGuard v1 is a **client-only PWA** with shelf-scoped data partitions, a tiered vision pipeline (client diff always → optional Gemini), and hook-based state decomposition. `App.tsx` becomes a thin coordinator (~80 lines); `useShelfSession(shelfId)` owns per-shelf baseline/history; `useInspectionFlow()` drives the FSM via `useReducer`; `VisionRouter` in `lib/vision/router.ts` preserves `analyzeShelfCapture()` as the stable public API.

**Major components:**
1. **ShelfStore + ImageBlobStore** — namespaced IndexedDB keys (`shelf:{n}:*`), Blob not base64, legacy migration to `shelf-1`
2. **ClientDiffEngine** — ROI band extraction, pixelmatch, connected components, MISSING/MOVED by centroid delta
3. **GeminiRefiner (optional)** — cropped ROI JPEGs, structured JSON, graceful offline degradation
4. **ShelfCarousel + per-shelf ghost overlay** — `activeShelfId` persisted in global settings
5. **Service Worker** — app shell only; never cache user images or API responses

### Critical Pitfalls

1. **iOS standalone PWA camera silently fails** — add stream health probe, standalone-mode detection, "Open in Safari" fallback; test installed PWA not just Safari tab
2. **Device orientation level gate inert on iOS** — `DeviceOrientationEvent.requestPermission()` on user gesture; block shutter until level or explicit override
3. **Naive pixel diff without registration** — ROI-scoped diff with luminance normalization, min blob area, alignment rejection; tolerance must re-run pipeline not filter mock anomalies
4. **Demo mode captures wrong image** — unify capture to rasterize displayed frame; fix `useCameraStream.ts` CDN short-circuit before any vision work
5. **IndexedDB quota exhaustion at 5 shelves** — Blob storage, 320px thumbs, 20-record cap/shelf, `storage.estimate()` monitoring, QuotaExceededError in UI not console

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: App FSM Refactor & Camera Hardening
**Rationale:** Shutter race (unguarded 800ms timeouts) and demo-capture bug become catastrophic once async vision lands; iOS PWA camera failures block any field pilot. Must precede vision and multi-shelf UI.
**Delivers:** `useInspectionFlow` reducer with guarded transitions; `PROCESSING` mode wired; capture-in-flight lock; unified `captureElementToDataUrl()`; stream health probe; `cameraError` surfaced in UI; simulation banner until real vision passes golden tests
**Addresses:** Sub-60-second loop reliability, guided capture foundation, shutter quality gate wiring
**Avoids:** Pitfalls 4 (demo wrong frame), 7 (shutter race), 1 (iOS PWA camera), 8 (mock masking gaps)

### Phase 2: Multi-Shelf Storage Migration
**Rationale:** Storage schema must exist before carousel UI ships; 5× base64 DataURLs will hit QuotaExceededError within weeks. Pitfall research explicitly says "design schema before UI swipe."
**Delivers:** `ShelfProfile` types, namespaced idb-keyval keys, Blob image store, legacy `shelfguard_baseline` → `shelf-1` migration, per-shelf history cap (20), quota monitoring, persistent storage request
**Addresses:** 5-shelf isolated baseline + history (table stakes), audit history per shelf
**Avoids:** Pitfall 5 (IndexedDB quota), Anti-pattern: shared baseline across shelves

### Phase 3: Orientation & Capture Quality Gate
**Rationale:** Pixel diff inherits bad geometry from tilted captures; iOS orientation permission must be fixed before vision tuning or golden tests are meaningless.
**Delivers:** iOS `requestPermission()` flow; level-gated shutter (±1.5°); manual override with warning; torch capability check; capture thumbnail confirmation before analysis
**Addresses:** Level gauge + haptic snap, capture quality gate (P2 core subset)
**Avoids:** Pitfall 2 (inert orientation on iOS), perspective skew false positives

### Phase 4: Client Vision Pipeline (Core Value)
**Rationale:** This is the product — everything else is UX wrapper. Replace mock before removing simulation banner. Multi-shelf UI polish can proceed in parallel only after storage (Phase 2) is done.
**Delivers:** `lib/vision/` staged module (preprocess → clientDiff → postprocess); pixelmatch per ROI tier; connected-components bboxes; MISSING/MOVED classification; tolerance re-analysis on stored capture pair; Web Worker via comlink; golden image test set (<5% FP/FN target); remove `INITIAL_MOCK_ANOMALIES`
**Uses:** pixelmatch, comlink, Canvas/OffscreenCanvas, Vitest for threshold tuning
**Implements:** ClientDiffEngine, VisionRouter (client-only path)
**Avoids:** Pitfalls 3 (naive diff), 6 (React data URL perf), 8 (mock false confidence); Anti-patterns: full-frame diff, Gemini-first pipeline

### Phase 5: Multi-Shelf UI & PRD Polish
**Rationale:** Depends on Phase 2 storage and Phase 4 real diff; UI without working detection creates false QA sign-off (current brownfield trap).
**Delivers:** `ShelfCarousel` swipe UX; per-shelf ghost overlay; `INITIAL_GUIDE` per shelf; 4-row ROI dividers persisted per shelf; result annotations + blink compare; tolerance slider; motion animations (scan line 0.8s, magnifier); bundled default baseline in `public/` for offline demo
**Addresses:** Three-view FSM, ghost overlay, ROI calibration, result screen, PRD UI/UX fidelity, multi-fixture swipe UX
**Avoids:** Wrong-shelf comparison, silent demo baseline, CDN offline failure

### Phase 6: Optional Gemini Refinement (v1.x)
**Rationale:** Client diff must be validated first; Gemini adds network dependency and server integration complexity. Hybrid routing is a differentiator but not launch blocker.
**Delivers:** Server-side Gemini proxy (AI Studio pattern); `GeminiRefiner` with zod schema; escalation on low confidence or user opt-in; cropped ROI JPEGs only; graceful offline skip with badge
**Uses:** @google/genai 2.23.0, zod, zod-to-json-schema, Gemini 2.5 Flash
**Avoids:** Client-side API key exposure, cloud-only pipeline, blocking 30-second loop on network

### Phase Ordering Rationale

- **Camera/FSM before vision:** Known one-line bugs (demo capture, shutter race) have catastrophic downstream impact; async vision exposes races mock analysis hides
- **Storage before multi-shelf UI:** Schema migration is cheaper than retrofitting after UI ships; quota math requires Blob storage from day one of 5-shelf model
- **Orientation before golden tests:** Diff tuning on tilted captures wastes calibration effort
- **Real diff before PRD polish sign-off:** Prevents "Looks Done But Isn't" — polished anomaly boxes on mock data already fooled stakeholders
- **Gemini last:** Offline-first is core value prop; cloud is refinement not foundation

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Client Vision):** Pixelmatch threshold tuning for retail lighting variance; connected-component min area per ROI tier; whether ghost overlay alone suffices or phase-correlation pre-alignment (~100 LOC) is needed — `/gsd-plan-phase --research-phase 4`
- **Phase 3 (Orientation):** Which DeviceOrientation axis maps to roll for portrait fixed-mount shelf shots — device-specific validation required
- **Phase 6 (Gemini):** AI Studio server-side proxy wiring vs Cloudflare Worker fallback if deploying outside AI Studio

Phases with standard patterns (skip research-phase):
- **Phase 1 (FSM/Camera):** React useReducer FSM, getUserMedia health checks — well-documented MDN/web.dev patterns
- **Phase 2 (Storage):** idb-keyval namespaced keys, Blob migration — documented in Jake Archibald's custom stores guide
- **Phase 5 (UI Polish):** motion/Framer Motion animations, CSS scroll-snap carousel — existing PRD specs + declared dependencies

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm versions verified 2026-09-20; brownfield foundation validated in codebase STACK.md; pixelmatch/OpenCV trade-off clear |
| Features | MEDIUM | Industry patterns corroborated across multiple vendor sources; individual vendor time claims unverified; MVP scope well-aligned with PROJECT.md |
| Architecture | MEDIUM | Hook decomposition and vision staging match brownfield constraints; Blob storage recommendation strong; Gemini security note has ARCHITECTURE vs STACK tension (server proxy is authoritative) |
| Pitfalls | HIGH | iOS PWA camera/orientation bugs cross-checked with WebKit/MDN; codebase CONCERNS.md validates known bugs |

**Overall confidence:** HIGH

### Gaps to Address

- **Alignment sufficiency:** Ghost overlay + level gauge may not eliminate 2–5° viewpoint drift false positives — plan golden test set on real fixture photos early in Phase 4; spike phase-correlation before considering OpenCV.js
- **Gemini deployment path:** Confirm AI Studio server-side Gemini capability (`metadata.json`) vs need for Vite proxy/Cloudflare Worker — resolve in Phase 6 planning
- **Capture quality gate scope:** Blur/glare detection complexity unclear for v1 — defer full Tevian-style gate to P2 unless golden tests show level gate insufficient
- **History cap discrepancy:** FEATURES.md suggests 50/shelf, STACK.md recommends 20/shelf — pick 20 during Phase 2 planning based on quota math
- **ARCHITECTURE.md Gemini key note:** Document mentions Vite define or user-pasted key — contradicts STACK/PITFALLS server-proxy-only rule; enforce server-side in implementation

## Sources

### Primary (HIGH confidence)
- npm registry (live `npm view` 2026-09-20) — package versions: pixelmatch, @google/genai, comlink, motion, zod
- [pixelmatch README](https://github.com/mapbox/pixelmatch) — browser ImageData API, threshold/windowSize
- [Google AI Structured Outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) — responseJsonSchema, propertyOrdering
- [MDN getUserMedia / DeviceOrientationEvent.requestPermission](https://developer.mozilla.org/) — camera and iOS permission model
- [WebKit Bugs 252465, 273938](https://bugs.webkit.org/) — standalone PWA camera failures
- [web.dev Storage for the web](https://web.dev/articles/storage-for-the-web) — quota, Blob vs base64, persistent storage
- ShelfGuard `.planning/PROJECT.md`, `.planning/codebase/STACK.md`, `.planning/codebase/CONCERNS.md` — brownfield constraints and known bugs

### Secondary (MEDIUM confidence)
- Enterprise shelf audit vendors (Trax, FORM, Tevian, Planofy, ShelfAlign) — feature landscape and table stakes
- [Context7 /googleapis/js-genai](https://github.com/googleapis/js-genai) — multimodal generateContent patterns
- [Shelf Analytics threshold tuning](https://www.shelfanalytics.org/) — tolerance calibration, preprocessing requirements
- [Nature Sci Reports planogram CV pipeline](https://www.nature.com/articles/s41598-025-27773-5) — viewpoint/partial capture challenges

### Tertiary (LOW confidence)
- OpenCV.js bundle size estimates (~8 MB) — needs validation on target iOS devices if alignment spike triggered
- Hybrid edge/cloud pipeline blog posts — routing pattern only, not ShelfGuard-specific benchmarks

---
*Research completed: 2026-09-20*
*Ready for roadmap: yes*
