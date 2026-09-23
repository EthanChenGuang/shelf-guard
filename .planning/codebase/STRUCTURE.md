# Codebase Structure

**Analysis Date:** 2026-09-20

## Directory Layout

```
image-comparation/
├── index.html              # HTML shell, PWA meta, React mount point
├── package.json            # Dependencies and npm scripts
├── vite.config.ts          # Vite + React + Tailwind + PWA plugin config
├── tsconfig.json           # TypeScript compiler options, @/* path alias
├── README.md               # AI Studio setup instructions
├── public/                 # Static assets served as-is
│   ├── manifest.json       # PWA web app manifest
│   └── icon.svg            # App icon (also used as apple-touch-icon target)
└── src/                    # Application source (all runtime code)
    ├── main.tsx            # React entry point
    ├── App.tsx             # Root component, state machine, event handlers
    ├── types.ts            # Shared TypeScript domain types
    ├── index.css           # Tailwind import + custom utility classes
    ├── components/         # Presentational view components (one per screen/modal)
    │   ├── CameraView.tsx
    │   ├── ScanningAnimationOverlay.tsx
    │   ├── RoiSetupView.tsx
    │   ├── ResultInspectView.tsx
    │   ├── AuditHistoryModal.tsx
    │   ├── ResetBaselineModal.tsx
    │   └── OfflineIndicator.tsx
    ├── hooks/              # Custom React hooks for device/platform APIs
    │   ├── useCameraStream.ts
    │   ├── useDeviceOrientation.ts
    │   └── usePWAInstall.ts
    └── lib/                # Domain services and static configuration
        ├── constants.ts    # Default baseline, mock anomalies, I18N strings
        ├── storage.ts      # IndexedDB read/write via idb-keyval
        └── vision.ts       # Shelf capture analysis (mock + canvas utilities)
```

## Directory Purposes

**`src/` (root):**
- Purpose: Application entry and orchestration
- Contains: `main.tsx`, `App.tsx`, `types.ts`, global CSS
- Key files: `App.tsx` (state machine), `types.ts` (domain model)

**`src/components/`:**
- Purpose: Full-screen views and modal overlays for each user-facing screen
- Contains: One React component file per app mode or modal; PascalCase filenames matching export name
- Key files: `CameraView.tsx` (primary capture UI), `ResultInspectView.tsx` (anomaly review)

**`src/hooks/`:**
- Purpose: Encapsulate browser API lifecycle and return reactive state
- Contains: Custom hooks prefixed with `use`; one concern per file
- Key files: `useCameraStream.ts` (MediaDevices), `useDeviceOrientation.ts` (tilt sensor)

**`src/lib/`:**
- Purpose: Pure/domain logic separated from React rendering
- Contains: Async service functions, constants, i18n dictionaries
- Key files: `storage.ts` (persistence), `vision.ts` (analysis), `constants.ts` (defaults + I18N)

**`public/`:**
- Purpose: Static files copied verbatim to build output root
- Contains: PWA manifest, SVG icon
- Key files: `manifest.json`, `icon.svg`

## Key File Locations

**Entry Points:**
- `index.html`: Browser load target; references `/src/main.tsx`
- `src/main.tsx`: Creates React root, renders `<App />`
- `src/App.tsx`: Application controller and state machine

**Configuration:**
- `vite.config.ts`: Build tooling, `@/` alias, PWA plugin, HMR disable via `DISABLE_HMR` env
- `tsconfig.json`: ES2022 target, React JSX, path alias `@/*` → `./*`
- `public/manifest.json`: PWA name, icons, display mode, orientation
- `.env.local`: Referenced in README for `GEMINI_API_KEY` (not read by current `src/` code)

**Core Logic:**
- `src/lib/vision.ts`: `analyzeShelfCapture()` — shelf diff analysis
- `src/lib/storage.ts`: IndexedDB CRUD for baseline, history, settings
- `src/lib/constants.ts`: `DEFAULT_CALIBRATION`, `INITIAL_MOCK_ANOMALIES`, `I18N`
- `src/types.ts`: `AppMode`, `ShelfCalibration`, `DetectedAnomaly`, `AuditRecord`

**Testing:**
- Not detected — no test files, no test runner config (`vitest`, `jest`) in project

## Naming Conventions

