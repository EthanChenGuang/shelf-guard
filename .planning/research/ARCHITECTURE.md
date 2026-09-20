# Architecture Research

**Domain:** Multi-shelf retail inspection PWA with hybrid client/cloud vision
**Researched:** 2026-09-20
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

ShelfGuard v1 is a **local-first, client-only PWA** — no backend sync in scope. The architecture extends the existing React FSM with **shelf-scoped data partitions**, a **tiered vision pipeline** (Canvas ROI diff → optional Gemini), and **hook-based state decomposition** without introducing Redux or a new framework.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Presentation Layer (React)                           │
├──────────────────┬──────────────────┬─────────────────────────────────────┤
│  ShelfCarousel   │  Three-View FSM  │  Modals / Overlays                  │
│  (swipe 5 shelves)│  Camera / ROI /  │  History, Reset, Offline, Guide    │
│                  │  Result / Scan   │                                     │
└────────┬─────────┴────────┬─────────┴──────────────┬──────────────────────┘
         │                  │                         │
         ▼                  ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Application Orchestration (Hooks)                         │
│  useShelfSession(shelfId)  ·  useInspectionFlow()  ·  useAppSettings()      │
│  Thin App.tsx: activeShelfId + mode routing only                           │
└────────┬────────────────────────────┬───────────────────────────┬───────────┘
         │                            │                           │
         ▼                            ▼                           ▼
┌─────────────────┐    ┌──────────────────────────┐    ┌────────────────────┐
│  Shelf Store    │    │  Vision Pipeline         │    │  Device Hooks      │
│  storage.ts     │    │  vision/ (staged)        │    │  camera, tilt, PWA │
│  per-shelf IDB  │    │  client → cloud router   │    │                    │
└────────┬────────┘    └────────────┬─────────────┘    └────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser Infrastructure                                                      │
│  IndexedDB (metadata + Blob refs) · Cache Storage (image bytes) · SW shell  │
│  Canvas / OffscreenCanvas · Web Worker (optional) · @google/genai (opt-in)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **ShelfCarousel** | Horizontal swipe between 5 shelf profiles; shows per-shelf status (has baseline, last audit) | CSS scroll-snap or touch-swipe on `CameraView` header; `activeShelfId` in parent |
| **useShelfSession** | Owns one shelf's baseline, history, and in-flight capture state; lazy-loads on shelf switch | Custom hook keyed by `shelfId`; reads/writes namespaced IndexedDB keys |
| **useInspectionFlow** | FSM transitions: capture → scan anim → process → result; wires vision pipeline | `useReducer` + effects; replaces shutter/analysis handlers from `App.tsx` |
| **VisionRouter** | Routes capture through client diff first; optionally escalates to Gemini when online + enabled | Pure async function in `src/lib/vision/router.ts` |
| **ClientDiffEngine** | Per-tier ROI pixel comparison, connected-component bounding boxes | Canvas `getImageData` per band; optional `pixelmatch` (~1KB) |
| **GeminiRefiner** | Structured JSON anomaly list from multimodal API | `@google/genai` with `responseJsonSchema` matching `DetectedAnomaly[]` |
| **ShelfStore** | CRUD for 5 isolated shelf records (baseline, history, ROI splits) | Extend `storage.ts` with `shelfId`-prefixed keys or single `shelves` object store |
| **ImageBlobStore** | Stores JPEG bytes as Blob (not base64 strings) to reduce IDB bloat | IndexedDB Blob values or Cache Storage keyed by `shelfId/baseline` |
| **Service Worker** | App shell + static assets only; does NOT cache Gemini API | Existing `vite-plugin-pwa` with `registerType: 'autoUpdate'` |

## Recommended Project Structure

