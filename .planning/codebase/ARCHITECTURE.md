<!-- refreshed: 2026-09-20 -->
# Architecture

**Analysis Date:** 2026-09-20

## System Overview

ShelfGuard is a client-only Progressive Web App (PWA) for retail shelf monitoring. Store staff capture a photo from a fixed camera position, compare it against a stored baseline image, and review detected anomalies (missing or displaced products). All logic runs in the browser — there is no backend server in the application code path.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser (PWA Shell)                              │
├──────────────────┬──────────────────┬───────────────────────────────────┤
│   View Layer     │  App Controller  │    Device / Platform Hooks        │
│  `src/components/`│   `src/App.tsx`  │      `src/hooks/`                 │
│  CameraView      │  AppMode FSM     │  useCameraStream                  │
│  RoiSetupView    │  State + handlers│  useDeviceOrientation             │
│  ResultInspectView│                 │  usePWAInstall                    │
│  Modals/Overlays │                  │                                   │
└────────┬─────────┴────────┬─────────┴──────────────┬────────────────────┘
         │                  │                         │
         ▼                  ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Domain & Services Layer                          │
│                         `src/lib/` + `src/types.ts`                      │
│   vision.ts (analysis)  ·  storage.ts (IndexedDB)  ·  constants.ts      │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser APIs: IndexedDB (via idb-keyval) · MediaDevices · Canvas        │
│  DeviceOrientation · Service Worker (vite-plugin-pwa)                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App | Root state machine, orchestrates all modes, owns audit/baseline state | `src/App.tsx` |
| CameraView | Live camera/demo feed, ghost baseline overlay, ROI guides, shutter | `src/components/CameraView.tsx` |
| ScanningAnimationOverlay | 0.8s laser-beam transition after capture | `src/components/ScanningAnimationOverlay.tsx` |
| RoiSetupView | Drag-to-calibrate 4 horizontal shelf tier dividers | `src/components/RoiSetupView.tsx` |
| ResultInspectView | Anomaly bounding boxes, tolerance slider, audit completion | `src/components/ResultInspectView.tsx` |
| AuditHistoryModal | Read-only list of past audit records | `src/components/AuditHistoryModal.tsx` |
| ResetBaselineModal | Reset/upload/recalibrate baseline image | `src/components/ResetBaselineModal.tsx` |
| OfflineIndicator | Shows banner when `navigator.onLine` is false | `src/components/OfflineIndicator.tsx` |
| analyzeShelfCapture | Differential analysis (currently mock data + tolerance filter) | `src/lib/vision.ts` |
| storage module | IndexedDB persistence for baseline, history, settings | `src/lib/storage.ts` |
| useCameraStream | getUserMedia lifecycle, demo feed fallback, frame capture | `src/hooks/useCameraStream.ts` |
| useDeviceOrientation | Gamma tilt sensor + desktop simulation | `src/hooks/useDeviceOrientation.ts` |
| usePWAInstall | beforeinstallprompt capture and install trigger | `src/hooks/usePWAInstall.ts` |

## Pattern Overview

**Overall:** Single-page React app with a **finite state machine (FSM)** controlled by `AppMode` in `App.tsx`, plus **presentational view components** that receive props and callbacks.

**Key Characteristics:**
- All application state lives in `App.tsx` via `useState` — no global store (Redux, Zustand, Context)
- Views are conditionally rendered based on `appMode`; modals use separate boolean flags (`showHistoryModal`, `showResetModal`)
- Side effects (IndexedDB, analysis) are invoked from event handlers in `App.tsx`, not from components directly
- Device capabilities are encapsulated in custom hooks under `src/hooks/`
- Domain types are centralized in `src/types.ts`; i18n strings and mock data in `src/lib/constants.ts`

## Layers

**Presentation (Views & Modals):**
- Purpose: Render UI for each app mode; emit user actions via callback props
- Location: `src/components/`
- Contains: React functional components with Tailwind CSS styling, Lucide icons
- Depends on: `src/types.ts`, `src/lib/constants.ts` (I18N)
- Used by: `src/App.tsx`

**Application Controller:**
- Purpose: Own state machine, wire hooks to views, coordinate capture → analysis → audit flow
- Location: `src/App.tsx`
- Contains: ~20 `useState` hooks, event handlers, `useEffect` for IndexedDB hydration
- Depends on: components, hooks, `src/lib/storage.ts`, `src/lib/vision.ts`
- Used by: `src/main.tsx`

