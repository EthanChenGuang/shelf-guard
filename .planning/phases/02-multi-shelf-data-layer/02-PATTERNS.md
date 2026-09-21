# Phase 2: Multi-Shelf Data Layer - Pattern Map

**Mapped:** 2026-09-21
**Files analyzed:** 15
**Analogs found:** 13 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/shelfStorage.ts` | service | CRUD + file-I/O | `src/lib/storage.ts` | exact |
| `src/lib/storage.ts` | service | CRUD | `src/lib/storage.ts` (global keys only) | exact |
| `src/lib/blobUtils.ts` | utility | transform | `src/lib/imageDimensions.ts` | role-match |
| `src/lib/objectUrlRegistry.ts` | utility | transform | `src/components/OfflineIndicator.tsx` (effect cleanup) | flow-match |
| `src/types/persisted.ts` | model | transform | `src/types.ts` | exact |
| `src/App.tsx` | provider | event-driven + request-response | `src/App.tsx` | exact |
| `src/components/ShelfSelector.tsx` | component | event-driven | `src/components/ResultInspectView.tsx` (tolerance stepper) | role-match |
| `src/components/CameraView.tsx` | component | request-response | `src/components/CameraView.tsx` (camera error banner) | exact |
| `src/lib/constants.ts` | config | — | `src/lib/constants.ts` (I18N block) | exact |
| `src/lib/imageDimensions.ts` | utility | transform | `src/lib/imageDimensions.ts` | exact |
| `src/lib/shelfStorage.test.ts` | test | batch | `src/App.baseline.test.ts` + RESEARCH.md fake-indexeddb sketch | partial |
| `src/lib/blobUtils.test.ts` | test | transform | `src/App.baseline.test.ts` (MockImage) | role-match |
| `src/App.shelfIsolation.integration.test.tsx` | test | event-driven | `src/App.processing.integration.test.tsx` | exact |
| `src/components/CameraView.quota.test.tsx` | test | request-response | `src/components/CameraView.error.test.tsx` | exact |
| `vitest.setup.ts` | config | — | `vitest.setup.ts` | exact |

## Pattern Assignments

### `src/lib/shelfStorage.ts` (service, CRUD + file-I/O)

**Analog:** `src/lib/storage.ts`

**Imports pattern** (lines 1-3):

```typescript
import { get, set, del } from 'idb-keyval';
import { AuditRecord, Language, ShelfCalibration, ToleranceLevel } from '../types';
import { DEFAULT_CALIBRATION, DEFAULT_SHELF_IMAGE_URL } from './constants';
```

Extend with `setMany`, `delMany` from idb-keyval for atomic migration. Import persisted types from `../types/persisted` and blob helpers from `./blobUtils`.

**Key constants pattern** (lines 5-16):

```typescript
const KEY_BASELINE = 'shelfguard_baseline';
const LEGACY_CDN_BASELINE_PATTERN = /googleusercontent\.com/i;
// ...
const KEY_HISTORY = 'shelfguard_audit_history';
const KEY_LANG = 'shelfguard_lang';
const KEY_TOLERANCE = 'shelfguard_tolerance';
```

Replace with shelf-scoped key builders:

```typescript
const baselineKey = (shelfId: number) => `shelf:${shelfId}:baseline`;
const historyKey = (shelfId: number) => `shelf:${shelfId}:history`;
const KEY_ACTIVE_SHELF = 'shelfguard_active_shelf';
const KEY_SCHEMA_VERSION = 'shelfguard_schema_version';
const CURRENT_SCHEMA = 2;
const HISTORY_CAP = 20;
```

**Core load pattern with fallback** (lines 18-31):

```typescript
export async function loadBaseline(): Promise<ShelfCalibration> {
  try {
    const data = await get<ShelfCalibration>(KEY_BASELINE);
    if (data && data.splitYPercentages && data.splitYPercentages.length === 4) {
      const migrated = migrateBaselineIfNeeded(data);
      if (migrated.imageDataUrl !== data.imageDataUrl) {
        await set(KEY_BASELINE, migrated);
      }
      return migrated;
    }
  } catch (err) {
    console.warn('Failed to load baseline from IndexedDB, using default:', err);
  }
  return DEFAULT_CALIBRATION;
}
```

New `loadBaseline(shelfId)` should: read `PersistedBaseline` from `baselineKey(shelfId)`, validate `splitYPercentages.length === 4`, map to view shape via `toViewBaseline(persisted, displayUrl)`, return `{ ok: true, data }` or fall back to `DEFAULT_CALIBRATION` with `console.warn` on read failure (D-20 read path).

**Core save + history cap pattern** (lines 34-69):

```typescript
export async function saveBaseline(calibration: ShelfCalibration): Promise<void> {
  try {
    await set(KEY_BASELINE, calibration);
  } catch (err) {
    console.error('Failed to save baseline to IndexedDB:', err);
  }
}