```
src/
├── App.tsx                    # Thin shell: activeShelfId, appMode, hook wiring
├── types.ts                   # Add ShelfProfile, ShelfId, VisionConfig
├── components/
│   ├── CameraView.tsx         # + shelf carousel strip, per-shelf ghost
│   ├── ShelfCarousel.tsx      # NEW: 5-dot / swipe selector
│   ├── RoiSetupView.tsx
│   ├── ResultInspectView.tsx
│   └── ...existing modals
├── hooks/
│   ├── useCameraStream.ts
│   ├── useDeviceOrientation.ts
│   ├── usePWAInstall.ts
│   ├── useShelfSession.ts     # NEW: per-shelf baseline + history state
│   ├── useInspectionFlow.ts   # NEW: FSM + capture/analysis orchestration
│   └── useAppSettings.ts      # NEW: lang, tolerance, geminiEnabled (global)
├── lib/
│   ├── storage/
│   │   ├── index.ts           # Public API
│   │   ├── shelfStore.ts      # NEW: multi-shelf CRUD
│   │   └── imageStore.ts      # NEW: Blob persistence helpers
│   ├── vision/
│   │   ├── index.ts           # analyzeShelfCapture (stable export)
│   │   ├── router.ts          # NEW: client-first routing
│   │   ├── clientDiff.ts      # NEW: ROI band diff + contour boxes
│   │   ├── geminiRefiner.ts   # NEW: optional cloud pass
│   │   └── types.ts           # PipelineStage, VisionConfig
│   └── constants.ts
└── workers/
    └── visionWorker.ts        # OPTIONAL: OffscreenCanvas diff off main thread
```

### Structure Rationale

- **`hooks/` decomposition:** Extracts the ~20 `useState` calls from monolithic `App.tsx` into three focused hooks without adding Zustand/Redux — matches brownfield constraint and existing hook patterns (`useCameraStream`).
- **`lib/vision/` staging:** Separates client diff, cloud refiner, and router so `analyzeShelfCapture()` remains the single public entry point (preserves existing call sites during migration).
- **`lib/storage/` split:** Multi-shelf keys and Blob handling are distinct concerns; isolating them prevents repeating the current single-key `shelfguard_baseline` mistake.
- **`workers/` optional:** Phase 1 can run diff on main thread behind `SCANNING_ANIM` (0.8s budget); worker is a performance upgrade, not a blocker.

## Multi-Shelf Data Model

### Domain Types (extend `src/types.ts`)

```typescript
export type ShelfId = 'shelf-1' | 'shelf-2' | 'shelf-3' | 'shelf-4' | 'shelf-5';

export const SHELF_IDS: ShelfId[] = ['shelf-1', 'shelf-2', 'shelf-3', 'shelf-4', 'shelf-5'];

export interface ShelfProfile {
  id: ShelfId;
  label: string;                    // i18n key or display name
  baseline: ShelfCalibration | null; // null → INITIAL_GUIDE for this shelf
  auditHistory: AuditRecord[];      // capped at 50 per shelf
  updatedAt: number;
}

export interface AppSettings {
  lang: Language;
  tolerance: ToleranceLevel;
  geminiEnabled: boolean;           // user opt-in; requires API key in env
  activeShelfId: ShelfId;           // last selected shelf (persisted)
}
```

### Storage Layout (IndexedDB via idb-keyval)

| Key | Value | Scope |
|-----|-------|-------|
| `shelfguard_shelves` | `Record<ShelfId, ShelfProfile>` | All 5 shelves (metadata; images as Blob refs) |
| `shelfguard_settings` | `AppSettings` | Global |
| `shelfguard_img:{shelfId}:baseline` | `Blob` (JPEG) | Per-shelf baseline image bytes |
| `shelfguard_img:{shelfId}:audit:{recordId}` | `Blob` | Per-audit thumbnail |

**Migration from v0:** On first load, if legacy `shelfguard_baseline` exists, map it to `shelf-1` and delete legacy keys. Remaining shelves start with `baseline: null`.

### Data Isolation Rules

