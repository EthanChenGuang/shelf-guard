# Coding Conventions

**Analysis Date:** 2026-09-20

## Naming Patterns

**Files:**
- Use **PascalCase** for React component files: `CameraView.tsx`, `ResultInspectView.tsx`, `AuditHistoryModal.tsx`
- Use **camelCase** prefixed with `use` for custom hooks: `useCameraStream.ts`, `useDeviceOrientation.ts`, `usePWAInstall.ts`
- Use **camelCase** for non-component modules: `storage.ts`, `vision.ts`, `constants.ts`
- Use a single shared types file at `src/types.ts` (not split by domain)
- Entry files: `src/main.tsx` (bootstrap), `src/App.tsx` (root component), `src/index.css` (global styles)

**Functions:**
- Use **camelCase** for all functions: `loadBaseline`, `analyzeShelfCapture`, `captureFrame`, `handleShutterClick`
- Prefix event handlers in components with `handle`: `handleDismissAnomaly`, `handleToleranceChange`, `handleSaveRoiCalibration`
- Prefix storage accessors with load/save/clear: `loadAuditHistory`, `saveBaseline`, `clearBaseline`
- Prefix boolean state with `is`/`has`/`show`: `isLevel`, `isUsingDemoFeed`, `showHistoryModal`, `hasSensor`

**Variables:**
- Use **camelCase** for variables and state: `ghostOpacity`, `capturedFrame`, `complianceRate`
- Use **SCREAMING_SNAKE_CASE** for IndexedDB key constants in `src/lib/storage.ts`: `KEY_BASELINE`, `KEY_HISTORY`, `KEY_LANG`, `KEY_TOLERANCE`
- Use **UPPER_SNAKE_CASE** for exported config constants in `src/lib/constants.ts`: `DEFAULT_SHELF_IMAGE_URL`, `DEFAULT_SPLIT_Y`, `INITIAL_MOCK_ANOMALIES`
- Localize UI strings via `I18N[lang]` — assign to `const t = I18N[lang]` at the top of each component

**Types:**
- Use **PascalCase** for interfaces and type aliases: `ShelfCalibration`, `DetectedAnomaly`, `AuditRecord`, `AppMode`
- Use **string literal unions** for enums (no TypeScript `enum` keyword): `'strict' | 'normal' | 'loose'`, `'cn' | 'en'`, `'MISSING' | 'MOVED'`
- Suffix component prop interfaces with `Props`: `CameraViewProps`, `ResultInspectViewProps`, `RoiSetupViewProps`
- Keep prop interfaces **file-local** (not exported) unless shared across files
- Export domain types from `src/types.ts` only; export function-specific result types next to the function (e.g. `InspectionAnalysisResult` in `src/lib/vision.ts`)

## Code Style

**Formatting:**
- No Prettier or ESLint config detected in the application repo
- Type-checking is the only automated style gate: `npm run lint` runs `tsc --noEmit` per `package.json`
- Use **2-space indentation** (consistent across all `src/` files)
- Use **single quotes** for string literals in TypeScript/TSX
- Semicolons are used consistently
- Trailing commas in multi-line objects, arrays, and destructuring
- `main.tsx` uses compact import style (`{StrictMode}` without spaces); elsewhere use spaced braces — match the file you edit

**Linting:**
- Tool: TypeScript compiler only (`typescript` ^7.0.2)
- Config: `tsconfig.json` — **strict mode is not enabled** (`strict`, `noImplicitAny`, etc. are absent)
- JSX: `react-jsx` transform — do not import React solely for JSX in new files, but existing components import `React` explicitly; match neighboring files in the same directory
- Run before commit: `npm run lint`

**Styling (Tailwind CSS v4):**
- Use Tailwind utility classes inline in `className` strings — no CSS modules or styled-components
- Global utilities live in `src/index.css` via `@import "tailwindcss"` and `@layer utilities`
- Brand palette (use consistently):
  - Background: `#F8FAFC`, `#0F172A` (dark camera view)
  - Primary green: `#10B981`, `#006C49`
  - Accent blue: `#38BDF8`
  - Text: `#0F172A`, slate variants for secondary text
- Use arbitrary values for brand hex: `bg-[#0F172A]`, `text-[#10B981]`
- Mobile-first: `min-h-[100dvh]`, `fixed inset-0`, `select-none`, `overscroll-none`
- Icons: import from `lucide-react` by name, size via `className="w-5 h-5"`
- Animations: prefer Tailwind built-ins (`animate-pulse`, `animate-ping`, `animate-spin`) and component-scoped `<style>` blocks for custom keyframes (see `src/components/ScanningAnimationOverlay.tsx`)

## Import Organization

**Order:**
1. React and React hooks (`react`)
2. Third-party libraries (`lucide-react`, `canvas-confetti`, etc.)
3. Types from `../types` or `./types`
4. Lib modules (`../lib/constants`, `../lib/storage`, `../lib/vision`)
5. Hooks (`../hooks/useCameraStream`)
6. Components (`../components/CameraView`)

**Path Aliases:**
- `@/*` → project root is configured in `tsconfig.json` and `vite.config.ts`
- **Current codebase uses relative imports exclusively** — follow relative paths (`./lib/storage`, `../types`) to match existing files unless a phase explicitly standardizes on `@/`

**Extensions:**
- `src/main.tsx` imports App with explicit extension: `import App from './App.tsx'`
- All other imports omit `.ts`/`.tsx` extensions

