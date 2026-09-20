# Phase 01: Capture Foundation & Vercel Deploy - Pattern Map

**Mapped:** 2026-09-20
**Files analyzed:** 12
**Analogs found:** 11 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `vercel.json` | config | request-response (CDN routing/headers) | — (none in repo) | no analog |
| `vite.config.ts` | config | batch (build) | `vite.config.ts` (self) | exact |
| `package.json` | config | batch (deps) | `package.json` (self) | exact |
| `README.md` | config/docs | — | `README.md` (self) | exact |
| `src/App.tsx` | component/store | event-driven (FSM) | `src/App.tsx` (self) | exact |
| `src/hooks/useCameraStream.ts` | hook | streaming + file-I/O (canvas) | `src/hooks/useCameraStream.ts` (self) | exact |
| `src/components/CameraView.tsx` | component | request-response (UI props) | `src/components/CameraView.tsx` (self) | exact |
| `src/lib/constants.ts` | utility | transform (I18N) | `src/lib/constants.ts` (self) | exact |
| `src/components/OfflineIndicator.tsx` | component | event-driven (online/offline) | `src/components/OfflineIndicator.tsx` (self) | exact |
| `src/components/ScanningAnimationOverlay.tsx` | component | transform (overlay UI) | `src/components/ScanningAnimationOverlay.tsx` (self) | exact |
| `src/types.ts` | model | — | `src/types.ts` (reference only; no edits) | exact |
| `.planning/REQUIREMENTS.md` + `.planning/ROADMAP.md` | config/docs | — | `.planning/REQUIREMENTS.md` (self) | role-match |

**Note:** Brownfield source under `src/`, `vite.config.ts`, `package.json`, etc. exists on disk but is not yet git-tracked (repo currently commits `.planning/` only). These are real project sources, not `.gsd/capabilities/` mirror paths.

---

## Pattern Assignments

### `vercel.json` (config, request-response)

**Analog:** None in repo — follow `01-RESEARCH.md` Pattern 1 (build-verified paths).

**JSON structure convention** from `public/manifest.json` (lines 1-26):

```json
{
  "id": "/",
  "name": "ShelfGuard PWA",
  "short_name": "ShelfGuard",
  "description": "跨平台展架陈列变动即时巡检应用 - Instant Retail Shelf & Planogram Inspection PWA",
  "start_url": "/",
  "scope": "/",
  "display": "standalone"
}
```

**Deploy pattern to implement** (from RESEARCH, adapted to this repo's build output):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/(.*).html", "headers": [{ "key": "Cache-Control", "value": "no-store" }] },
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-store" }] },
    { "source": "/registerSW.js", "headers": [{ "key": "Cache-Control", "value": "no-store" }] },
    { "source": "/manifest.json", "headers": [
      { "key": "Cache-Control", "value": "no-store" },
      { "key": "Content-Type", "value": "application/manifest+json" }
    ]},
    { "source": "/workbox-(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```

**Critical path:** Use `/manifest.json` (from `public/manifest.json` + `index.html:21`), not `manifest.webmanifest`.

---

### `vite.config.ts` (config, batch)

**Analog:** `vite.config.ts` (self — keep existing PWA block)

**Imports pattern** (lines 1-5):

```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
```

**PWA plugin pattern — do not change registerType** (lines 12-19):

```typescript
VitePWA({
  registerType: 'autoUpdate',
  manifest: false,
  devOptions: {
    enabled: true,
    type: 'module',
  },
}),
```

**Path alias pattern** (lines 21-25):

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, '.'),
  },
},
```

**Discretion:** Optional `devOptions.enabled: process.env.NODE_ENV !== 'production'` — match existing `DISABLE_HMR` env pattern in `server` block (lines 26-32).

---

### `package.json` (config, batch)

**Analog:** `package.json` (self)

**Scripts pattern** (lines 6-12):

```json
"scripts": {
  "dev": "vite --port=3000 --host=0.0.0.0",
  "build": "vite build",
  "preview": "vite preview",
  "clean": "rm -rf dist server.js",
  "lint": "tsc --noEmit"
},
```

**Dependency hygiene pattern:** Remove `@google/genai`, `express`, `dotenv`, `motion`, `@types/express` — zero imports under `src/`. Rename `"name": "react-example"` → `"shelfguard"`. Keep pure-client deps: `vite`, `vite-plugin-pwa`, `idb-keyval`, `lucide-react`, `canvas-confetti`.

---

### `README.md` (config/docs)

**Analog:** `README.md` (self — replace AI Studio boilerplate)

**Current structure to replace** (lines 5-20):

```markdown
# Run and deploy your AI Studio app
...
1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
```

**Target pattern:** ShelfGuard local dev (`bun install` / `npm install`, `bun run dev`), Vercel deploy (connect Git, `main` production, preview on PRs), remove Gemini as primary path per D-20.

---

### `src/App.tsx` (component/store, event-driven FSM)

**Analog:** `src/App.tsx` (self)

**Imports pattern** (lines 1-32):

```typescript
import React, { useEffect, useState } from 'react';
import {
  AuditRecord,
  AppMode,
  DetectedAnomaly,
  Language,
  ShelfCalibration,
  ToleranceLevel,
} from './types';
import { DEFAULT_CALIBRATION, DEFAULT_SHELF_IMAGE_URL, I18N } from './lib/constants';
import { useCameraStream } from './hooks/useCameraStream';
import { CameraView } from './components/CameraView';
import { ScanningAnimationOverlay } from './components/ScanningAnimationOverlay';
import { OfflineIndicator } from './components/OfflineIndicator';
```

**FSM state pattern** (lines 35-36, 245-276):

```typescript
const [appMode, setAppMode] = useState<AppMode>('CAMERA_IDLE');