export async function saveAuditRecord(record: AuditRecord): Promise<void> {
  try {
    const existing = await loadAuditHistory();
    const updated = [record, ...existing].slice(0, 50); // keep last 50
    await set(KEY_HISTORY, updated);
  } catch (err) {
    console.error('Failed to append audit record:', err);
  }
}
```

Phase 2 changes: add `shelfId` param, persist `PersistedBaseline`/`PersistedAuditRecord` with Blob fields, cap at 20 (not 50), return `StorageWriteResult` instead of void:

```typescript
export type StorageWriteResult =
  | { ok: true }
  | { ok: false; error: 'QUOTA_EXCEEDED' };

// On write failure:
if (isQuotaError(err)) return { ok: false, error: 'QUOTA_EXCEEDED' };
throw err; // non-quota errors still propagate or log+rethrow
```

**Migration pattern** — no existing analog; follow RESEARCH.md Pattern 2 using `setMany` then `delMany` on legacy keys. Gate on `get(KEY_SCHEMA_VERSION) !== 2`. Migrate to `shelf:0:*` only (D-01).

**Global settings unchanged** — keep `loadSavedLanguage` / `saveLanguage` / `loadSavedTolerance` / `saveTolerance` in `storage.ts` or re-export from `shelfStorage.ts`; do not shelf-scope these keys.

---

### `src/lib/storage.ts` (service, CRUD — refactor to thin wrapper)

**Analog:** `src/lib/storage.ts` (current global-key functions)

**Refactor approach:** Keep file as thin re-export layer for backward compatibility during Phase 2:

```typescript
// Global settings only — unchanged implementations from lines 72-106
export { loadSavedLanguage, saveLanguage, loadSavedTolerance, saveTolerance } from './shelfStorage';
// OR keep lang/tolerance here and delete shelf functions, delegating to shelfStorage
```

Deprecate flat `loadBaseline()` / `loadAuditHistory()` — either remove or make thin wrappers that call `loadBaseline(0)` with a `@deprecated` comment. Planner should pick one path; CONTEXT D-17 favors extraction to `shelfStorage.ts` as the contract.

**Global settings pattern to preserve** (lines 72-106):

```typescript
export async function loadSavedLanguage(): Promise<Language> {
  try {
    const lang = await get<Language>(KEY_LANG);
    if (lang === 'cn' || lang === 'en') return lang;
  } catch (err) {
    console.warn('Failed to load language setting:', err);
  }
  return 'cn';
}
```

Copy validation style (`lang === 'cn' || lang === 'en'`) for `loadActiveShelfId`: clamp to 0–4, default 0.

---

### `src/lib/blobUtils.ts` (utility, transform)

**Analog:** `src/lib/imageDimensions.ts`

**Imports / export style** (lines 1-12):

```typescript
/** Load natural dimensions from a data URL or image URL — used for baseline upload (STAB-04). */
export async function loadImageDimensions(
  dataUrl: string,
): Promise<{width: number; height: number}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({width: img.naturalWidth, height: img.naturalHeight});
    img.onerror = () => reject(new Error('Failed to load image dimensions'));
    img.src = dataUrl;
  });
}
```

Match conventions: JSDoc comment, named export, Promise-based async, reject on failure.

**New functions to add following same style:**

- `dataUrlToBlob(dataUrl: string): Promise<Blob>` — `fetch(dataUrl).then(r => r.blob())`
- `compressToJpegBlob(source, maxWidth=320, quality=0.75): Promise<Blob>` — Canvas + `toBlob('image/jpeg', quality)`
- `isQuotaError(err: unknown): boolean` — `err instanceof DOMException && err.name === 'QuotaExceededError'`

Extend `loadImageDimensions` (in `imageDimensions.ts` or here) to accept `Blob` via `URL.createObjectURL` + cleanup in `finally`.

---

### `src/lib/objectUrlRegistry.ts` (utility, transform — optional)

**Analog:** `src/components/OfflineIndicator.tsx` (effect cleanup lifecycle)

**Cleanup pattern** (lines 16-27):

```typescript
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
```

Apply same lifecycle discipline: `revokeAll()` on shelf switch and App unmount. Registry API from RESEARCH.md:

```typescript
export function createDisplayUrlRegistry() {
  const urls = new Map<string, string>();
  // set(key, blob) → createObjectURL; revoke(key); revokeAll()
  return { set, revoke, revokeAll };
}
```

Wire in App.tsx: call `registry.revokeAll()` before loading new shelf data; pass resolved URL strings into `setBaseline` / `setAuditHistory` view shapes (D-07).

---

### `src/types/persisted.ts` (model, transform)

**Analog:** `src/types.ts`

**Type definition pattern** (lines 11-18, 38-51):

```typescript
export interface ShelfCalibration {
  id: string;
  createdAt: number;
  imageDataUrl: string;
  imageDimensions: { width: number; height: number };
  splitYPercentages: [number, number, number, number];
  tierLabels: [string, string, string, string];
}

