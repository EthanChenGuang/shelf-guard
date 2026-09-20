# Stack Research

**Domain:** Retail shelf inspection PWA — hybrid client Canvas diff + optional Gemini Vision
**Researched:** 2026-09-20
**Confidence:** HIGH (core stack verified against npm + official docs); MEDIUM (vision tuning parameters)

## Scope Note

This research covers **additions and upgrades** to the existing ShelfGuard brownfield stack (React 19 + Vite 8 + Tailwind 4). It does not re-evaluate the validated foundation documented in `.planning/codebase/STACK.md`.

---

## Recommended Stack

### Core Technologies (Keep — Already Validated)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| React | **19.0.1** | UI, FSM, camera views | Brownfield prototype already ships three-view FSM; React 19 stable with hooks-based state machine in `App.tsx` | HIGH |
| Vite | **8.3.0** | Dev server, build, HMR | Fast mobile iteration; `@vitejs/plugin-react` 6.1.1 + `@tailwindcss/vite` 4.3.3 already wired | HIGH |
| Tailwind CSS | **4.3.3** | PRD Minimalist Light tokens | Utility-first matches PRD design-token workflow; no CSS-in-JS migration cost | HIGH |
| TypeScript | **7.0.2** | Type safety across vision pipeline | Strict typing for anomaly schemas, ROI geometry, shelf IDs | HIGH |
| vite-plugin-pwa | **1.3.0** | Offline shell, auto-update SW | Already configured with `registerType: 'autoUpdate'`; Workbox precaches app shell only | HIGH |
| idb-keyval | **6.3.0** | Local persistence (baseline, history, settings) | 600-byte API surface; stores Blobs/DataURLs; extend with namespaced keys for 5 shelves | HIGH |

### Vision Pipeline — Client-Side (Add)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **pixelmatch** | **7.2.0** | Perceptual pixel diff on Canvas `ImageData` | Zero dependencies, ~150 lines, works on raw `Uint8ClampedArray`; anti-aliasing detection + `windowSize` option reduces lighting speckle false positives; standard choice for browser image regression since Mapbox adoption | HIGH |
| **Native Canvas 2D API** | — | Image load, crop, ROI band extraction, resize | No library needed for draw/scale/crop; `createImageBitmap()` for async decode off critical path; target 1080×1920 capture already in `useCameraStream.ts` | HIGH |
| **Inline connected-components** | — (no npm dep) | Diff mask → bounding boxes | After pixelmatch, run 8-connected BFS on binary mask per ROI band (~80 LOC); avoids 8 MB OpenCV.js WASM for contour extraction; industry pattern (screenshot-diff tooling) | MEDIUM |
| **comlink** | **4.4.2** | Web Worker RPC for vision pipeline | Keeps 0.8s scan animation responsive; transfer `ImageData` buffers via structured clone; simpler than raw `postMessage` for `analyzeShelfCapture()` refactor | HIGH |
| **OffscreenCanvas** (browser API) | — | Worker-side canvas ops | Supported in Chrome/Android WebView, Safari 16.4+; fallback to main-thread for older iOS if needed | MEDIUM |

**Client diff pipeline (prescriptive):**

```
capture DataURL → decode (createImageBitmap) → align/resize to baseline dims
→ split into 4 ROI bands (existing splitYPercentages)
→ per-band: pixelmatch → binary mask → connected components → normalized bboxes
→ classify MISSING (baseline blob gone) vs MOVED (shifted blob) by centroid delta
→ merge anomalies → InspectionAnalysisResult
```

Tolerance mapping (`strict` / `normal` / `loose`) maps to pixelmatch `threshold` (0.05 / 0.10 / 0.18) and minimum component area — not separate algorithms.