**Domain:**
- Purpose: Define shelf-monitoring domain model and business rules
- Location: `src/types.ts`, `src/lib/vision.ts`, `src/lib/constants.ts`
- Contains: `AppMode`, `ShelfCalibration`, `DetectedAnomaly`, `AuditRecord`, tolerance filtering, compliance scoring
- Depends on: Browser Canvas API (in `captureElementToDataUrl`)
- Used by: App controller and presentation layer

**Infrastructure (Persistence & Device):**
- Purpose: Abstract browser storage and hardware APIs
- Location: `src/lib/storage.ts`, `src/hooks/`
- Contains: IndexedDB key-value operations (`idb-keyval`), camera stream, orientation sensor, PWA install
- Depends on: Browser APIs only
- Used by: `src/App.tsx` and occasionally components (video ref passed down)

## Data Flow

### Primary Capture & Inspect Path

1. User taps shutter in `CameraView` → `onShutterClick` handler in `App.tsx` (`src/App.tsx:114`)
2. `captureFrame()` from `useCameraStream` draws video/demo image to canvas → JPEG data URL (`src/hooks/useCameraStream.ts:99`)
3. `appMode` set to `'SCANNING_ANIM'`; `ScanningAnimationOverlay` renders frozen frame with laser animation
4. In parallel, `analyzeShelfCapture(frame, baseline, tolerance)` runs (`src/lib/vision.ts:18`) — currently returns mock anomalies filtered by tolerance level
5. After 800ms timeout, `appMode` set to `'RESULT_INSPECT'`; `ResultInspectView` displays anomalies as AR bounding boxes
6. User dismisses anomalies, adjusts tolerance, or completes audit
7. `handleCompleteAudit` builds `AuditRecord`, calls `saveAuditRecord()` → IndexedDB, returns to `'CAMERA_IDLE'`

### Baseline Calibration Path

1. User opens ROI config from `CameraView` or uploads custom baseline via `ResetBaselineModal`
2. `appMode` set to `'ROI_CONFIG'`; `RoiSetupView` loads `baseline.splitYPercentages`
3. User drags 4 horizontal divider lines (pointer events on `stageRef`)
4. `handleSaveRoiCalibration` updates `ShelfCalibration`, persists via `saveBaseline()` → IndexedDB
5. Returns to `'CAMERA_IDLE'` with updated ghost overlay and ROI guides

### App Initialization

1. `index.html` loads `/src/main.tsx` as ES module (`index.html:30`)
2. `main.tsx` mounts `<App />` in `#root` under `StrictMode` (`src/main.tsx:6`)
3. `App.tsx` `useEffect` on mount loads baseline, language, tolerance, audit history from IndexedDB in parallel (`src/App.tsx:76`)

**State Management:**
- Centralized React `useState` in `App.tsx` — no external state library
- Persistence is async via `src/lib/storage.ts` (IndexedDB through `idb-keyval`)
- Components hold only local UI state (e.g., `showRoiGuides` in `CameraView`, `isBlinkingBaseline` in `ResultInspectView`)
- Derived values computed inline (e.g., `activeAnomalies` filter in `ResultInspectView`)

## Key Abstractions

**AppMode (Finite State Machine):**
- Purpose: Controls which full-screen view is rendered
- Examples: `'CAMERA_IDLE'`, `'SCANNING_ANIM'`, `'ROI_CONFIG'`, `'RESULT_INSPECT'` in `src/types.ts:1`
- Pattern: Enum-like string union; `'INITIAL_GUIDE'` and `'PROCESSING'` are defined but not yet wired in `App.tsx`

**ShelfCalibration:**
- Purpose: Golden baseline reference — image + 4-tier horizontal split lines
- Examples: `DEFAULT_CALIBRATION` in `src/lib/constants.ts:7`, user-uploaded baselines in IndexedDB
- Pattern: Stored as JSON in IndexedDB key `shelfguard_baseline`; `splitYPercentages` are normalized 0.0–1.0 Y coordinates

**DetectedAnomaly:**
- Purpose: A single shelf discrepancy (missing product or displacement)
- Examples: `INITIAL_MOCK_ANOMALIES` in `src/lib/constants.ts:21`
- Pattern: Normalized bounding box (`x`, `y`, `width`, `height` as 0.0–1.0), `rowIndex` 0–3, `dismissed` flag for user override

**AuditRecord:**
- Purpose: Completed inspection snapshot for history
- Examples: Created in `handleCompleteAudit` (`src/App.tsx:159`)
- Pattern: Append-only list capped at 50 records in IndexedDB key `shelfguard_audit_history`

**ToleranceLevel:**
- Purpose: Sensitivity threshold for anomaly detection
- Examples: `'strict' | 'normal' | 'loose'` in `src/types.ts:9`
- Pattern: Filters mock anomalies in `analyzeShelfCapture`; changing tolerance re-runs analysis on current capture