export interface AuditRecord {
  id: string;
  timestamp: number;
  // ...
  thumbnailUrl: string;
  anomalies: DetectedAnomaly[];
  tolerance: ToleranceLevel;
}
```

Add parallel persisted types with Blob suffix at storage boundary:

```typescript
export interface PersistedBaseline {
  id: string;
  createdAt: number;
  imageBlob: Blob;
  imageDimensions: { width: number; height: number };
  splitYPercentages: [number, number, number, number];
  tierLabels: [string, string, string, string];
}

export interface PersistedAuditRecord {
  // same fields as AuditRecord except thumbnailBlob: Blob instead of thumbnailUrl
}
```

Keep view types in `types.ts` unchanged — components still consume `imageDataUrl` / `thumbnailUrl` strings (RESEARCH open question #2 recommendation).

Add mapper functions in `shelfStorage.ts`:

```typescript
export function toViewBaseline(persisted: PersistedBaseline, displayUrl: string): ShelfCalibration { ... }
export function toViewAuditRecord(persisted: PersistedAuditRecord, thumbUrl: string): AuditRecord { ... }
```

---

### `src/App.tsx` (provider, event-driven + request-response)

**Analog:** `src/App.tsx`

**Storage imports pattern** (lines 11-21):

```typescript
import {
  clearBaseline,
  loadAuditHistory,
  loadBaseline,
  loadSavedLanguage,
  loadSavedTolerance,
  saveAuditRecord,
  saveBaseline,
  saveLanguage,
  saveTolerance,
} from './lib/storage';
```

Switch to `./lib/shelfStorage` for shelf-scoped functions; keep global settings import path.

**Mount hydration pattern** (lines 85-100):

```typescript
  useEffect(() => {
    async function init() {
      const [savedBase, savedLang, savedTol, savedHistory] = await Promise.all([
        loadBaseline(),
        loadSavedLanguage(),
        loadSavedTolerance(),
        loadAuditHistory(),
      ]);
      setBaseline(savedBase);
      setLang(savedLang);
      setTolerance(savedTol);
      setAuditHistory(savedHistory);
    }
    init();
  }, []);