{appMode === 'CAMERA_IDLE' && (
  <CameraView ... />
)}

{appMode === 'SCANNING_ANIM' && (
  <ScanningAnimationOverlay lang={lang} frozenFrameUrl={capturedFrame} />
)}
```

**Hook destructuring — extend with cameraError, hasTorch** (lines 65-72):

```typescript
const {
  videoRef,
  isUsingDemoFeed,
  isTorchOn,
  toggleTorch,
  toggleDemoMode,
  captureFrame,
} = useCameraStream();
```

**Shutter handler to patch** (lines 114-138) — add `useRef` lock, pass `baseline.imageDataUrl` to `captureFrame`, decouple 800ms timer from analysis, add PROCESSING transition:

```typescript
const handleShutterClick = async () => {
  const frame = captureFrame();
  setCapturedFrame(frame);
  setAppMode('SCANNING_ANIM');
  // ...
  const result = await analyzeShelfCapture(frame, baseline, tolerance);
  // ...
  setTimeout(() => {
    setAppMode('RESULT_INSPECT');
  }, 800);
};
```

**Deferred setTimeout pattern** (from `handleCompleteAudit`, lines 179-182) — reuse for mode transitions:

```typescript
setTimeout(() => {
  setAppMode('CAMERA_IDLE');
}, 400);
```

**Baseline upload handler to patch** (lines 207-228) — add `imageDimensions` from loaded image:

```typescript
const handleUploadCustomBaseline = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        const newCalibration: ShelfCalibration = {
          ...baseline,
          id: `custom-baseline-${Date.now()}`,
          imageDataUrl: dataUrl,
          createdAt: Date.now(),
        };
        setBaseline(newCalibration);
        await saveBaseline(newCalibration);
        setShowResetModal(false);
        setAppMode('ROI_CONFIG');
      }
    };
    reader.readAsDataURL(file);
  }
};
```

**useRef analog** from `src/hooks/useDeviceOrientation.ts` (line 7): `const lastVibrateTime = useRef<number>(0);` — use same style for `captureLockRef`.

**PROCESSING render:** Add `{appMode === 'PROCESSING' && <ScanningAnimationOverlay ... />}` mirroring SCANNING_ANIM block; optionally pass processing copy via new I18N key or prop.

**Prop wiring to CameraView:** Pass `cameraError`, `onDismissCameraError`, `hasTorch`, `isCaptureLocked` (derived from `appMode === 'SCANNING_ANIM' || captureLockRef`).

---

### `src/hooks/useCameraStream.ts` (hook, streaming + file-I/O)

**Analog:** `src/hooks/useCameraStream.ts` (self); hook conventions from `src/hooks/usePWAInstall.ts`

**Imports pattern** (lines 1-2):

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SHELF_IMAGE_URL } from '../lib/constants';
```