1. **Every read/write is shelf-scoped** — pass `shelfId` as the first argument to all storage functions; never load all 5 baselines into memory at once.
2. **Active shelf only in UI state** — `useShelfSession(activeShelfId)` holds the working copy; switching shelves persists the previous shelf's dirty state then lazy-loads the next.
3. **History is never shared** — audit records include `shelfId` field for filtering; modal shows only active shelf's history.
4. **Global settings vs per-shelf calibration** — tolerance and language are global; ROI splits and baseline images are per-shelf (each physical fixture has different tier boundaries).

## Vision Pipeline Stages

### Pipeline Overview

```text
Capture (JPEG data URL)
    │
    ▼
┌───────────────────────────────────────┐
│ Stage 0: Preprocess                   │
│  · Normalize dimensions to baseline   │
│  · Optional luminance normalization   │
└───────────────┬───────────────────────┘
                ▼
┌───────────────────────────────────────┐
│ Stage 1: Client ROI Diff (always)     │
│  · Split into 4 horizontal bands      │
│  · pixelmatch per tier                │
│  · Connected components → bboxes      │
│  · Emit DetectedAnomaly[] + scores    │
└───────────────┬───────────────────────┘
                │
        ┌───────┴───────┐
        │ confidence?   │
        ▼               ▼
   HIGH enough     LOW / user enabled
   (offline OK)         + online
        │               │
        │               ▼
        │    ┌──────────────────────────┐
        │    │ Stage 2: Gemini Refiner  │
        │    │  · Multimodal compare    │
        │    │  · Structured JSON out   │
        │    │  · Merge/replace anomalies│
        │    └────────────┬─────────────┘
        │                 │
        └────────┬────────┘
                 ▼
┌───────────────────────────────────────┐
│ Stage 3: Post-process                 │
│  · Tolerance filter (strict/normal/loose)│
│  · Compliance stats                   │
│  · Return InspectionAnalysisResult  │
└───────────────────────────────────────┘
```

### Stage Details

| Stage | Runs When | Input | Output | Offline |
|-------|-----------|-------|--------|---------|
| **0 Preprocess** | Always | capture + baseline data URLs | Aligned `ImageData` per tier | Yes |
| **1 Client Diff** | Always | tier `ImageData` pairs | `DetectedAnomaly[]` with `score`, `source: 'client'` | Yes |
| **2 Gemini Refiner** | `geminiEnabled && navigator.onLine && (low confidence OR user "deep scan")` | Both images + ROI metadata + client anomalies as hints | `DetectedAnomaly[]` with `source: 'gemini'` | No — skip gracefully |
| **3 Post-process** | Always | merged anomalies + tolerance | `InspectionAnalysisResult` | Yes |

### Client Diff Implementation (Stage 1)

**Recommended approach:** Use `pixelmatch` (no deps, ~150 LOC) on equal-sized ROI crops extracted via Canvas.

```typescript
// Per-tier band extraction
function extractTierBand(
  imageData: ImageData,
  splitYs: [number, number, number, number],
  tierIndex: 0 | 1 | 2 | 3
): ImageData {
  const { width, height, data } = imageData;
  const topY = tierIndex === 0 ? 0 : Math.floor(splitYs[tierIndex - 1] * height);
  const bottomY = tierIndex === 3 ? height : Math.floor(splitYs[tierIndex] * height);
  const bandHeight = bottomY - topY;
  // Copy sub-rectangle into new ImageData
  // ...
}

// Diff with windowed density (robust to noise)
const diffPixels = pixelmatch(baseline.data, capture.data, null, w, h, {
  threshold: toleranceToThreshold(tolerance), // strict: 0.05, normal: 0.1, loose: 0.2
  includeAA: false,
  alpha: 0.1,
  diffMask: true,
  windowSize: 16, // flag regions with clustered change, not scattered noise
});
```

**Connected components:** Scan diff mask for 4-connected regions above minimum area threshold → normalize to `boundingBox` (0–1 coords) + assign `rowIndex`.

### Gemini Refiner (Stage 2)

Use `@google/genai` with structured output matching existing types:

```typescript
import { GoogleGenAI, Type } from '@google/genai';

const anomalySchema = {
  type: Type.OBJECT,
  properties: {
    anomalies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          rowIndex: { type: Type.NUMBER },
          type: { type: Type.STRING, enum: ['MISSING', 'MOVED'] },
          title: { type: Type.STRING },
          boundingBox: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER }, y: { type: Type.NUMBER },
              width: { type: Type.NUMBER }, height: { type: Type.NUMBER },
            },
          },
          score: { type: Type.NUMBER },
          confidence: { type: Type.NUMBER },
        },
      },
    },
  },
};

// Multimodal: baseline image + capture image + tier split metadata
const response = await ai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: [
    { text: systemPromptWithRoiSplits },
    { inlineData: { mimeType: 'image/jpeg', data: baselineBase64 } },
    { inlineData: { mimeType: 'image/jpeg', data: captureBase64 } },
  ],
  config: {
    responseMimeType: 'application/json',
    responseJsonSchema: anomalySchema,
  },
});
```

**Security note:** API key must stay in environment variable (`GEMINI_API_KEY`); never persist in IndexedDB. For v1 single-device PWA, key is injected at build time via Vite `define` or read from a settings field the user pastes once (stored locally, not synced).

### Routing Logic

```typescript
export async function analyzeShelfCapture(
  capturedDataUrl: string,
  baseline: ShelfCalibration,
  tolerance: ToleranceLevel,
  config: VisionConfig = { geminiEnabled: false }
): Promise<InspectionAnalysisResult> {
  const clientResult = await runClientDiff(capturedDataUrl, baseline, tolerance);

  const shouldEscalate =
    config.geminiEnabled &&
    navigator.onLine &&
    (clientResult.maxScore < 0.55 || clientResult.anomalies.length === 0);

  if (!shouldEscalate) {
    return finalizeResult(clientResult.anomalies, tolerance);
  }

  try {
    const refined = await runGeminiRefiner(capturedDataUrl, baseline, clientResult.anomalies);
    return finalizeResult(refined, tolerance);
  } catch {
    // Cloud failure → degrade to client-only (Tier 3 heuristic pattern)
    return finalizeResult(clientResult.anomalies, tolerance);
  }
}
```

Wire `AppMode.PROCESSING` during Stage 1–2 when diff exceeds the 0.8s scan animation budget (currently unused mode — now has purpose).

## State Management Evolution

### Current State (Monolithic App.tsx)

All state in one component (~20 `useState`, handlers inline). Works for single-shelf prototype; breaks down when adding:
- 5 shelf contexts with independent baselines
- Vision pipeline async stages
- Per-shelf history modals

### Target State (Hook Composition — No Redux)

```text
App.tsx (thin coordinator, ~80 lines)
├── activeShelfId          ← useAppSettings()
├── appMode                ← useInspectionFlow()
├── shelf = useShelfSession(activeShelfId)
│   ├── baseline, setBaseline
│   ├── auditHistory
│   └── persist() on change
├── { lang, tolerance, geminiEnabled } ← useAppSettings()
└── device hooks (camera, tilt, PWA) — unchanged
```

### Pattern 1: Shelf-Scoped Session Hook

**What:** `useShelfSession(shelfId)` loads one shelf profile from IndexedDB, exposes baseline/history, auto-persists on mutation.

**When to use:** Any UI that reads or writes shelf-specific data.

**Trade-offs:** (+) Isolates shelf switching logic; (-) Must flush on shelf change before loading next.

```typescript
export function useShelfSession(shelfId: ShelfId) {
  const [profile, setProfile] = useState<ShelfProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadShelfProfile(shelfId).then((p) => { if (!cancelled) setProfile(p); });
    return () => { cancelled = true; };
  }, [shelfId]);

  const updateBaseline = useCallback(async (cal: ShelfCalibration) => {
    setProfile((prev) => prev ? { ...prev, baseline: cal, updatedAt: Date.now() } : prev);
    await saveShelfBaseline(shelfId, cal);
  }, [shelfId]);

  return { profile, updateBaseline, appendAudit: /* ... */ };
}
```

