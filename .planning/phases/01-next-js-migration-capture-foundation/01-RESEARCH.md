# Phase 01: Capture Foundation & Vercel Deploy - Research

**Researched:** 2026-09-20
**Domain:** Vite 8 pure-client PWA deployment (Vercel) + camera FSM hardening
**Confidence:** HIGH

## Summary

Phase 1 does **not** migrate to Next.js. Locked decisions in `01-CONTEXT.md` (D-01) retain the brownfield **Vite 8 + React 19 + Tailwind 4 + `vite-plugin-pwa`** stack and deploy it to **Vercel static hosting**. The phase slug and ROADMAP/REQUIREMENTS wording still say "Next.js" — planners must reconcile **TECH-01** and **TECH-07** to Vite/vite-plugin-pwa before task breakdown, and update ROADMAP/REQUIREMENTS traceability during planning (not during research).

The brownfield app is already a client-only SPA with PWA plugin configured (`registerType: 'autoUpdate'`, `manifest: false`, external `public/manifest.json`). A production build (`bun run build`) emits `dist/index.html`, `dist/sw.js`, `dist/workbox-<hash>.js`, `dist/registerSW.js`, hashed `/assets/*`, and copied `dist/manifest.json` [VERIFIED: bun run build output this session]. Phase 1 adds **Vercel deploy config** (`vercel.json` SPA rewrite + PWA-safe cache headers), **dependency hygiene** (remove unused server/AI deps per D-19), and **targeted FSM/camera fixes** in existing files — no hook extraction, no OpenCV, no Next.js.

Known bugs map cleanly to locked decisions: demo capture returns CDN constant instead of displayed frame (D-11), `cameraError` exported but unwired (D-07–D-09), torch UI lies when hardware unsupported (D-17), shutter double-tap schedules competing timeouts (D-16), `PROCESSING` AppMode never rendered (D-15), baseline upload skips `imageDimensions` (D-18). All fixes are in-place patches to `App.tsx`, `useCameraStream.ts`, and `CameraView.tsx`.

**Primary recommendation:** Ship Vercel static deploy + PWA cache headers first, then apply minimal FSM/camera patches against verified build artifacts (`manifest.json`, `sw.js`, `workbox-*.js` paths — not the generic `manifest.webmanifest` example alone).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Stack & Deployment (pivot from Next.js)
- **D-01:** **Retain Vite 8 + React 19 + Tailwind 4 + `vite-plugin-pwa`** — do not migrate to Next.js App Router for v1. Rationale: pure-client PWA deploys trivially to Vercel static hosting; migration adds risk with no SSR/SEO benefit. — **Reversibility:** costly — a later Next.js migration would re-touch every file and PWA config.
- **D-02:** **Deploy to Vercel** as a static SPA: build command `npm run build` (or `bun run build`), output directory `dist`, framework preset Vite (auto-detected).