**Files:**
- React components: PascalCase matching component name — `CameraView.tsx`, `ResultInspectView.tsx`
- Custom hooks: camelCase with `use` prefix — `useCameraStream.ts`, `usePWAInstall.ts`
- Library modules: camelCase descriptive — `storage.ts`, `vision.ts`, `constants.ts`
- Types: singular module name — `types.ts` (not `types/` directory)

**Directories:**
- Lowercase, plural for collections — `components/`, `hooks/`, `lib/`
- Flat structure — no nested feature folders (e.g., no `src/features/shelf/`)

**Functions:**
- camelCase for handlers and utilities — `handleShutterClick`, `analyzeShelfCapture`, `loadBaseline`
- Async persistence functions prefixed with verb — `saveBaseline`, `loadAuditHistory`, `clearBaseline`

**Types/Interfaces:**
- PascalCase — `ShelfCalibration`, `DetectedAnomaly`, `AuditRecord`, `ToleranceLevel`
- String union types for enums — `AppMode`, `Language`, `ToleranceLevel`

**Constants:**
- SCREAMING_SNAKE_CASE — `DEFAULT_CALIBRATION`, `INITIAL_MOCK_ANOMALIES`, `I18N`, `KEY_BASELINE`
- IndexedDB keys prefixed with app name — `shelfguard_baseline`, `shelfguard_audit_history`

**Component Props:**
- Interface named `{ComponentName}Props` — `CameraViewProps`, `RoiSetupViewProps`
- Callback props prefixed with `on` — `onShutterClick`, `onSave`, `onClose`
- Boolean props prefixed with `is`/`show` — `isLevel`, `isUsingDemoFeed`, `showHistoryModal`

## Where to Add New Code

**New full-screen view (new AppMode):**
- Component: `src/components/{ViewName}.tsx`
- Wire mode: Add to `AppMode` union in `src/types.ts`, add conditional render block in `src/App.tsx`
- State/handlers: Add state and handlers in `src/App.tsx` (or extract to a hook if substantial)

**New modal or overlay:**
- Component: `src/components/{ModalName}.tsx`
- Wire visibility: Add `show{Name}Modal` boolean state in `src/App.tsx`, render conditionally alongside mode views

**New device/platform capability:**
- Hook: `src/hooks/use{Capability}.ts`
- Usage: Call hook in `src/App.tsx`, pass returned values/callbacks as props to views

**New domain type:**
- Add interface/type to `src/types.ts`
- Import from `'../types'` in lib and components, from `'./types'` in `App.tsx`

**New persistence key:**
- Add `KEY_*` constant and load/save functions in `src/lib/storage.ts`
- Call from `App.tsx` init `useEffect` or event handlers

**Real computer vision / Gemini integration:**
- Implement in `src/lib/vision.ts` — preserve `InspectionAnalysisResult` return type
- Add API key reading via `import.meta.env.VITE_GEMINI_API_KEY` (Vite convention) if calling Gemini client-side
- Do not add server code unless introducing a new top-level directory (e.g., `server/`)

**New i18n strings:**
- Add keys to both `cn` and `en` objects in `I18N` at `src/lib/constants.ts`
- Access in components via `const t = I18N[lang]`

**New static asset (icon, image):**
- Place in `public/` for fixed URLs (e.g., `/icon.svg`)
- Reference in `index.html`, `public/manifest.json`, or component `src` attributes

**New global CSS utility:**
- Add to `src/index.css` inside `@layer utilities { }`

**Styling:**
- Use Tailwind utility classes inline in component JSX — no separate CSS modules or `.css` files per component

## Special Directories

**`public/`:**
- Purpose: Static assets at build output root
- Generated: No
- Committed: Yes

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes (`npm run build`)
- Committed: No (removed by `npm run clean`)

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (this file and siblings)
- Generated: Yes (by `/gsd-map-codebase`)
- Committed: Typically yes for team reference

**`.claude/` / `.cursor/`:**
- Purpose: GSD tooling, agents, hooks — not part of application runtime
- Ignore for application development unless modifying GSD workflows

**Dependencies not yet used in `src/`:**
- `@google/genai` — listed in `package.json`, intended for Gemini vision API
- `express` — listed in `package.json`, no `server.js` present
- `motion` — listed in `package.json`, no imports in `src/`
- `canvas-confetti` — used only in `src/components/ResultInspectView.tsx`

---

*Structure analysis: 2026-09-20*