```

Extend init sequence (D-14):

```typescript
async function init() {
  const migration = await runSchemaMigrationIfNeeded();
  if (!migration.ok) { setQuotaError(true); return; }

  const activeShelfId = await loadActiveShelfId();
  setActiveShelfId(activeShelfId);

  const [savedBase, savedLang, savedTol, savedHistory] = await Promise.all([
    loadBaseline(activeShelfId),
    loadSavedLanguage(),
    loadSavedTolerance(),
    loadAuditHistory(activeShelfId),
  ]);
  // resolve display URLs via registry before setState
}
```

**Save handler pattern** (lines 190-217, 219-230):

```typescript
  const handleCompleteAudit = async () => {
    const newRecord: AuditRecord = { /* ... */ thumbnailUrl: capturedFrame, /* ... */ };
    await saveAuditRecord(newRecord);
    setAuditHistory((prev) => [newRecord, ...prev]);
    // ...
  };

  const handleSaveRoiCalibration = async (updatedPercentages) => {
    const updated: ShelfCalibration = { ...baseline, splitYPercentages: updatedPercentages, createdAt: Date.now() };
    setBaseline(updated);
    await saveBaseline(updated);
    setAppMode('CAMERA_IDLE');
  };
```

Add `activeShelfId` to all save/load calls. Check `StorageWriteResult` and set `quotaError` state on `{ ok: false, error: 'QUOTA_EXCEEDED' }`. Compress thumbnail via `compressToJpegBlob` before persist in `handleCompleteAudit`.

**New shelf switch handler** (no existing analog — model after language toggle handler, lines 102-107):

```typescript
  const handleShelfChange = async (newShelfId: number) => {
    registry.revokeAll();
    setActiveShelfId(newShelfId);
    await saveActiveShelfId(newShelfId);
    const [base, history] = await Promise.all([
      loadBaseline(newShelfId),
      loadAuditHistory(newShelfId),
    ]);
    setBaseline(base);
    setAuditHistory(history);
  };
