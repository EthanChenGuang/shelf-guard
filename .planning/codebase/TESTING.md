# Testing Patterns

**Analysis Date:** 2026-09-20

## Test Framework

**Runner:**
- Not detected — no Vitest, Jest, Playwright, or Cypress in `package.json`
- Config: none (`vitest.config.*`, `jest.config.*` absent)

**Assertion Library:**
- Not applicable (no test runner installed)

**Run Commands:**
```bash
npm run lint          # Type-check only (tsc --noEmit) — current quality gate
npm run dev           # Manual browser testing at http://localhost:3000
npm run build         # Production build smoke test
npm run preview       # Preview production build locally
```

There is no `test`, `test:watch`, or `test:coverage` script. Adding tests requires installing a runner and adding scripts to `package.json`.

## Test File Organization

**Location:**
- No test files exist in the repository (`*.test.*`, `*.spec.*` — zero matches under application code)
- When adding tests, use **co-located** files next to the module under test (matches small `src/` layout):

```
src/
├── lib/
│   ├── storage.ts
│   ├── storage.test.ts       # unit tests for IndexedDB helpers
│   ├── vision.ts
│   └── vision.test.ts        # unit tests for analysis + canvas capture
├── hooks/
│   ├── useCameraStream.ts
│   └── useCameraStream.test.ts
├── components/
│   ├── CameraView.tsx
│   └── CameraView.test.tsx
└── App.test.tsx              # integration / state-machine tests
```

**Naming:**
- Use `*.test.ts` for non-React modules
- Use `*.test.tsx` for components and hooks that render JSX
- Alternative `*.spec.ts(x)` is acceptable but pick one — prefer `*.test.*` for consistency with Vitest defaults

**Structure:**
```
src/lib/vision.test.ts          # pure logic, no DOM
src/hooks/usePWAInstall.test.tsx # @testing-library/react
src/components/CameraView.test.tsx
```

## Test Structure

**Suite Organization:**
No existing pattern in the codebase. When introducing tests, follow this structure aligned with current module boundaries:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzeShelfCapture } from './vision';
import { DEFAULT_CALIBRATION } from './constants';

describe('analyzeShelfCapture', () => {
  it('returns all mock anomalies at normal tolerance', async () => {
    const result = await analyzeShelfCapture(
      'data:image/jpeg;base64,test',
      DEFAULT_CALIBRATION,
      'normal'
    );
    expect(result.missingCount).toBe(1);
    expect(result.displacedCount).toBe(2);
    expect(result.complianceRate).toBe(94);
  });

  it('filters to missing-only at loose tolerance', async () => {
    const result = await analyzeShelfCapture(
      'data:image/jpeg;base64,test',
      DEFAULT_CALIBRATION,
      'loose'
    );
    expect(result.anomalies.every((a) => a.type === 'MISSING')).toBe(true);
    expect(result.displacedCount).toBe(0);
  });

  it('adds extra anomaly at strict tolerance', async () => {
    const result = await analyzeShelfCapture(
      'data:image/jpeg;base64,test',
      DEFAULT_CALIBRATION,
      'strict'
    );
    expect(result.anomalies.length).toBeGreaterThan(3);
  });
});
```

**Patterns:**
- **Setup:** Use `beforeEach` to reset mocks; no shared global test setup file exists yet — create `src/test/setup.ts` when adding Vitest
- **Teardown:** React Testing Library auto-cleans DOM; IndexedDB tests should use an in-memory mock or `fake-indexeddb` package
- **Assertions:** Use Vitest `expect` — no assertion library beyond the runner needed

## Mocking

**Framework:**
- Not installed. Recommended: **Vitest** built-in `vi` mocks (compatible with Vite 8 project)

**Patterns:**
```typescript
// Mock idb-keyval in storage tests
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

// Mock browser APIs in hook tests
beforeEach(() => {
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockRejectedValue(new Error('denied')),
    },
    vibrate: vi.fn(),
  });
});