**State + error handling pattern** (lines 7-11, 38-42):

```typescript
const [cameraError, setCameraError] = useState<string | null>(null);
const [isUsingDemoFeed, setIsUsingDemoFeed] = useState<boolean>(true);

// in startCamera catch:
console.warn('Camera access could not be initialized:', err);
setCameraError((err as Error).message);
setIsUsingDemoFeed(true);
```

**Return object pattern** (from `usePWAInstall.ts`, lines 56-61):

```typescript
return {
  isInstallable: !!deferredPrompt,
  isInstalled,
  isIOS,
  install,
};
```

Apply same explicit export shape in `useCameraStream` — add `hasTorch`, `clearCameraError` (or `dismissCameraError`).

**Torch honesty patch** (lines 55-77) — remove fallthrough at line 76:

```typescript
const toggleTorch = useCallback(async () => {
  if (!stream) {
    setIsTorchOn((prev) => !prev);  // REMOVE: don't toggle UI without stream
    return;
  }
  const track = stream.getVideoTracks()[0];
  if (track) {
    try {
      const capabilities = (track.getCapabilities?.() || {}) as Record<string, unknown>;
      if ('torch' in capabilities) {
        const nextState = !isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as MediaTrackConstraintSet],
        });
        setIsTorchOn(nextState);
        return;
      }
    } catch (e) {
      console.warn('Torch constraint failed:', e);
    }
  }
  setIsTorchOn((prev) => !prev);  // REMOVE this fallthrough
}, [isTorchOn, stream]);
```

**captureFrame patch** (lines 99-112) — accept `baselineImageUrl: string`, draw displayed demo frame:

```typescript
const captureFrame = useCallback((): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) return DEFAULT_SHELF_IMAGE_URL;

  if (!isUsingDemoFeed && videoRef.current && videoRef.current.videoWidth > 0) {
    ctx.drawImage(videoRef.current, 0, 0, 1080, 1920);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  return DEFAULT_SHELF_IMAGE_URL;  // BUG: must draw baselineImageUrl instead
}, [isUsingDemoFeed]);
```

**Cleanup pattern** (lines 92-96):

```typescript
useEffect(() => {
  return () => {
    stopCamera();
  };
}, [stopCamera]);
```

---

### `src/components/CameraView.tsx` (component, request-response)

**Analog:** `src/components/CameraView.tsx` (self); inline banner styling from `src/components/OfflineIndicator.tsx`

**Imports pattern** (lines 1-17):

```typescript
import React, { useState } from 'react';
import { Camera, CheckCircle2, Flashlight, ... } from 'lucide-react';
import { Language, ShelfCalibration, AuditRecord } from '../types';
import { I18N } from '../lib/constants';
```

**I18N access pattern** (line 64):

```typescript
const t = I18N[lang];
```

**Conditional control rendering** (lines 274-283) — copy for torch button:

```typescript
{isInstallable && onInstallPwa && (
  <button onClick={onInstallPwa} ...>
    <Smartphone className="w-3 h-3" />
    <span>PWA</span>
  </button>
)}
```

Apply: `{hasTorch && (<button onClick={onToggleTorch} .../>)}` — hide when capability absent.

**Demo feed display** (lines 71-76) — must match capture source:

```typescript
{isUsingDemoFeed ? (
  <img
    src={baseline.imageDataUrl}
    alt="Retail Shelf Demo Stream"
    className="w-full h-full object-cover object-center pointer-events-none transition-transform duration-300 scale-105"
  />
) : (
```

**Inline banner pattern** from `OfflineIndicator.tsx` (lines 24-28):

```typescript
return (
  <div className="fixed bottom-3 left-4 z-50 flex items-center gap-2 rounded-full bg-amber-600/90 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white shadow-lg border border-amber-400/30">
    <WifiOff className="w-3.5 h-3.5" />
    <span>离线模式 (Offline Mode) · 本地缓存已就绪</span>
  </div>
);
```