```

Pass `activeShelfId`, `onShelfChange`, `quotaError`, `onDismissQuotaError` to `CameraView`.

---

### `src/components/ShelfSelector.tsx` (component, event-driven)

**Analog:** `src/components/ResultInspectView.tsx` (tolerance stepper, lines 318-355)

**Segmented control pattern:**

```typescript
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              onClick={() => onToleranceChange('strict')}
              className={`flex flex-col items-center py-2 rounded-lg text-xs transition-all ${
                tolerance === 'strict'
                  ? 'bg-[#006C49] text-white font-semibold shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{t.strict}</span>
            </button>
            {/* ... */}
          </div>
```

Adapt to 5 shelves: `grid grid-cols-5 gap-1`, labels `"1"`–`"5"` mapping to indices 0–4 (D-01). Props:

```typescript
interface ShelfSelectorProps {
  activeShelfId: number; // 0-4
  onShelfChange: (shelfId: number) => void;
  lang: Language;
}
```

Active state: `activeShelfId === index ? 'bg-[#006C49] text-white ...' : 'bg-white ...'`. Place in CameraView top chrome (near language toggle) or above bottom control area — planner's discretion (D-15).

Alternative minimal pattern from `CameraView.tsx` pill buttons (lines 250-261) if horizontal space is tight:

```typescript
          <button
            onClick={onToggleDemoMode}
            className={`px-2 h-7 rounded-full flex items-center gap-1 text-[11px] font-medium transition-colors ${
              isUsingDemoFeed
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-emerald-50 text-emerald-700 font-semibold'
            }`}
          >
```

Use 5 small `rounded-full` buttons in a flex row for QA switcher.

---

### `src/components/CameraView.tsx` (component, request-response)

**Analog:** `src/components/CameraView.tsx` (camera error banner)

**Props interface pattern** (lines 20-46):

```typescript
interface CameraViewProps {
  baseline: ShelfCalibration;
  lang: Language;
  // ...
  cameraError?: string | null;
  onRetryCamera?: () => void;
  onDismissCameraError?: () => void;
}
```

Add:

```typescript
  activeShelfId?: number;
  onShelfChange?: (shelfId: number) => void;
  quotaError?: boolean;
  onDismissQuotaError?: () => void;
```

**Inline banner pattern** (lines 341-369):

```typescript
        {cameraError && (
          <div
            role="alert"
            className="mb-4 w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-900/90 backdrop-blur-md px-4 py-3 text-white shadow-lg"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t.cameraPermissionDenied}</p>
                <p className="mt-1 text-xs text-slate-300">{cameraError}</p>
                <p className="mt-2 text-xs text-slate-400">{t.cameraErrorIosGuide}</p>
                {/* retry / dismiss buttons */}
              </div>
              {onDismissCameraError && (
                <button type="button" onClick={onDismissCameraError} aria-label={t.close} /* ... */>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
```

Duplicate structure for `quotaError` banner (D-18): same `role="alert"`, same Tailwind classes, use new I18N keys `t.quotaExceededTitle` / `t.quotaExceededGuide`. Dismiss only (no retry — write already blocked per D-19). Render above or below camera error banner in bottom control area (lines 339-340).

Render `<ShelfSelector />` in top-right tools row (lines 247-284) when `onShelfChange` provided.

---

### `src/lib/constants.ts` (config)

**Analog:** `src/lib/constants.ts` (I18N camera error keys, lines 126-128, 190-192)

**I18N key pattern:**

```typescript
    cameraPermissionDenied: '无法访问摄像头',
    cameraErrorIosGuide:
      '请在 Safari 中打开本页 → 设置 → [ShelfGuard] → 允许相机；或从 Safari「添加到主屏幕」重新安装。也可继续使用演示画面。',
```

Add parallel cn/en keys for quota banner (D-21):

```typescript
    quotaExceededTitle: '本地存储空间已满',
    quotaExceededGuide: '请先在其它货架完成巡检，或清除部分历史记录后再试。',
```

Mirror in `en` block with same key names. Also add shelf selector labels if needed (`shelfLabel: '货架'` / `'Shelf'`).

---

### `src/lib/imageDimensions.ts` (utility, transform — optional extend)

**Analog:** `src/lib/imageDimensions.ts`

Keep existing `loadImageDimensions(dataUrl: string)` unchanged for upload path. Add overload or sibling `loadImageDimensionsFromBlob(blob: Blob)` using object URL pattern:

```typescript
export async function loadImageDimensionsFromBlob(blob: Blob): Promise<{width: number; height: number}> {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImageDimensions(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

---

### `src/lib/shelfStorage.test.ts` (test, batch)

**Analog:** `src/App.baseline.test.ts` (unit lib test structure) — no existing storage test

**Test file structure** (lines 1-34):

```typescript
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {loadImageDimensions} from './lib/imageDimensions';

describe('App baseline upload (STAB-04)', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockImage);
  });

  it('loadImageDimensions returns naturalWidth/naturalHeight from data URL', async () => {
    const dims = await loadImageDimensions(TEST_DATA_URL);
    expect(dims.width).toBe(1920);
    expect(dims.height).toBe(1080);
  });
});
```

Adapt for storage tests:

```typescript
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clear, set, get } from 'idb-keyval';
import { runSchemaMigrationIfNeeded, loadBaseline, appendAuditRecord, loadActiveShelfId, saveActiveShelfId } from './shelfStorage';

beforeEach(async () => {
  await clear();
});

describe('migration (DATA-03)', () => {
  it('moves legacy baseline to shelf:0 and sets schema_version=2', async () => { /* ... */ });
});

describe('shelf isolation (DATA-01)', () => {
  it('shelf 0 baseline does not appear in shelf 1 load', async () => { /* ... */ });
});

describe('history cap (DATA-05)', () => {
  it('caps per-shelf history at 20 FIFO', async () => { /* ... */ });
});