// Mock canvas for vision/capture tests
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  drawImage: vi.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,mock');
```

**What to Mock:**
- `idb-keyval` (`get`, `set`, `del`) — all persistence in `src/lib/storage.ts`
- `navigator.mediaDevices.getUserMedia` — camera success/failure paths in `src/hooks/useCameraStream.ts`
- `HTMLCanvasElement` / `CanvasRenderingContext2D` — frame capture in `src/lib/vision.ts` and `useCameraStream.ts`
- `DeviceOrientationEvent` / `window.addEventListener('deviceorientation')` — tilt logic in `src/hooks/useDeviceOrientation.ts`
- `beforeinstallprompt` / `appinstalled` events — PWA install in `src/hooks/usePWAInstall.ts`
- `setTimeout` — scanning animation delay (800ms) and audit completion (400ms) in `src/App.tsx` when testing mode transitions

**What NOT to Mock:**
- Pure calculation logic inside `analyzeShelfCapture` tolerance branches — test with real function, mock inputs only
- `I18N` strings — use real `src/lib/constants.ts` to verify keys exist for both languages
- React state updates in component tests — use `@testing-library/react` `render` + `userEvent` instead of mocking `useState`

## Fixtures and Factories

**Test Data:**
No fixtures exist. Reuse production defaults as test baselines:

```typescript
import { DEFAULT_CALIBRATION, INITIAL_MOCK_ANOMALIES } from '../lib/constants';
import type { AuditRecord, DetectedAnomaly, ShelfCalibration } from '../types';

export function makeShelfCalibration(
  overrides: Partial<ShelfCalibration> = {}
): ShelfCalibration {
  return { ...DEFAULT_CALIBRATION, ...overrides };
}