**Camera error banner placement:** Above bottom shutter controls (`relative z-20 pb-8` section, ~line 327), use `bg-amber-600/90` or `bg-red-600/90`, show `{t.cameraPermissionDenied}` + `{t.cameraErrorIosGuide}`, dismiss via `onDismissCameraError`. Not full-screen — stay in camera context per D-07.

**Shutter disable pattern** (lines 366-377) — add `disabled={isCaptureLocked}` and opacity/cursor classes when locked:

```typescript
<button
  id="shutter-trigger"
  onClick={onShutterClick}
  aria-label="Capture & Scan Planogram"
  className="relative w-[76px] h-[76px] rounded-full bg-white p-1.5 ..."
>
```

---

### `src/lib/constants.ts` (utility, transform)

**Analog:** `src/lib/constants.ts` (self)

**imageDimensions default pattern** (lines 7-12) — copy for upload handler:

```typescript
export const DEFAULT_CALIBRATION: ShelfCalibration = {
  id: 'baseline-default',
  createdAt: Date.now(),
  imageDataUrl: DEFAULT_SHELF_IMAGE_URL,
  imageDimensions: { width: 1080, height: 1920 },
  splitYPercentages: DEFAULT_SPLIT_Y,
  ...
};
```

**I18N extension pattern** (lines 119-128 cn, 178-187 en) — add keys adjacent to existing camera strings:

```typescript
cameraPermissionDenied: '未能启动摄像头，已无缝切换至高精演示展架',
switchCamera: '切换镜头',
torchOn: '开启补光灯',
torchOff: '关闭补光灯',
```

**New keys to add (D-08):** `cameraErrorIosGuide` (Safari → Settings → Camera, or reinstall from Add to Home Screen). Optional: `processing` for PROCESSING overlay if distinct from `scanning`.

**iosInstallGuide precedent** (lines 120, 179):

```typescript
iosInstallGuide: 'iOS 用户请点击底栏分享按钮，选择“添加到主屏幕”',
```

---

### `src/components/OfflineIndicator.tsx` (component, event-driven — verify only)

**Analog:** `src/components/OfflineIndicator.tsx` (self)

**Event listener pattern** (lines 9-19):

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

**Early return when online** (lines 22-22):

```typescript
if (isOnline) return null;
```

**Phase 1 action:** Verify PWA-03 after Vercel deploy — no code changes expected unless z-index conflicts with new camera error banner (CameraView banner should use `z-20`/`z-30`, OfflineIndicator stays `z-50`).

---

### `src/components/ScanningAnimationOverlay.tsx` (component, transform — reuse for PROCESSING)

**Analog:** `src/components/ScanningAnimationOverlay.tsx` (self)

**Props interface** (lines 6-9):

```typescript
interface ScanningAnimationOverlayProps {
  lang: Language;
  frozenFrameUrl: string;
}
```

**Status pill pattern** (lines 38-42):

```typescript
<div className="absolute bottom-16 px-4 py-2 rounded-full bg-[#0F172A]/85 backdrop-blur-md shadow-2xl border border-white/20 flex items-center gap-2">
  <Sparkles className="w-4 h-4 text-[#38BDF8] animate-spin" />
  <span className="text-white text-xs font-semibold tracking-wide">
    {t.scanning}
  </span>
</div>
```

**PROCESSING reuse:** Either render same component with `{appMode === 'PROCESSING' && ...}` (static overlay, no beam animation) or add optional `variant?: 'scanning' | 'processing'` prop. Frozen frame + status pill pattern stays identical.

---

### `src/types.ts` (model — reference only)

**Analog:** `src/types.ts` (self)

**AppMode already includes PROCESSING** (lines 1-7):

```typescript
export type AppMode = 
  | 'INITIAL_GUIDE'
  | 'CAMERA_IDLE'
  | 'SCANNING_ANIM'
  | 'PROCESSING'
  | 'ROI_CONFIG'
  | 'RESULT_INSPECT';
```

**ShelfCalibration.imageDimensions** (lines 11-18) — upload handler must populate:

```typescript
export interface ShelfCalibration {
  id: string;
  createdAt: number;
  imageDataUrl: string;
  imageDimensions: { width: number; height: number };
  splitYPercentages: [number, number, number, number];
  tierLabels: [string, string, string, string];
}
```