describe('quota (DATA-04)', () => {
  it('returns QUOTA_EXCEEDED on DOMException', async () => { /* mock set to throw */ });
});
```

Add `import 'fake-indexeddb/auto'` to `vitest.setup.ts` (see below).

---

### `src/lib/blobUtils.test.ts` (test, transform)

**Analog:** `src/App.baseline.test.ts`

Reuse `MockImage` class pattern (lines 7-22) for Canvas compression tests. Stub `HTMLCanvasElement.prototype.toBlob` in jsdom. Test `isQuotaError` with `new DOMException('', 'QuotaExceededError')`.

---

### `src/App.shelfIsolation.integration.test.tsx` (test, event-driven)

**Analog:** `src/App.processing.integration.test.tsx`

**Mock setup pattern** (lines 1-66):

```typescript
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import {DEFAULT_CALIBRATION} from './lib/constants';

vi.mock('./lib/vision', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/vision')>();
  return { ...actual, analyzeShelfCapture: vi.fn(/* ... */) };
});

vi.mock('./hooks/useCameraStream', () => ({ useCameraStream: () => ({ /* ... */ }) }));
vi.mock('./hooks/useDeviceOrientation', () => ({ useDeviceOrientation: () => ({tilt: 0, isLevel: true}) }));
vi.mock('./hooks/usePWAInstall', () => ({ usePWAInstall: () => ({canInstall: false, promptInstall: vi.fn()}) }));
```

**Critical decision for isolation tests:** Prefer **real `fake-indexeddb`** over mocking storage (RESEARCH Validation Architecture). Remove or minimize `vi.mock('./lib/storage')` so shelf writes actually persist in fake IndexedDB. Seed distinct baseline IDs on shelf 0 and shelf 1, render App, click shelf selector label "2" (index 1), assert baseline ID differs.

Copy hook mocks from lines 31-54. Add `beforeEach(() => clear())` with fake-indexeddb.

Test cases (D-16):
- Shelf A baseline does not appear when active shelf is B
- Shelf A history count not visible when switched to B
- `activeShelfId` restored from `shelfguard_active_shelf` on remount (SHLF-04)

---

### `src/components/CameraView.quota.test.tsx` (test, request-response)

**Analog:** `src/components/CameraView.error.test.tsx`

**Base props + describe pattern** (lines 1-63):

```typescript
import {describe, expect, it, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CameraView} from './CameraView';
import {DEFAULT_CALIBRATION} from '../lib/constants';

const baseProps = {
  baseline: DEFAULT_CALIBRATION,
  lang: 'cn' as const,
  onLanguageToggle: vi.fn(),
  // ...
};