## Entry Points

**HTML Shell:**
- Location: `index.html`
- Triggers: Browser navigation to `/`
- Responsibilities: PWA meta tags, Google Fonts (Inter, JetBrains Mono), manifest link, mounts React root

**React Bootstrap:**
- Location: `src/main.tsx`
- Triggers: Vite module load from `index.html`
- Responsibilities: `createRoot`, render `<App />`, import global CSS

**Application Root:**
- Location: `src/App.tsx`
- Triggers: React mount
- Responsibilities: State machine, IndexedDB hydration, mode switching, all business event handlers

**Vite Dev/Build:**
- Location: `vite.config.ts`
- Triggers: `npm run dev` / `npm run build`
- Responsibilities: React plugin, Tailwind v4 via `@tailwindcss/vite`, PWA service worker via `vite-plugin-pwa`, `@/` path alias to project root

## Architectural Constraints

- **Threading:** Single-threaded browser event loop; analysis is async but runs on main thread (no Web Workers)
- **Global state:** All shared mutable state in `App.tsx` component instance; IndexedDB is the only cross-session persistence
- **Circular imports:** None detected — dependency graph flows `App → components/hooks/lib → types`
- **No backend:** `express` and `@google/genai` are in `package.json` but not imported anywhere in `src/`; README references `GEMINI_API_KEY` for future AI Studio integration
- **Offline-first:** PWA with service worker; IndexedDB for all data; demo shelf image URL requires network unless cached by SW
- **Camera default:** App starts in demo feed mode (`isUsingDemoFeed: true` in `useCameraStream.ts:10`) — real camera requires explicit user toggle

## Anti-Patterns

### Monolithic App State

**What happens:** All ~20 state variables and handlers live in a single 336-line `App.tsx`
**Why it's wrong:** Adding new modes or features requires editing the root component; testing handlers in isolation is difficult
**Do this instead:** Extract mode-specific state into custom hooks (e.g., `useAuditFlow`, `useBaselineManager`) or a lightweight state machine library when complexity grows

### Mock Vision Layer Presented as Real Analysis

**What happens:** `analyzeShelfCapture` in `src/lib/vision.ts` clones `INITIAL_MOCK_ANOMALIES` and filters by tolerance — it does not compare pixel data despite JSDoc claiming "canvas pixel diffing"
**Why it's wrong:** UI and data model are built for real CV output, but backend logic is stubbed; integrating Gemini or OpenCV will require replacing the entire function body
**Do this instead:** Keep the `InspectionAnalysisResult` interface stable; implement real diffing in `analyzeShelfCapture` using Canvas `getImageData` per tier band, or call `@google/genai` with structured output

### Unused AppMode States

**What happens:** `INITIAL_GUIDE` and `PROCESSING` are defined in `src/types.ts` but never assigned in `App.tsx`
**Why it's wrong:** Type system suggests a richer flow than implemented; new developers may expect onboarding or async processing screens
**Do this instead:** Either implement the missing modes or remove them from the `AppMode` union until needed

## Error Handling

**Strategy:** Defensive try/catch at persistence boundaries; graceful degradation for device APIs

**Patterns:**
- IndexedDB operations wrap in try/catch, log with `console.warn`/`console.error`, return defaults (`src/lib/storage.ts:10`)
- Camera access failure falls back to demo feed silently (`src/hooks/useCameraStream.ts:38`)
- Vibration calls wrapped in try/catch with empty catch blocks (`src/App.tsx:121`, `src/hooks/useDeviceOrientation.ts:27`)
- Invalid baseline data from IndexedDB falls back to `DEFAULT_CALIBRATION` (`src/lib/storage.ts:13`)

## Cross-Cutting Concerns

**Logging:** `console.warn` / `console.error` only — no structured logging or error tracking service

**Validation:** Runtime checks on IndexedDB loaded values (e.g., `splitYPercentages.length === 4`, language `'cn'|'en'`) in `src/lib/storage.ts`; no schema validation library

**Authentication:** Not applicable — fully client-side app with no user accounts

**Internationalization:** Static dictionary `I18N` object in `src/lib/constants.ts:70` keyed by `Language` (`'cn' | 'en'`); components receive `lang` prop and use `const t = I18N[lang]`

**Styling:** Tailwind CSS v4 utility classes inline in components; custom utilities in `src/index.css` (`.no-scrollbar`, `.font-mono-numbers`); design tokens from Google Stitch (emerald `#10B981`, slate `#0F172A`, sky `#38BDF8`)

---

*Architecture analysis: 2026-09-20*