No type changes expected in Phase 1.

---

### `.planning/REQUIREMENTS.md` + `.planning/ROADMAP.md` (config/docs — Wave 0 traceability)

**Analog:** `.planning/REQUIREMENTS.md` (self — update TECH-01/TECH-07 from Next.js to Vite/vite-plugin-pwa)

Update phase title in ROADMAP to match CONTEXT ("Capture Foundation & Vercel Deploy", not Next.js migration).

---

## Shared Patterns

### Central FSM in App.tsx
**Source:** `src/App.tsx`
**Apply to:** All mode transitions — patch in place, no hook extraction (D-14)

```typescript
const [appMode, setAppMode] = useState<AppMode>('CAMERA_IDLE');
// Conditional render per mode — never add parallel routing
{appMode === 'CAMERA_IDLE' && <CameraView ... />}
{appMode === 'SCANNING_ANIM' && <ScanningAnimationOverlay ... />}
{appMode === 'RESULT_INSPECT' && <ResultInspectView ... />}
```

### I18N via I18N[lang]
**Source:** `src/lib/constants.ts`
**Apply to:** CameraView banner, ScanningAnimationOverlay, all user-facing strings

```typescript
const t = I18N[lang];
// Extend cn/en objects — never hardcode UI strings in components
```

### Hook return-object exports
**Source:** `src/hooks/usePWAInstall.ts`, `src/hooks/useDeviceOrientation.ts`
**Apply to:** `useCameraStream` extensions (`cameraError`, `hasTorch`, `clearCameraError`)

```typescript
return {
  tilt,
  isLevel,
  hasSensor,
  setSimulatedTilt,
};
```

### Inline floating banners (not modals)
**Source:** `src/components/OfflineIndicator.tsx`
**Apply to:** CameraView camera error banner (D-07), keep OfflineIndicator unchanged

```typescript
<div className="fixed bottom-3 left-4 z-50 flex items-center gap-2 rounded-full bg-amber-600/90 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white shadow-lg border border-amber-400/30">
```

Camera error banner: place inline above shutter in CameraView bottom section, not `fixed` full-screen.

### Conditional feature buttons
**Source:** `src/components/CameraView.tsx` (PWA install button)
**Apply to:** Torch button visibility when `hasTorch === false`

```typescript
{isInstallable && onInstallPwa && (
  <button>...</button>
)}
```

### PWA build artifacts (do not hand-roll SW)
**Source:** `vite.config.ts` + `index.html`
**Apply to:** `vercel.json` header paths

- SW: `/sw.js`, `/registerSW.js`, `/workbox-<hash>.js`
- Manifest: `/manifest.json` (linked in `index.html:21`)
- Assets: `/assets/*` (content-hashed)

### Try/catch for device APIs
**Source:** `src/hooks/useDeviceOrientation.ts`, `src/App.tsx`
**Apply to:** Vibration, camera, torch — log and degrade gracefully

```typescript
try {
  navigator.vibrate?.([30, 40, 30]);
} catch {
  // ignore
}
```

### IndexedDB persistence (unchanged)
**Source:** `src/lib/storage.ts` via `src/App.tsx`
**Apply to:** Baseline upload still calls `saveBaseline(newCalibration)` after dimension fix

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `vercel.json` | config | request-response | No deployment config exists in repo; use `01-RESEARCH.md` Pattern 1 + build-verified `dist/` paths |

**Optional Wave 0 (out of core Phase 1 scope):**

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `vitest.config.ts` | config | batch | No test framework in repo yet |
| `src/**/*.test.ts(x)` | test | — | No existing test files; RESEARCH recommends Vitest Wave 0 |

---

## Metadata

**Analog search scope:** `/src/**`, `/public/**`, root config (`vite.config.ts`, `package.json`, `README.md`, `index.html`), `.planning/**`
**Files scanned:** 81 (glob); 15 source/config files read in full
**Pattern extraction date:** 2026-09-20
**Git tracking note:** Brownfield `src/` and root configs are on disk but untracked; only `.planning/` is committed. Analog paths are project source, not capability mirrors.