describe('CameraView error banner (CAM-08)', () => {
  it('renders cameraPermissionDenied and cameraErrorIosGuide when cameraError set', () => {
    render(<CameraView {...baseProps} cameraError="Permission denied by user" />);
    expect(screen.getByText('无法访问摄像头')).toBeInTheDocument();
  });

  it('fires onDismissCameraError when dismiss clicked', () => {
    const onDismiss = vi.fn();
    render(<CameraView {...baseProps} cameraError="Error" onDismissCameraError={onDismiss} />);
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
```

Adapt for quota:

```typescript
describe('CameraView quota banner (DATA-04)', () => {
  it('renders quotaExceededTitle when quotaError is true', () => {
    render(<CameraView {...baseProps} quotaError={true} />);
    expect(screen.getByText('本地存储空间已满')).toBeInTheDocument();
  });

  it('fires onDismissQuotaError when dismiss clicked', () => { /* same as camera dismiss */ });
});
```

---

### `vitest.setup.ts` (config)

**Analog:** `vitest.setup.ts`

**Current content** (line 1):

```typescript
import '@testing-library/jest-dom/vitest';
```

Add before other imports:

```typescript
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
```

Install `fake-indexeddb@6.2.5` as devDependency (RESEARCH Wave 0 gap).

---

## Shared Patterns

### IndexedDB via idb-keyval

**Source:** `src/lib/storage.ts`
**Apply to:** `shelfStorage.ts`, all storage tests

```typescript
import { get, set, del } from 'idb-keyval';
```

Phase 2 adds `setMany`, `delMany` for atomic migration. Never use raw IndexedDB API.

### Read Fallback with console.warn

**Source:** `src/lib/storage.ts` lines 28-30, 56-58
**Apply to:** All `load*` functions in `shelfStorage.ts`

```typescript
  } catch (err) {
    console.warn('Failed to load baseline from IndexedDB, using default:', err);
  }
  return DEFAULT_CALIBRATION;
```

Reads never surface UI errors; writes return structured quota errors.

### Structured Write Results (Phase 2 new)

**Source:** RESEARCH.md Pattern 1 + current anti-pattern at `storage.ts:37-38`
**Apply to:** `saveBaseline`, `appendAuditRecord`, `runSchemaMigrationIfNeeded`

Current silent failure to replace:

```typescript
  } catch (err) {
    console.error('Failed to save baseline to IndexedDB:', err);
  }
```

New pattern:

```typescript
  } catch (err) {
    if (isQuotaError(err)) return { ok: false, error: 'QUOTA_EXCEEDED' };
    console.error('Failed to save baseline to IndexedDB:', err);
    throw err;
  }
```

### I18N via I18N[lang]

**Source:** `src/components/CameraView.tsx` line 75, `src/lib/constants.ts` lines 71-200
**Apply to:** ShelfSelector labels, quota banner, any new user-facing strings

```typescript
  const t = I18N[lang];
```

Add keys to both `cn` and `en` objects; never hardcode strings in components.

### Inline Alert Banner UX

**Source:** `src/components/CameraView.tsx` lines 341-369
**Apply to:** Quota banner (DATA-04), reuse camera error banner contract

Shared structure: `role="alert"`, amber border, `AlertCircle` icon, dismiss `X` button with `aria-label={t.close}`, placed in bottom control area above shutter.

### FIFO History Prepend + Slice

**Source:** `src/lib/storage.ts` line 65
**Apply to:** `appendAuditRecord(shelfId, record)` in `shelfStorage.ts`

```typescript
const updated = [record, ...existing].slice(0, HISTORY_CAP); // HISTORY_CAP = 20
```

### App Init Parallel Load

**Source:** `src/App.tsx` lines 88-93
**Apply to:** Mount hydration and shelf switch reload

```typescript
const [savedBase, savedLang, savedTol, savedHistory] = await Promise.all([
  loadBaseline(activeShelfId),
  loadSavedLanguage(),
  loadSavedTolerance(),
  loadAuditHistory(activeShelfId),
]);
```

Migration and `loadActiveShelfId` run **before** this parallel block.

### Vitest + jsdom Test Conventions

**Source:** `vitest.config.ts`, `src/App.processing.integration.test.tsx`, `src/components/CameraView.error.test.tsx`
**Apply to:** All new test files

- Environment: jsdom (`vitest.config.ts:6`)
- Globals: true — no need to import `describe`/`it` if using globals (project currently imports explicitly)
- Component tests: `@testing-library/react` + `fireEvent` / `userEvent`
- Integration tests: mock hooks (`useCameraStream`, `useDeviceOrientation`, `usePWAInstall`, `vision`), prefer real storage with fake-indexeddb

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/shelfStorage.test.ts` | test | batch | No existing storage/migration unit tests; use RESEARCH.md + `App.baseline.test.ts` structure as template |
| `src/lib/objectUrlRegistry.ts` | utility | transform | No object URL lifecycle module exists; RESEARCH.md Pattern 3 is the spec; closest cleanup analog is React effect pattern in OfflineIndicator |

---

## Metadata

**Analog search scope:** `src/lib/`, `src/components/`, `src/App.tsx`, `src/types.ts`, `vitest.config.ts`, `vitest.setup.ts`, existing `*.test.ts(x)` files
**Files scanned:** 26 source files + 8 test files
**Pattern extraction date:** 2026-09-21
**Git-tracked analog verification:** All cited analog paths confirmed via `git ls-files`