### Pattern 2: Inspection Flow Reducer

**What:** Replace scattered `setAppMode` calls with `useReducer` FSM for capture → scan → process → result.

**When to use:** Async vision pipeline with guarded transitions (can't shutter during PROCESSING).

**Trade-offs:** (+) Explicit transition guards; (+) `PROCESSING` mode now meaningful; (-) Slightly more boilerplate than raw `useState`.

```typescript
type InspectionEvent =
  | { type: 'SHUTTER' }
  | { type: 'SCAN_COMPLETE' }
  | { type: 'ANALYSIS_COMPLETE'; result: InspectionAnalysisResult }
  | { type: 'DISMISS' }
  | { type: 'ENTER_ROI_CONFIG' };

function inspectionReducer(state: InspectionState, event: InspectionEvent): InspectionState {
  switch (state.mode) {
    case 'CAMERA_IDLE':
      if (event.type === 'SHUTTER') return { ...state, mode: 'SCANNING_ANIM' };
      if (event.type === 'ENTER_ROI_CONFIG') return { ...state, mode: 'ROI_CONFIG' };
      break;
    case 'SCANNING_ANIM':
      if (event.type === 'SCAN_COMPLETE') return { ...state, mode: 'PROCESSING' };
      break;
    case 'PROCESSING':
      if (event.type === 'ANALYSIS_COMPLETE')
        return { ...state, mode: 'RESULT_INSPECT', result: event.result };
      break;
    // ...
  }
  return state;
}
```

### Pattern 3: Custom Hooks Over State Library

**What:** Stay with React hooks (`useReducer` + `useContext` only if needed for deep prop drilling).

**When to use:** v1 scope — 5 shelves, single device, no cross-tab sync.

**Trade-offs:** (+) Zero new dependencies; (+) Matches existing codebase; (-) If shelf count grows to 20+ or multi-tab sync needed, revisit Zustand.

**Do NOT introduce:** Redux, XState (bundle + learning curve), or React Context for all state (re-render risk with image data).

### AppMode Wiring After Migration

| AppMode | Trigger | New Behavior |
|---------|---------|--------------|
| `INITIAL_GUIDE` | Active shelf has `baseline === null` | Per-shelf first-run guide |
| `CAMERA_IDLE` | Default; shelf switch returns here | Shows active shelf's ghost overlay |
| `SCANNING_ANIM` | Shutter tap | 0.8s animation; analysis starts in parallel |
| `PROCESSING` | Scan anim ends before analysis completes | Spinner/progress if Gemini slow |
| `ROI_CONFIG` | Calibrate tiers | Saves to active shelf only |
| `RESULT_INSPECT` | Analysis done | Anomalies scoped to active shelf audit |

## Data Flow

### Shelf Switch Flow

```
User swipes carousel
    ↓
App.tsx: setActiveShelfId(nextId) + persist to settings
    ↓
useShelfSession(prevId): flush pending writes
useShelfSession(nextId): loadShelfProfile(nextId) from IndexedDB
    ↓
CameraView: re-render ghost overlay with next shelf's baseline
    ↓
If next shelf baseline === null → transition to INITIAL_GUIDE
```

### Capture & Inspect Flow (Hybrid Vision)

```
Shutter tap (CAMERA_IDLE)
    ↓
captureFrame() → setCapturedFrame
    ↓
dispatch SHUTTER → SCANNING_ANIM (0.8s overlay)
    ↓ (parallel)
VisionRouter.analyzeShelfCapture(frame, activeBaseline, tolerance, config)
    ├── Stage 1: clientDiff (always)
    └── Stage 2: geminiRefiner (if enabled + online + low confidence)
    ↓
SCAN_COMPLETE → PROCESSING (if still running) or RESULT_INSPECT
    ↓
dispatch ANALYSIS_COMPLETE → RESULT_INSPECT
    ↓
User completes audit → appendAudit(activeShelfId, record)
    ↓
Return to CAMERA_IDLE (same shelf)
```

### State Management Diagram

```
useAppSettings (global, persisted)
    ↓ activeShelfId, tolerance, lang, geminiEnabled
App.tsx
    ↓ shelfId
useShelfSession ──→ shelfStore (IndexedDB)
    ↓ baseline, history
useInspectionFlow ──→ vision/router ──→ clientDiff | geminiRefiner
    ↓ appMode, anomalies, capturedFrame
View Components (presentational, callback props)
```

## Offline-First Considerations

### Three-Layer Local-First Model (adapted for v1)

| Layer | Responsibility | ShelfGuard Implementation |
|-------|---------------|---------------------------|
| **Service Worker** | App shell, static assets, fonts | Existing `vite-plugin-pwa`; do NOT cache API routes |
| **Local Database** | Structured data + Blobs | IndexedDB via idb-keyval; 5 shelf profiles |
| **Sync Engine** | Server reconciliation | **Out of scope v1** — no backend |

### Offline Capability Matrix

| Feature | Offline | Notes |
|---------|---------|-------|
| Camera capture | Yes | Requires prior permission grant |
| Client ROI diff | Yes | Core value proposition |
| Gemini refiner | No | Skip with toast "精检需要网络" |
| Baseline save/load | Yes | All 5 shelves local |
| Audit history | Yes | Per-shelf, capped at 50 |
| Demo feed | Partial | External URL needs network unless SW-cached |
| Shelf switch | Yes | Pure IndexedDB reads |

### Storage Best Practices

1. **Store images as Blob, not base64 strings** — base64 adds ~33% overhead and causes deserialization spikes on mobile (HIGH confidence from web.dev + practitioner posts).
2. **Cap images at 1080×1920 JPEG ~85% quality** — ~200–400 KB per image; 5 baselines + 50 audits × 5 shelves ≈ 50–125 MB worst case; monitor with `navigator.storage.estimate()`.
3. **Request persistent storage** on first baseline save: `navigator.storage.persist()` — prevents eviction on installed PWA.
4. **Handle QuotaExceededError** — offer "clear old audit thumbnails" before failing baseline save.

### PWA Service Worker Boundaries

- **Cache:** `index.html`, JS/CSS bundles, fonts, demo image (precache)
- **Do NOT cache:** Gemini API responses, user captures, baseline blobs (these live in IndexedDB)
- **Camera gotcha:** getUserMedia requires live SW scope; ensure `devOptions.enabled` doesn't interfere with prod camera permissions

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **1 device, 5 shelves (v1)** | Hook composition + IndexedDB; main-thread diff acceptable behind 0.8s anim |
| **1 device, 20+ shelves** | Virtualize carousel; lazy-load baselines; mandatory Web Worker diff |
| **Multi-device / multi-store** | Add sync engine (outbox pattern), server authority, tenant-scoped keys — new milestone |
| **1000+ audits stored** | Move thumbnails to Cache Storage; keep metadata in IndexedDB; paginate history modal |

### Scaling Priorities

1. **First bottleneck: main-thread diff on low-end phones** — Move Stage 1 to `visionWorker.ts` with OffscreenCanvas; keep 0.8s scan anim as perceived-performance buffer.
2. **Second bottleneck: IndexedDB size from base64 images** — Migrate to Blob storage before adding 5× history volume.

## Anti-Patterns

### Anti-Pattern 1: Shared Baseline Across Shelves

**What people do:** Single `shelfguard_baseline` key reused when adding carousel UI.

**Why it's wrong:** Each physical fixture has different camera angle, tier heights, and product layout — shared baseline produces false positives on every non-primary shelf.

**Do this instead:** `ShelfProfile` per `ShelfId`; migration maps legacy key to `shelf-1` only.

### Anti-Pattern 2: Gemini-First Pipeline

**What people do:** Send every capture to cloud API for analysis.

**Why it's wrong:** Violates 30-second inspection SLA on slow store WiFi; incurs API cost; fails completely offline.

**Do this instead:** Client diff always runs first; Gemini is opt-in refinement for ambiguous cases.

### Anti-Pattern 3: Global Audit History List

**What people do:** Single `auditHistory` array filtered in UI by shelf.

**Why it's wrong:** Unbounded growth; accidental cross-shelf data leak in modals; save/load races on shelf switch.

**Do this instead:** History nested inside each `ShelfProfile`; cap at 50 per shelf.

### Anti-Pattern 4: Adding Redux for Multi-Shelf

**What people do:** Introduce global store when `App.tsx` feels crowded.

**Why it's wrong:** Violates brownfield constraint; over-engineered for single-device local app with no shared cross-component subscriptions beyond active shelf.

**Do this instead:** 3 custom hooks + thin `App.tsx`; add Context only if prop drilling exceeds 2 levels.

### Anti-Pattern 5: Full-Frame Pixel Diff Without ROI Bands

**What people do:** Compare entire 1080×1920 frame with pixelmatch.

**Why it's wrong:** Lighting shifts, shadow movement, and minor camera drift cause full-frame false positives; ignores the 4-tier domain model already in types.

**Do this instead:** Extract horizontal bands using `splitYPercentages`; diff per tier; assign `rowIndex` from band index.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Gemini API** (`@google/genai`) | Client-side direct call when online; structured JSON schema | API key via env; rate-limit with circuit breaker; never block offline path |
| **Google Fonts** | CDN + SW precache | Already in `index.html`; ensure offline fallback |
| **Demo shelf image** | External URL | Precache in SW or bundle as asset for true offline demo |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `useShelfSession` ↔ `shelfStore` | Async functions; optimistic UI update + await persist | Flush on shelf switch |
| `useInspectionFlow` ↔ `vision/router` | Async call; returns `InspectionAnalysisResult` | Stable interface preserves `analyzeShelfCapture` signature |
| `CameraView` ↔ `useCameraStream` | Ref + callbacks | Unchanged; video ref shared across shelf switches |
| `ShelfCarousel` ↔ `App.tsx` | `onShelfChange(shelfId)` callback | Persist `activeShelfId` immediately |

## Sources

- [ShelfGuard codebase ARCHITECTURE.md](../codebase/ARCHITECTURE.md) — brownfield baseline (HIGH)
- [PROJECT.md](../PROJECT.md) — requirements and constraints (HIGH)
- [@google/genai SDK docs](https://github.com/googleapis/js-genai) — structured JSON + multimodal (MEDIUM, Context7)
- [pixelmatch](https://github.com/mapbox/pixelmatch) — browser pixel diff library (MEDIUM)
- [web.dev: Offline data](https://web.dev/learn/pwa/offline-data) — IndexedDB + Cache Storage patterns (MEDIUM)
- [web.dev: Storage for the web](https://web.dev/articles/storage-for-the-web) — quota, persistence API (MEDIUM)
- [Local-first PWA architecture](https://blog.openreplay.com/local-first-pwa-architecture/) — three-layer model (LOW)
- [Hybrid image pipeline design](https://deep-image.ai/blog/edge-ai-vs-cloud-apis-hybrid-image-processing/) — edge-first routing (LOW)
- [Fault-tolerant shelf analytics pipeline](https://www.shelfanalytics.org/core-architecture-for-shelf-analytics/designing-a-scalable-shelf-analytics-architecture/how-to-build-a-fault-tolerant-shelf-analytics-pipeline/) — tiered inference fallback (LOW)
- [useStateMachine / React FSM hooks pattern](https://github.com/cassiozen/useStateMachine/) — hook-based FSM without library (LOW)

---
*Architecture research for: ShelfGuard multi-shelf PWA with hybrid vision*
*Researched: 2026-09-20*