## Error Handling

**Patterns:**
- Wrap IndexedDB operations in `try/catch`; log with `console.warn` on read failure, `console.error` on write failure; return safe defaults (`DEFAULT_CALIBRATION`, `[]`, `'cn'`, `'normal'`) — see `src/lib/storage.ts`
- Validate loaded data shape before trusting it (e.g. check `splitYPercentages.length === 4`, `lang === 'cn' || lang === 'en'`)
- For optional browser APIs (`navigator.vibrate`, torch constraints, pointer capture), wrap in `try/catch` with empty catch or `console.warn` — never throw to the UI layer
- Camera initialization failure falls back to demo feed silently: `setIsUsingDemoFeed(true)` in `src/hooks/useCameraStream.ts`
- Canvas/context failures return empty string or fallback URL: `if (!ctx) return ''` in `src/lib/vision.ts`, `return DEFAULT_SHELF_IMAGE_URL` in `captureFrame`
- Do **not** use Error boundaries — errors are handled locally per call site
- Do **not** propagate errors to callers from storage helpers; swallow and default

**Example (storage read pattern — follow this):**
```typescript
export async function loadBaseline(): Promise<ShelfCalibration> {
  try {
    const data = await get<ShelfCalibration>(KEY_BASELINE);
    if (data && data.splitYPercentages && data.splitYPercentages.length === 4) {
      return data;
    }
  } catch (err) {
    console.warn('Failed to load baseline from IndexedDB, using default:', err);
  }
  return DEFAULT_CALIBRATION;
}
```

## Logging

**Framework:** `console` only — no structured logging library

**Patterns:**
- `console.warn` — recoverable read failures, camera/torch degradation (`src/lib/storage.ts`, `src/hooks/useCameraStream.ts`)
- `console.error` — write/persist failures (`src/lib/storage.ts`)
- No `console.log` in production `src/` code
- Do not log user images, calibration data URLs, or audit records

## Comments

**When to Comment:**
- Use brief inline comments for non-obvious domain logic (tolerance filtering, compliance formula, animation timing)
- Use section comments in large JSX blocks: `{/* 1. Camera Video Stream */}`, `{/* Audit History Log Modal */}`
- Bilingual comments appear in `src/types.ts` (Chinese mode descriptions) — acceptable for domain types; prefer English for new implementation comments

**JSDoc/TSDoc:**
- Use block JSDoc on exported lib functions that describe behavior beyond the name — see `analyzeShelfCapture` and `captureElementToDataUrl` in `src/lib/vision.ts`
- Do not JSDoc every component or hook unless the contract is non-obvious

## Function Design

**Size:**
- Keep hooks and lib functions focused (single responsibility)
- `App.tsx` centralizes state machine and handlers — acceptable as orchestrator; extract new domains to `src/lib/` or `src/hooks/` rather than growing `App.tsx` further

**Parameters:**
- Pass `lang: Language` and domain objects (`baseline: ShelfCalibration`) as explicit props — avoid context providers (none used)
- Callback props use `on` prefix: `onSave`, `onClose`, `onDismissAnomaly`, `onToleranceChange`
- Optional callbacks marked with `?`: `onInstallPwa?: () => void`

**Return Values:**
- Async lib functions return typed results or `Promise<void>`
- Hooks return plain objects with named fields (not arrays): `{ videoRef, isUsingDemoFeed, captureFrame, ... }`
- Tuple types for fixed-length arrays: `[number, number, number, number]` for shelf tier splits

## Module Design

**Exports:**
- **Default export** only for `App.tsx` (root component)
- **Named exports** for everything else: components (`export const CameraView`), hooks (`export function useCameraStream`), lib functions, types
- Components typed as `React.FC<ComponentProps>` with destructured props

**Barrel Files:**
- Not used — import directly from source files (`from './components/CameraView'`, not `from './components'`)
- Do not add `index.ts` barrel re-exports unless a phase explicitly requires them

## Application Architecture Conventions

**State machine:**
- Drive UI via `AppMode` union in `src/types.ts`: `'CAMERA_IDLE' | 'SCANNING_ANIM' | 'ROI_CONFIG' | 'RESULT_INSPECT' | ...`
- Render one primary view per mode with conditional JSX in `src/App.tsx`
- Modals use separate boolean flags: `showHistoryModal`, `showResetModal`

**Internationalization:**
- All user-facing strings live in `I18N` object in `src/lib/constants.ts` keyed by `'cn' | 'en'`
- Access via `const t = I18N[lang]` — do not hardcode UI strings in components
- Add both `cn` and `en` entries when adding new strings

**Persistence:**
- Browser IndexedDB via `idb-keyval` wrapper in `src/lib/storage.ts`
- Cap audit history at 50 records: `.slice(0, 50)` in `saveAuditRecord`

**Vision/analysis:**
- Current implementation in `src/lib/vision.ts` uses mock anomaly data modulated by tolerance — treat as placeholder; preserve function signature `analyzeShelfCapture(capturedDataUrl, baseline, tolerance)` when replacing internals

**Device integration:**
- Custom hooks encapsulate browser APIs: camera (`useCameraStream`), orientation (`useDeviceOrientation`), PWA install (`usePWAInstall`)
- Guard `window`/`navigator` access with `typeof window !== 'undefined'` where needed

---

*Convention analysis: 2026-09-20*