export function makeAuditRecord(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: 'audit-test-1',
    timestamp: Date.now(),
    dateStr: '9/20',
    timeStr: '12:00',
    complianceRate: 94,
    standardCount: 24,
    actualCount: 23,
    missingCount: 1,
    displacedCount: 2,
    thumbnailUrl: 'data:image/jpeg;base64,thumb',
    anomalies: INITIAL_MOCK_ANOMALIES,
    tolerance: 'normal',
    ...overrides,
  };
}
```

**Location:**
- Place shared factories in `src/test/factories.ts` (create when adding first test suite)
- Keep module-specific edge-case data inline in the test file

## Coverage

**Requirements:** None enforced — no coverage config, thresholds, or CI gate

**View Coverage:**
```bash
# After adding vitest with coverage provider:
npx vitest run --coverage
```

Recommended starting targets when tests are introduced:
- **High priority:** `src/lib/vision.ts`, `src/lib/storage.ts` (business logic)
- **Medium priority:** `src/hooks/*.ts` (device behavior with mocks)
- **Lower priority:** `src/components/*.tsx` (visual/UI — snapshot or interaction smoke tests)

## Test Types

**Unit Tests:**
- Scope: pure functions and isolated async helpers
- Primary targets:
  - `analyzeShelfCapture` — tolerance filtering, compliance math (`src/lib/vision.ts`)
  - `captureElementToDataUrl` — canvas fallback when `getContext` returns null
  - Storage load/save — validation guards, default fallbacks, 50-record cap (`src/lib/storage.ts`)
  - Compliance recalculation in `handleDismissAnomaly` logic (extract or test via `App.test.tsx`)

**Integration Tests:**
- Scope: React component + hook wiring, App state machine transitions
- Primary targets:
  - `App.tsx` mode flow: `CAMERA_IDLE` → shutter → `SCANNING_ANIM` → `RESULT_INSPECT` (mock `analyzeShelfCapture`, fake timers)
  - `RoiSetupView` pointer drag updating split percentages and calling `onSave`
  - `ResultInspectView` dismiss animation calling `onDismissAnomaly`
- Tooling: `@testing-library/react`, `@testing-library/user-event`, `jsdom` environment

**E2E Tests:**
- Not used
- Manual QA path: run `npm run dev`, use demo feed (`isUsingDemoFeed` defaults to `true`), exercise shutter → results → complete audit → history modal
- Real camera/orientation/PWA flows require physical device or Playwright with fake media (future)

## Common Patterns

**Async Testing:**
```typescript
it('persists language preference', async () => {
  const { set } = await import('idb-keyval');
  vi.mocked(set).mockResolvedValue(undefined);

  const { saveLanguage } = await import('./storage');
  await saveLanguage('en');

  expect(set).toHaveBeenCalledWith('shelfguard_lang', 'en');
});
```

**Error Testing:**
```typescript
it('returns default baseline when IndexedDB read throws', async () => {
  const { get } = await import('idb-keyval');
  vi.mocked(get).mockRejectedValue(new Error('QuotaExceeded'));

  const { loadBaseline } = await import('./storage');
  const result = await loadBaseline();

  expect(result).toEqual(DEFAULT_CALIBRATION);
});
```

**React hook testing:**
```typescript
import { renderHook, act } from '@testing-library/react';
import { useDeviceOrientation } from './useDeviceOrientation';

it('marks level when gamma within threshold', () => {
  const { result } = renderHook(() => useDeviceOrientation());

  act(() => {
    result.current.setSimulatedTilt(0.5);
  });

  expect(result.current.isLevel).toBe(true);
  expect(result.current.tilt).toBe(0.5);
});
```

**Timer testing (App scanning transition):**
```typescript
vi.useFakeTimers();

// trigger handleShutterClick ...
await vi.runAllTimersAsync();

expect(screen.getByRole(...)).toBeInTheDocument(); // RESULT_INSPECT view
vi.useRealTimers();
```

## Recommended Test Stack (Not Yet Installed)

When adding automated tests, align with existing Vite + React 19 + TypeScript 7 toolchain:

| Package | Purpose |
|---------|---------|
| `vitest` | Test runner (native Vite integration) |
| `@testing-library/react` | Component rendering |
| `@testing-library/user-event` | Pointer/keyboard interactions |
| `@testing-library/jest-dom` | DOM matchers (`toBeInTheDocument`) |
| `jsdom` | Browser environment |
| `@vitest/coverage-v8` | Coverage reports |
| `fake-indexeddb` | Optional — in-memory IndexedDB for storage tests |

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

Create `vitest.config.ts` extending Vite config with `environment: 'jsdom'` and `setupFiles: ['src/test/setup.ts']`.

## Current Quality Gate

The only automated check today is TypeScript compilation:

```bash
npm run lint   # tsc --noEmit
```

This catches type errors but not runtime behavior, tolerance logic regressions, storage validation, or UI state transitions. All of those are currently verified manually via the demo shelf feed in the browser.

## Test Coverage Gaps (Priority)

| Area | What's not tested | Files | Risk | Priority |
|------|-------------------|-------|------|----------|
| Vision analysis | Tolerance branches, compliance formula | `src/lib/vision.ts` | Wrong audit results when real CV replaces mocks | **High** |
| Storage | IDB failures, shape validation, history cap | `src/lib/storage.ts` | Silent data loss or corrupt baseline | **High** |
| App state machine | Mode transitions, timer delays | `src/App.tsx` | Broken scan → result flow | **High** |
| Camera hook | Demo fallback, capture dimensions | `src/hooks/useCameraStream.ts` | Blank captures on device | **Medium** |
| ROI drag | Split bounds, save callback | `src/components/RoiSetupView.tsx` | Invalid tier boundaries | **Medium** |
| Dismiss/compliance | Recalc after anomaly dismiss | `src/App.tsx`, `src/components/ResultInspectView.tsx` | Incorrect compliance display | **Medium** |
| i18n | Key parity cn/en | `src/lib/constants.ts` | Missing translations | **Low** |
| PWA install | Prompt handling | `src/hooks/usePWAInstall.ts` | Install button no-op | **Low** |

---

*Testing analysis: 2026-09-20*