### Vision Pipeline — Cloud Refinement (Add / Upgrade)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **@google/genai** | **2.23.0** (upgrade from ^2.4.0) | Gemini Vision API SDK | Official JS SDK for Gemini 2.0+; supports `generateContent` with inline base64 images + `responseJsonSchema` for typed anomaly output; already declared, unused in `src/` | HIGH |
| **Gemini 2.5 Flash** | model ID `gemini-2.5-flash` | Optional precision pass | Best speed/cost for mobile retail audit; multimodal, bounding-box detection, structured JSON; use when user enables cloud check or client diff confidence < threshold | HIGH |
| **zod** | **4.6.5** | Anomaly response schema | Define `DetectedAnomaly[]` schema once; convert via `zod-to-json-schema` for SDK `responseJsonSchema` | HIGH |
| **zod-to-json-schema** | **3.25.2** | Zod → JSON Schema bridge | Cleaner than hand-writing OpenAPI schema objects; Gemini 2.x requires `propertyOrdering` on object schemas | HIGH |

**Hybrid invocation rule:** Client diff always runs (offline-capable). Gemini runs only when:
1. User toggles "AI verify" in settings, OR
2. Client pipeline returns `confidence < 0.6` (e.g., >30% diff pixels in any ROI band).

Send **cropped ROI JPEGs** (not full 1080×1920) to stay under 20 MB inline limit and reduce token cost. Deployment via **AI Studio server-side Gemini** (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` in `metadata.json`) — API key never ships to browser bundle.

### Multi-Shelf Storage (Extend Existing)

| Pattern | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| **Namespaced idb-keyval keys** | idb-keyval 6.3.0 | 5 independent shelf datasets | Prefix keys: `shelf:{0-4}:baseline`, `shelf:{0-4}:history`, `shelf:activeIndex`; single store, atomic `setMany`; no migration to `idb` full library needed for v1 | HIGH |
| **History cap per shelf** | — | Storage quota management | Keep last 20 records per shelf (not 50 global); ~5 shelves × (baseline ~200KB + 20 thumbs ~50KB) ≈ 1–2 MB total — well within IndexedDB quota | HIGH |
| **JPEG compression** | Canvas API | Baseline/thumbnail storage | `canvas.toDataURL('image/jpeg', 0.85)` for baselines, `0.70` for history thumbs; avoid PNG DataURLs (3–5× larger) | HIGH |

### UI / Motion (Activate Existing)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **motion** (Framer Motion) | **13.4.0** | PRD scan line, shelf swipe, magnifier | Already in `package.json` but unused; declarative spring/tween for 0.8s scan line, horizontal shelf carousel, opacity cross-fades — less error-prone than raw CSS keyframes for PRD-timed specs | HIGH |
| **lucide-react** | **0.546.0** | Icons | Already used across components; keep | HIGH |
| **canvas-confetti** | **1.9.4** | Audit completion celebration | Already wired in `ResultInspectView.tsx`; keep | HIGH |

### Development Tools

| Tool | Purpose | Notes | Confidence |
|------|---------|-------|------------|
| **Vitest** + **@vitest/browser** | Vision pipeline unit tests | Add for `pixelmatch` threshold tuning, connected-component bbox extraction; run headless Canvas via `happy-dom` or browser mode | MEDIUM |
| **Playwright** | PWA camera flow E2E | Optional phase-2; mock `getUserMedia` for CI | LOW |
| `tsc --noEmit` | Type checking | Existing `npm run lint`; keep | HIGH |

---

## Installation

```bash
# Vision pipeline (client)
npm install pixelmatch comlink

# Vision pipeline (cloud refinement)
npm install @google/genai@^2.23.0 zod zod-to-json-schema

# Activate PRD animations (already declared — ensure installed)
npm install motion@^13.4.0

# Dev — vision unit tests (recommended)
npm install -D vitest happy-dom @types/pixelmatch
```

```bash
# Remove dead weight (optional cleanup)
npm uninstall express dotenv
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| pixelmatch + inline CCL | **OpenCV.js** (@dusion/opencv-js 4.10) | Need homography alignment, feature matching, or lens distortion correction — adds 7.7 MB WASM + memory management burden |
| pixelmatch + inline CCL | **ppu-ocv/canvas-web** 5.x | Want maintained connected-components + canvas utils without OpenCV; adds dependency for logic achievable in ~80 LOC |
| pixelmatch | **resemblejs** 5.0 | Never for browser PWA — pulls `node-canvas` optional dep, ultra-low-maintenance status, heavier API |
| idb-keyval namespaced keys | **idb** (Jake Archibald) 8.x | Need multi-store transactions, schema migrations, or indexed queries across shelves — defer until v2 multi-store SaaS |
| comlink Web Worker | **Main-thread only** | Acceptable for MVP spike; unacceptable for PRD 0.8s scan animation on mid-range Android |
| Gemini 2.5 Flash | **Gemini 2.5 Pro** | Higher accuracy on ambiguous planograms; 3–5× latency/cost — use for batch re-audit, not 30-second field workflow |
| motion | **CSS @keyframes only** | Zero-dependency animations; viable for scan line only, but shelf swipe + magnifier + FSM transitions exceed maintainability threshold |
| zod + zod-to-json-schema | **SDK `Type` enum** | Simpler if schema is static; zod wins when anomaly schema evolves with PRD |

---

## What NOT to Use

| Avoid | Why | Use Instead | Confidence |
|-------|-----|-------------|------------|
| **OpenCV.js full bundle** | 7.7–8 MB WASM; iOS Safari memory pressure; initialization delay kills 30-second audit UX | pixelmatch + Canvas 2D + inline CCL | HIGH |
| **TensorFlow.js / ONNX Runtime Web** | Object detection overkill for planogram *change* detection; model load 5–20 MB; training pipeline out of v1 scope | pixelmatch diff + optional Gemini for semantic labels | HIGH |
| **resemblejs** | Node-canvas coupling, global mutable settings, maintenance mode | pixelmatch | HIGH |
| **Server backend (Express/Fastify)** | v1 is single-device local PWA; `express` already declared but unused | IndexedDB + optional AI Studio server-side Gemini proxy | HIGH |
| **Caching baseline images in Service Worker** | Workbox precache bloat; stale baseline risk; user data belongs in IndexedDB | idb-keyval; SW caches app shell + fonts only | HIGH |
| **Client-side GEMINI_API_KEY via Vite define** | Key extraction from bundle; violates AI Studio server-side capability pattern | AI Studio secrets injection / server-side proxy | HIGH |
| **Supabase / Firebase for v1** | No auth, no multi-store sync in scope; adds network dependency to offline-first workflow | idb-keyval namespaced keys | HIGH |
| **Capacitor / React Native shell** | PRD explicitly PWA-first; native wrapper adds store friction | vite-plugin-pwa + manifest | HIGH |
| **@techstark/opencv-js** | Same WASM weight class as OpenCV.js; TypeScript wrappers don't reduce download size | pixelmatch | HIGH |

---

## Stack Patterns by Variant

### If offline-only audit (no network)

- Run pixelmatch pipeline in Web Worker; skip `@google/genai` entirely.
- Because store staff may have no connectivity on shop floor; client diff must produce usable MISSING/MOVED boxes alone.
- Set Gemini toggle default OFF; degrade gracefully with "AI verify unavailable" badge.

### If lighting variance causes false positives

- Add **pre-diff normalization**: convert ROI bands to grayscale, optional histogram equalization via Canvas `filter` or manual LUT (~20 LOC).
- Increase pixelmatch `windowSize: 16` to require dense diff clusters, not scattered speckle.
- Because retail environments have uneven spot lighting between morning/evening captures.

### If camera alignment drifts between captures

- v1: rely on ghost overlay + level indicator (existing) for user alignment.
- v2 spike only: lightweight phase correlation on ROI bands (~100 LOC) before declaring OpenCV.js.
- Because homography is the #1 complexity trap in shelf-audit CV — defer until client diff proves insufficient.

### If IndexedDB quota exceeded

- Compress history thumbs aggressively (0.60 JPEG quality, max 320px width).
- Purge dismissed anomaly snapshots; keep only metadata + thumb per record.
- Because 5 shelves × high-res PNG baselines can exceed mobile quota (~50–500 MB depending on browser).

### If deploying outside AI Studio

- Add minimal Vite proxy or Cloudflare Worker for Gemini calls.
- Never embed API key in `import.meta.env` client bundle — use server-side route.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @google/genai@2.23.0 | Gemini 2.5 Flash / 2.0 Flash | SDK requires Gemini 2.0+; structured output needs `propertyOrdering` on Gemini 2.0 models |
| pixelmatch@7.2.0 | Canvas ImageData (RGBA) | Images must be same dimensions; resize baseline and capture to common size before diff |
| vite-plugin-pwa@1.3.0 | Vite 8.x, Workbox 7.x | Default 2 MiB precache limit — app bundle only; do not precache user images |
| motion@13.4.0 | React 19 | Framer Motion 13.x supports React 19 concurrent features |
| comlink@4.4.2 | Vite 8 + Web Workers | Use `?worker` import or `new Worker(new URL(..., import.meta.url))` pattern |
| zod@4.6.5 | zod-to-json-schema@3.25.2 | zod v4 schema syntax; verify `zod-to-json-schema` import path for v4 |
| idb-keyval@6.3.0 | All modern mobile browsers | Cannot create multiple object stores in one DB — use key prefixes, not multiple stores |
| TypeScript@7.0.2 | React 19 types@19.3.0 | Existing config validated |

---

## Architecture Additions (Stack-Relevant)

```
┌─────────────────────────────────────────────────────────┐
│  React UI (Camera / Calibrate / Result)                 │
│  motion animations · lucide icons · Tailwind 4          │
└───────────────┬─────────────────────────┬───────────────┘
                │                         │
        ┌───────▼───────┐         ┌───────▼───────┐
        │ idb-keyval    │         │ Vision Worker │
        │ shelf:{n}:*   │         │ pixelmatch    │
        │ keys          │         │ CCL → bboxes  │
        └───────────────┘         └───────┬───────┘
                                          │ optional
                                  ┌───────▼───────┐
                                  │ AI Studio /   │
                                  │ @google/genai │
                                  │ Gemini Flash  │
                                  └───────────────┘
```

**Worker boundary:** Pass `{ baselineDataUrl, captureDataUrl, splitYPercentages, tolerance }` in; receive `{ anomalies, complianceRate, stats }` out. Keep Canvas out of React render path.

---

## Sources

| Source | What Verified | Confidence |
|--------|---------------|------------|
| [npm registry](https://www.npmjs.com/) — live `npm view` 2026-09-20 | Current versions: @google/genai 2.23.0, pixelmatch 7.2.0, motion 13.4.0, comlink 4.4.2, zod 4.6.5 | HIGH |
| [Context7 /googleapis/js-genai](https://github.com/googleapis/js-genai) | `generateContent`, inlineData, responseJsonSchema, Type enum | MEDIUM |
| [Context7 /vite-pwa/vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | Workbox runtime caching, precache limits, navigateFallbackDenylist | MEDIUM |
| [pixelmatch README](https://github.com/mapbox/pixelmatch) | Browser ImageData API, threshold/windowSize options | HIGH |
| [Google AI — Structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) | responseSchema, model support matrix, propertyOrdering | HIGH |
| [Google AI — Image understanding](https://ai.google.dev/gemini-api/docs/generate-content/image-understanding) | Inline 20 MB limit, Files API for reuse | HIGH |
| [idb-keyval custom stores](https://github.com/jakearchibald/idb-keyval/blob/main/custom-stores.md) | Key-prefix pattern; multi-store limitation | HIGH |
| `.planning/PROJECT.md`, `.planning/codebase/STACK.md` | Brownfield constraints, existing validated features | HIGH |
| WebSearch — OpenCV.js bundle size, mobile Canvas memory | OpenCV.js ~8 MB; OffscreenCanvas + Worker pattern | LOW |

---
*Stack research for: ShelfGuard retail shelf inspection PWA (milestone additions)*
*Researched: 2026-09-20*