#### Vercel Project Setup
- **D-03:** Connect Git repository to Vercel; **production deploys from `main`**, preview deployments on pull requests.
- **D-04:** Add root **`vercel.json`** with: (a) SPA rewrite `/(.*) → /index.html`; (b) PWA-safe cache headers per [vite-pwa Vercel deployment guide](https://vite-pwa-org.netlify.app/deployment/vercel).

#### PWA Update Strategy on Vercel
- **D-05:** Keep **`registerType: 'autoUpdate'`** in `vite-plugin-pwa` (existing `vite.config.ts` setting).
- **D-06:** **`vercel.json` headers:** `Cache-Control: no-store` for `*.html`, `/sw.js`, and web manifest paths; `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`. Prevents post-deploy MIME errors where stale `index.html` references removed JS chunks.

#### Camera Permission & Error UX (CAM-08)
- **D-07:** Show camera failures as an **inline banner on `CameraView`** (not a full-screen modal or separate route) — user stays in camera context and can switch to demo mode.
- **D-08:** Banner copy must include **iOS standalone PWA fallback guidance**: open in Safari → Settings → [app] → allow Camera, or reinstall from Safari Add to Home Screen. Extend existing `I18N` keys in `src/lib/constants.ts` rather than hardcoded strings.
- **D-09:** **Wire `useCameraStream.cameraError`** (already exported, currently unused) into `CameraView` UI. Do not leave errors console-only.

#### Demo Mode Behavior (CAM-09)
- **D-10:** **Keep demo feed as default on first launch** — avoids immediate camera permission friction; user can opt into live camera via existing toggle.
- **D-11:** **Fix demo capture:** `captureFrame()` must snapshot the **currently displayed frame** (including user-uploaded `baseline.imageDataUrl` shown in demo overlay), **not** the hardcoded `DEFAULT_SHELF_IMAGE_URL` CDN constant.

#### Vision Library (cross-phase, affects Phase 4 planning)
- **D-12:** **Do not install `@techstark/opencv-js` in Phase 1** — no Worker scaffold, no WASM bundle in this phase. Vision pipeline lands in Phase 4.
- **D-13:** **v1 vision path is locked to `@techstark/opencv-js` only** (user updating TECH-06 to mandatory OpenCV). **pixelmatch / Canvas lightweight diff is excluded from v1.** Phase 4 planner must not offer pixelmatch as an alternative.

#### FSM & Stability Fixes (minimal scope)
- **D-14:** **Minimal FSM patch in Phase 1** — fix known bugs in existing `App.tsx` state machine; **do not extract `useAuditFlow` / hook decomposition** (defer until multi-shelf complexity in Phase 2+).
- **D-15:** **Wire `PROCESSING` AppMode** (`src/types.ts` already defines it): when mock/real analysis exceeds the 800ms `SCANNING_ANIM` duration, transition to visible PROCESSING UI instead of appearing frozen (STAB-03).
- **D-16:** **Shutter double-tap guard (STAB-01):** ignore second shutter tap while `appMode === 'SCANNING_ANIM'`; optionally disable shutter button visually during lock.
- **D-17:** **Torch UI honesty (STAB-02):** if `track.getCapabilities().torch` is absent or constraint fails, do not toggle `isTorchOn` UI state — hide torch button or show disabled state.
- **D-18:** **Baseline upload dimensions (STAB-04):** when user uploads custom baseline via `handleUploadCustomBaseline`, update `imageDimensions` from loaded image natural width/height.

#### Dependency & Project Hygiene
- **D-19:** **Remove unused server/AI deps** from `package.json`: `@google/genai`, `express`, `dotenv`, and unused `motion`. Aligns with pure-client constraint (TECH-03).
- **D-20:** **Rename package** from `react-example` to `shelfguard`; **update README.md** with ShelfGuard-specific local dev + Vercel deploy instructions (remove AI Studio/Gemini setup as primary path).
- **D-21:** **`metadata.json` AI Studio boilerplate** — leave unchanged in Phase 1 unless zero-cost; not blocking Vercel deploy.

### Claude's Discretion
- Exact `vercel.json` header path patterns (match generated SW filename from vite-plugin-pwa build output).
- Whether to disable PWA dev SW (`devOptions.enabled`) in production config only vs also locally.
- Minor banner styling (Tailwind classes) within existing design tokens.
- Bundling default shelf image into `public/` for offline default baseline (CONCERNS.md recommendation) — implement if trivial during Phase 1, else defer to Phase 2.

### Deferred Ideas (OUT OF SCOPE)
- **Next.js App Router migration** — Explicitly rejected for v1; revisit only if SSR, API routes, or team mandate emerges.
- **`useAuditFlow` / App.tsx hook decomposition** — Phase 2+ when multi-shelf state grows.
- **`@techstark/opencv-js` install + Web Worker scaffold** — Phase 4 (Real Inspection Pipeline).
- **`INITIAL_GUIDE` first-run onboarding** — Phase 5 (SHLF-05).
- **Bundle default shelf image to `public/`** — Nice-to-have; Claude discretion in Phase 1 or Phase 2.
- **Update `metadata.json` AI Studio fields** — Low priority cleanup.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TECH-01 | App stack (REQUIREMENTS still says Next.js; CONTEXT overrides) | Retain Vite 8.3.0 + React 19.3.0 + TS + Tailwind 4.3.3 [VERIFIED: package.json]; planner must rewrite TECH-01 to Vite |
| TECH-02 | Client-only device API components | Satisfied by Vite SPA — no Server Components exist; entire tree mounts from `src/main.tsx` |
| TECH-03 | No backend deps; remove unused server packages | Remove `@google/genai`, `express`, `dotenv`, `motion` + `@types/express` [VERIFIED: package.json:14-22,28-31]; none imported under `src/` |
| TECH-05 | `lucide-react` icon library | Already used across components [VERIFIED: package.json:21] |
| TECH-07 | PWA offline via SW (REQUIREMENTS says @serwist/next; CONTEXT overrides) | Existing `vite-plugin-pwa` 1.3.0 with `registerType: 'autoUpdate'` [VERIFIED: vite.config.ts:12-18]; planner must rewrite TECH-07 |
| STAB-01 | Shutter double-tap race | Guard `handleShutterClick` with ref/mode check; see Architecture Patterns |
| STAB-02 | Torch UI matches hardware | Export `hasTorch` from hook; hide/disable button in CameraView |
| STAB-03 | PROCESSING mode when analysis > 800ms | Split SCANNING_ANIM timeout from analysis Promise; render PROCESSING overlay |
| STAB-04 | Baseline upload updates imageDimensions | Load Image() naturalWidth/Height in upload handler |
| CAM-08 | Camera errors visible in UI | Wire `cameraError` → inline CameraView banner + I18N iOS guidance |
| CAM-09 | Demo capture uses displayed frame | Pass `baseline.imageDataUrl` into `captureFrame` demo branch |
| PWA-01 | Installable PWA; offline inspection shell | Vercel deploy + existing SW precache of app shell [VERIFIED: dist/sw.js precache list] |
| PWA-02 | SW caches app shell only, not user photos | Default generateSW precaches index.html + hashed assets only — no runtime routes for blob/data URLs [VERIFIED: dist/sw.js] |
| PWA-03 | Offline indicator when disconnected | `OfflineIndicator` listens to `online`/`offline` events [VERIFIED: src/components/OfflineIndicator.tsx:9-22] |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static app hosting & CDN | CDN / Static (Vercel) | — | Pure SPA; no SSR/API in v1 |
| SPA routing / deep links | CDN / Static | Browser | `vercel.json` rewrite + SW NavigationRoute to `index.html` |
| PWA install & SW updates | Browser (Service Worker) | CDN headers | SW registered client-side; Vercel headers prevent stale shell |
| Camera capture & torch | Browser (MediaDevices) | — | getUserMedia lives entirely in client hook |
| Demo frame capture | Browser (Canvas) | — | Canvas draw from displayed `<img>` or `<video>` |
| FSM mode transitions | Browser (React state) | — | Central `AppMode` in `App.tsx` |
| Mock vision analysis | Browser (main thread) | — | Phase 1 keeps mock in `vision.ts`; Worker deferred to Phase 4 |
| IndexedDB persistence | Browser (Storage) | — | Unchanged in Phase 1 |
| Offline detection UI | Browser (navigator.onLine) | — | `OfflineIndicator` component |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | 8.3.0 | Dev server + production bundler | Already in repo; Vercel auto-detects Vite preset [VERIFIED: npm view + package.json:25] |
| react / react-dom | 19.3.0 | UI | Locked D-01 [VERIFIED: package.json:23-24] |
| vite-plugin-pwa | 1.3.0 | SW generation, autoUpdate | Locked D-05; replaces @serwist/next for TECH-07 [VERIFIED: vite.config.ts:12-18] |
| tailwindcss + @tailwindcss/vite | 4.3.3 | Styling | Locked D-01 [VERIFIED: package.json:15,35] |
| idb-keyval | 6.3.0 | IndexedDB KV | TECH-04 (unchanged Phase 1) [VERIFIED: package.json:20] |
| lucide-react | 0.546.0 (repo) / 1.47.0 (registry latest) | Icons | TECH-05; keep repo pin unless bump intentional |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| canvas-confetti | 1.9.4 | Audit completion animation | Keep — used in ResultInspectView |
| TypeScript | 7.0.2 | Type checking | `npm run lint` = `tsc --noEmit` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite + vite-plugin-pwa (locked) | Next.js + @serwist/next | Rejected D-01 — unnecessary migration risk for pure-client PWA |
| Vercel | Netlify / Cloudflare Pages | User locked Vercel D-02/D-03; vite-pwa docs cover both with similar header patterns |

**Installation:** No new runtime packages required for Phase 1 scope. Removal only:

```bash
# After editing package.json — use project's package manager
bun remove @google/genai express dotenv motion @types/express
# or: npm uninstall @google/genai express dotenv motion @types/express
```

**Version verification:** `npm view vite version` → 8.3.0; `npm view vite-plugin-pwa version` → 1.3.0; `npm view react version` → 19.3.0 (2026-09-20).

## Package Legitimacy Audit

> Packages **installed or retained** in Phase 1. Removed packages listed for audit completeness only.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| vite-plugin-pwa | npm | ~4 mo | ~3.4M/wk | github.com/vite-pwa/vite-plugin-pwa | OK | Approved |
| idb-keyval | npm | ~2 mo | ~6.4M/wk | github.com/jakearchibald/idb-keyval | OK | Approved |
| canvas-confetti | npm | ~5 mo | ~5.8M/wk | github.com/catdad/canvas-confetti | OK | Approved |
| vite | npm | ~10 days | ~132M/wk | github.com/vitejs/vite | SUS (too-new flag) | Approved — official toolchain, already pinned |
| react / react-dom | npm | ~11 days | ~131M/wk | github.com/facebook/react | SUS (too-new flag) | Approved — locked stack |
| lucide-react | npm | ~3 days | ~76M/wk | github.com/lucide-icons/lucide | SUS (too-new flag) | Approved — icon dep, already in use |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** vite, react, react-dom, lucide-react — seam flagged "too-new" on publish dates; all are mainstream packages with official repos and high download counts. No checkpoint required beyond normal lockfile review.

**Removed in Phase 1 (dead weight, not re-installed):** `@google/genai`, `express`, `dotenv`, `motion`, `@types/express` — zero imports under `src/` [VERIFIED: package.json + grep].

## Architecture Patterns

### System Architecture Diagram

```text
┌──────────────── Git push (main / PR) ─────────────────┐
│                      Vercel CI                         │
│  bun/npm run build → dist/ (static)                    │
│  vercel.json: SPA rewrite + cache headers              │
└──────────────────────────┬────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────── Browser (installed PWA) ────────────────┐
│  index.html → registerSW.js → sw.js (autoUpdate)       │
│  Precache: index.html, /assets/*, registerSW.js        │
│  NOT precached: user photos, IndexedDB blobs, CDN imgs  │
├────────────────────────────────────────────────────────┤
│  App.tsx FSM                                           │
│  CAMERA_IDLE → SCANNING_ANIM ──(>800ms)──► PROCESSING  │
│              └──────────────► RESULT_INSPECT           │
├────────────────────────────────────────────────────────┤
│  useCameraStream ──► CameraView (banner, shutter)      │
│  captureFrame: video OR demo baseline img → canvas      │
└────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No structural migration — patch in place:

```text
/
├── vercel.json              # NEW — SPA rewrite + PWA headers (D-04, D-06)
├── vite.config.ts           # PWA plugin (existing)
├── public/
│   ├── manifest.json        # External manifest (manifest: false)
│   └── icon.svg
├── src/
│   ├── App.tsx              # FSM patches: shutter guard, PROCESSING, dimensions
│   ├── hooks/useCameraStream.ts  # capture fix, torch honesty, cameraError
│   ├── components/CameraView.tsx # error banner, torch visibility
│   ├── components/ScanningAnimationOverlay.tsx  # reuse for PROCESSING copy
│   └── lib/constants.ts     # I18N extensions for iOS camera guidance
└── dist/                    # Vercel output (build artifact)
```

### Pattern 1: Vercel SPA + PWA Cache Headers

**What:** Root `vercel.json` combining SPA fallback rewrite and cache-control aligned to vite-pwa Vercel guide, adapted to **actual build output paths**.

**When to use:** Every Vercel deploy (D-04, D-06).

**Build-verified paths** (this repo, `vite-plugin-pwa` 1.3.0, `manifest: false`):
- Manifest: `/manifest.json` (from `public/manifest.json`) — **not** `manifest.webmanifest`
- Service worker: `/sw.js`, helper `/registerSW.js`, hashed `/workbox-<hash>.js`
- Assets: `/assets/*` (content-hashed filenames)

**Example:**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*).html",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    },
    {
      "source": "/sw.js",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    },
    {
      "source": "/registerSW.js",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    },
    {
      "source": "/manifest.json",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" },
        { "key": "Content-Type", "value": "application/manifest+json" }
      ]
    },
    {
      "source": "/workbox-(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

// Source: [CITED: https://vite-pwa-org.netlify.app/deployment/vercel] + [CITED: https://vercel.com/docs/frameworks/frontend/vite] + build output verification

**Note:** Official vite-pwa example uses `max-age=0, must-revalidate` for HTML/SW; user locked `no-store` (D-06) — follow CONTEXT over doc default.

### Pattern 2: Demo Capture from Displayed Frame (CAM-09)

**What:** `captureFrame(baselineImageUrl: string)` draws the same source CameraView displays in demo mode.

**When to use:** `isUsingDemoFeed === true`.

**Example:**

```typescript
const captureFrame = useCallback((baselineImageUrl: string): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) return baselineImageUrl;

  if (!isUsingDemoFeed && videoRef.current?.videoWidth) {
    ctx.drawImage(videoRef.current, 0, 0, 1080, 1920);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  // Demo: draw baseline.imageDataUrl (matches CameraView <img src>)
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = baselineImageUrl;
  // Prefer sync draw if img complete; else document loader pattern in handler
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, 0, 0, 1080, 1920);
    return canvas.toDataURL('image/jpeg', 0.92);
  }
  return baselineImageUrl; // fallback only if load fails
}, [isUsingDemoFeed]);
```

// Bug source: [VERIFIED: src/hooks/useCameraStream.ts:99-111] returns `DEFAULT_SHELF_IMAGE_URL` in demo branch

**App.tsx call site:** `captureFrame(baseline.imageDataUrl)` instead of `captureFrame()`.

### Pattern 3: SCANNING_ANIM → PROCESSING → RESULT_INSPECT (STAB-03)

**What:** Decouple 800ms animation timer from analysis Promise. When animation completes but analysis pending, show `PROCESSING` UI using existing overlay component with processing copy.

**When to use:** Any capture where `analyzeShelfCapture` may exceed 800ms (mock is fast today; real vision in Phase 4 will need this).

**Example:**

```typescript
const handleShutterClick = async () => {
  if (captureLockRef.current) return;
  captureLockRef.current = true;

  const frame = captureFrame(baseline.imageDataUrl);
  setCapturedFrame(frame);
  setAppMode('SCANNING_ANIM');

  const analysisPromise = analyzeShelfCapture(frame, baseline, tolerance);

  setTimeout(async () => {
    const result = await analysisPromise; // may already be resolved
    applyAnalysisResult(result);
    setAppMode('RESULT_INSPECT');
    captureLockRef.current = false;
  }, 800);

  // If still waiting after 800ms, transition to PROCESSING (visible)
  setTimeout(() => {
    if (captureLockRef.current) {
      setAppMode((mode) => (mode === 'SCANNING_ANIM' ? 'PROCESSING' : mode));
    }
  }, 800);
};
```

// AppMode values: [VERIFIED: src/types.ts:1-7] `'INITIAL_GUIDE' | 'CAMERA_IDLE' | 'SCANNING_ANIM' | 'PROCESSING' | 'ROI_CONFIG' | 'RESULT_INSPECT'`

**Render:** Add `{appMode === 'PROCESSING' && <ScanningAnimationOverlay ... />}` (or variant with `t.scanning` / dedicated processing string).

### Pattern 4: Camera Error Inline Banner (CAM-08)

**What:** Pass `cameraError` and `onDismissError` from hook → App → CameraView; show dismissible banner above shutter controls.

**I18N:** Extend `I18N.cn/en` with keys e.g. `cameraErrorIosGuide` per D-08; keep `cameraPermissionDenied` as headline.

### Pattern 5: Torch Capability Honesty (STAB-02)

**What:** Track `hasTorch` when stream attaches; only render torch button when true; never fall through to toggle UI state on failure.

```typescript
// In toggleTorch — remove fallthrough:
if (!('torch' in capabilities)) return; // do not setIsTorchOn
```

Export `hasTorch: boolean` from hook; CameraView conditionally renders torch button.

### Anti-Patterns to Avoid

- **Next.js migration tasks:** Explicitly out of scope (D-01, Deferred Ideas).
- **Hook extraction (`useAuditFlow`):** Deferred D-14 — increases Phase 1 blast radius.
- **Installing OpenCV / Workers:** Deferred D-12 — Phase 4.
- **Caching user photos in SW:** Violates PWA-02 — do not add runtimeCaching for blob/data URLs.
- **Generic `manifest.webmanifest` headers only:** This project emits `manifest.json` [VERIFIED: dist/index.html:21].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker generation | Custom SW registration logic | `vite-plugin-pwa` generateSW | Workbox precache, autoUpdate, inject manifest |
| SPA deploy routing | Custom server | Vercel `rewrites` in `vercel.json` | Platform-native static hosting |
| IndexedDB wrapper | Raw IDB API | Existing `idb-keyval` in `storage.ts` | Already integrated |
| PWA install prompt | Custom install flow | `usePWAInstall` + `beforeinstallprompt` | Hook exists |
| Camera stream lifecycle | New abstraction layer | Patch `useCameraStream` in place | Minimal scope D-14 |

**Key insight:** Phase 1 is deploy + bugfix on a working brownfield PWA — avoid framework migration or new subsystems.

## Common Pitfalls

### Pitfall 1: Stale index.html After Deploy (MIME / Chunk 404)

**What goes wrong:** Browser/CDN serves old `index.html` referencing deleted hashed JS chunks.

**Why it happens:** Aggressive caching on HTML or SW without revalidation.

**How to avoid:** D-06 `no-store` on `*.html`, `/sw.js`, manifest; immutable only on `/assets/*` and hashed `workbox-*.js`.

**Warning signs:** `Failed to load module script` MIME errors after deploy.

### Pitfall 2: vercel.json Manifest Path Mismatch

**What goes wrong:** Headers not applied to actual manifest file.

**Why it happens:** vite-pwa docs show `manifest.webmanifest`; this project uses `manifest: false` + `public/manifest.json`.

**How to avoid:** Header `/manifest.json` [VERIFIED: dist/ listing].

### Pitfall 3: Demo Capture Still Returns CDN URL

**What goes wrong:** Custom baseline upload ignored in capture/analysis path.

**Why it happens:** Demo branch hardcodes `DEFAULT_SHELF_IMAGE_URL` [VERIFIED: src/hooks/useCameraStream.ts:111].

**How to avoid:** Pass `baseline.imageDataUrl` into capture; add manual test: upload baseline → demo mode → shutter → verify frozen frame matches upload.

### Pitfall 4: Shutter Race via setTimeout

**What goes wrong:** Multiple `setTimeout(..., 800)` callbacks fire; state jumps unpredictably.

**Why it happens:** No guard in `handleShutterClick` [VERIFIED: src/App.tsx:114-137].

**How to avoid:** `useRef` capture lock + early return; clear timeout on unmount if component ever unmounts mid-capture.

### Pitfall 5: npm install Failure (Peer Deps)

**What goes wrong:** `npm install` errored in research environment; build only succeeded via `bun install`.

**Why it happens:** Possible peer dependency conflicts with React 19 / Vite 8 bleeding edge.

**How to avoid:** Document both `bun install` and `npm install` in README; Vercel build command should match lockfile (`bun.lock` present).

### Pitfall 6: Missing apple-touch-icon.png

**What goes wrong:** 404 on iOS home screen icon.

**Why it happens:** `index.html` links `/apple-touch-icon.png` but `public/` only has `icon.svg` [VERIFIED: public/ glob].

**How to avoid:** Add PNG or remove broken link in Phase 1 if trivial (Claude discretion).

### Pitfall 7: Default Baseline CDN Offline Failure

**What goes wrong:** First launch offline cannot load default shelf image from Google CDN.

**Why it happens:** `DEFAULT_SHELF_IMAGE_URL` is external [VERIFIED: src/lib/constants.ts:3].

**How to avoid:** Optional bundle to `public/` (Claude discretion D-21 adjacent); note for PWA-01 partial offline until Phase 2.

## Code Examples

### Vite PWA autoUpdate (existing — keep)

```typescript
VitePWA({
  registerType: 'autoUpdate',
  manifest: false,
  devOptions: {
    enabled: true,
    type: 'module',
  },
})
```

// Source: [VERIFIED: vite.config.ts:12-18] + [CITED: https://github.com/vite-pwa/vite-plugin-pwa/blob/main/docs/guide/auto-update.md]

### Baseline Upload Dimension Update (STAB-04)

```typescript
reader.onload = async (ev) => {
  const dataUrl = ev.target?.result as string;
  if (!dataUrl) return;

  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = dataUrl;
  });

  const newCalibration: ShelfCalibration = {
    ...baseline,
    id: `custom-baseline-${Date.now()}`,
    imageDataUrl: dataUrl,
    imageDimensions: dims,
    createdAt: Date.now(),
  };
  // save...
};
```

// Target: [VERIFIED: src/App.tsx:207-228] currently omits `imageDimensions` update

### Offline Indicator (existing — verify after deploy)

```typescript
useEffect(() => {
  const handleOffline = () => setIsOnline(false);
  window.addEventListener('offline', handleOffline);
  return () => window.removeEventListener('offline', handleOffline);
}, []);
```

// Source: [VERIFIED: src/components/OfflineIndicator.tsx:9-19]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js + @serwist/next (ROADMAP/REQ) | Vite 8 + vite-plugin-pwa (CONTEXT D-01) | 2026-09-20 discuss-phase | No migration work in Phase 1; update REQ traceability |
| AI Studio / Cloud Run deploy (README) | Vercel static (D-02) | Phase 1 | Replace deploy docs in README D-20 |
| Silent camera fallback | Inline error banner (D-07) | Phase 1 | CAM-08 compliance |
| Vite production build "out of scope" (REQ line 124) | **Contradicts CONTEXT** — Vite retained | Pending REQ edit | Planner must remove "Vite production build → migrate Next.js" from Out of Scope |

**Deprecated/outdated:**
- **Next.js App Router for v1:** Rejected — do not plan migration tasks.
- **@google/genai / express / dotenv:** Remove — no client usage.
- **REQUIREMENTS "Vite production build → migrate Next.js":** Stale — reconcile with D-01.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel auto-detects Vite preset with `dist` output without custom build settings | Standard Stack | Manual dashboard config needed |
| A2 | `no-store` headers (D-06) work correctly on Vercel edge vs vite-pwa doc `must-revalidate` | Pattern 1 | Stale shell if headers misapplied — verify in Network tab post-deploy |
| A3 | Mock `analyzeShelfCapture` completes in <800ms so PROCESSING UI rarely visible until Phase 4 | Pattern 3 | Need artificial delay in dev to test PROCESSING path |
| A4 | `bun run build` is acceptable on Vercel (bun.lock present) | Environment | Use npm on Vercel if bun not configured |
| A5 | TECH-02 `"use client"` requirement satisfied implicitly by Vite SPA | Phase Requirements | REQ text may still confuse auditors until rewritten |

## Open Questions (RESOLVED)

1. **Vercel package manager: bun vs npm?** — RESOLVED: Default Vercel to `bun run build` when `bun.lock` is committed; README documents `npm run build` fallback (Plan 01-02).

2. **Disable `devOptions.enabled` for PWA locally?** — RESOLVED: Keep enabled per Claude's discretion (D-21 area); revisit only if dev SW caching causes confusion.

3. **Bundle default shelf image to public/?** — RESOLVED: Defer to Phase 2+ unless zero-cost during deploy hygiene; not blocking Phase 1 tracer.

4. **Requirements/ROADMAP sync timing?** — RESOLVED: Plan 01-01 Wave 0 task syncs TECH-01, TECH-07, Out of Scope, and ROADMAP Phase 1 before implementation waves.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build | ✓ | v23.10.0 | Vercel default Node 20.x |
| bun | Lockfile installs | ✓ | 1.3.0 | npm (may need `--legacy-peer-deps`) |
| npm | Alternative install | ✓ | 11.4.2 | bun |
| vite (local) | build | ✓ (after bun install) | 8.3.0 | CI installs on deploy |
| Vercel CLI | Optional local preview | ✗ | — | Git-connected deploy only |
| HTTPS | Camera/PWA APIs | ✓ (Vercel prod) | — | localhost for dev camera |

**Missing dependencies with no fallback:**
- None blocking — Vercel account + Git connection required for D-03 (human setup).

**Missing dependencies with fallback:**
- Vercel CLI — use Git push deploy instead.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — recommend Vitest 3.x + jsdom for Phase 1 Wave 0 |
| Config file | none — see Wave 0 |
| Quick run command | `npx vitest run --passWithNoTests` (after Wave 0) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAB-01 | Shutter ignores second tap during capture lock | unit | `npx vitest run src/App.capture.test.ts -x` | ❌ Wave 0 |
| STAB-02 | Torch hidden when capability absent | unit | `npx vitest run src/hooks/useCameraStream.torch.test.ts -x` | ❌ Wave 0 |
| STAB-03 | PROCESSING shown when analysis slow | unit | `npx vitest run src/App.processing.test.ts -x` | ❌ Wave 0 |
| STAB-04 | Upload sets imageDimensions | unit | `npx vitest run src/App.baseline.test.ts -x` | ❌ Wave 0 |
| CAM-08 | cameraError renders banner text | component | `npx vitest run src/components/CameraView.error.test.tsx -x` | ❌ Wave 0 |
| CAM-09 | Demo capture uses baseline URL not CDN constant | unit | `npx vitest run src/hooks/useCameraStream.capture.test.ts -x` | ❌ Wave 0 |
| PWA-02 | SW precache excludes user image patterns | smoke | Manual: inspect `dist/sw.js` precache list post-build | ✅ manual |
| PWA-03 | OfflineIndicator shows when offline | component | `npx vitest run src/components/OfflineIndicator.test.tsx -x` | ❌ Wave 0 |
| TECH-03 | No server imports in src | static | `rg '@google/genai|express|dotenv' src/` exits 1 | ✅ grep |
| TECH-01/07 | Build produces SW + manifest | smoke | `bun run build && test -f dist/sw.js` | ✅ verified |

### Sampling Rate

- **Per task commit:** `bun run lint` (tsc --noEmit)
- **Per wave merge:** `bun run build` + inspect `dist/sw.js` precache entries
- **Phase gate:** Manual PWA verify on Vercel preview (install, offline shell, camera banner)

### Wave 0 Gaps

- [ ] Add Vitest + jsdom + `@testing-library/react` devDependencies
- [ ] `vitest.config.ts` with `@/` alias matching vite.config.ts
- [ ] Unit tests for captureFrame demo branch, torch capability, shutter lock ref
- [ ] Planner task: update REQUIREMENTS.md TECH-01/TECH-07 + ROADMAP Phase 1 naming
- [ ] Framework install: `bun add -d vitest jsdom @testing-library/react @testing-library/jest-dom`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | N/A — no auth in v1 |
| V3 Session Management | no | N/A |
| V4 Access Control | no | Local device only |
| V5 Input Validation | yes | File size/type check on baseline upload (recommend ≤5MB); validate image load success |
| V6 Cryptography | no | No crypto in Phase 1 |

### Known Threat Patterns for Vite PWA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale SW serving vulnerable/old JS | Tampering | `no-store` on sw.js + autoUpdate (D-05/D-06) |
| XSS via uploaded baseline filename/display | Spoofing/Tampering | Treat data URLs as images only; no `dangerouslySetInnerHTML` |
| Oversized upload → IndexedDB quota DoS | Denial of Service | Reject large files before readAsDataURL (CONCERNS.md) |
| Missing CSP | Information disclosure | Optional `X-Content-Type-Options: nosniff` from vite-pwa Vercel guide |
| Accidental API key in client bundle | Information disclosure | Remove `@google/genai` / dotenv (D-19); never VITE_ prefix secrets |

## Sources

### Primary (HIGH confidence)
- Build output inspection — `dist/sw.js`, `dist/manifest.json`, `dist/index.html` (this session)
- Source files — `vite.config.ts`, `App.tsx`, `useCameraStream.ts`, `CameraView.tsx`, `types.ts`, `constants.ts` (Read tool)

### Secondary (MEDIUM confidence)
- [vite-pwa Vercel deployment](https://vite-pwa-org.netlify.app/deployment/vercel) — cache header patterns
- [Vercel Vite docs](https://vercel.com/docs/frameworks/frontend/vite) — SPA rewrite
- [vite-plugin-pwa autoUpdate](https://github.com/vite-pwa/vite-plugin-pwa/blob/main/docs/guide/auto-update.md) — Context7 `/vite-pwa/vite-plugin-pwa`

### Tertiary (LOW confidence)
- npm peer dependency resolution failures with npm (observed; root cause not fully diagnosed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified package.json + successful bun build
- Architecture: HIGH — brownfield code read + CONTEXT locked decisions
- Pitfalls: HIGH — CONCERNS.md + code paths verified with line citations
- Vercel deploy: MEDIUM — docs cited; no live Vercel deploy attempted this session

**Research date:** 2026-09-20
**Valid until:** 2026-10-20 (stable Vite/PWA); re-verify if vite-plugin-pwa major version bumps
