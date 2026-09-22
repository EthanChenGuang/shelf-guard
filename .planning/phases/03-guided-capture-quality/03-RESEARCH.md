# Phase 3: Guided Capture Quality - Research

**Researched:** 2026-09-22
**Domain:** Browser DeviceOrientation API, camera ghost overlay UX, Vitest/jsdom sensor mocking
**Confidence:** HIGH

## Summary

Phase 3 hardens existing brownfield camera guidance features before vision analysis: ghost overlay visibility rules, iOS orientation permission gating, and test coverage. The primary implementation gap is **CAM-07** — `useDeviceOrientation.ts` attaches a `deviceorientation` listener unconditionally on mount, but iOS 13+ Safari requires `DeviceOrientationEvent.requestPermission()` inside a user gesture before events fire [CITED: developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static]. CONTEXT locks the gesture to the same tap that enables live camera (`getUserMedia` first, orientation second).

Secondary work is **behavior fixes** for ghost overlay: current `CameraView.tsx` always renders ghost + slider when `baseline` is truthy, causing double baseline display in demo mode and ghosting `DEFAULT_CALIBRATION` on empty shelves. Fix: gate on `!isUsingDemoFeed && hasPersistedBaseline`.

Phase 2 shelf-scoped baseline loading via `loadBaselineRaw` + `objectUrlRegistry` is the source of truth for ghost eligibility and image URLs. No new npm packages are required — extend existing hooks, props, I18N, and Vitest suites.

**Primary recommendation:** Refactor `useDeviceOrientation` to lazy-listen after permission grant; orchestrate permission request from App after successful `startCamera`; add `hasPersistedBaseline` prop to `CameraView` with conditional ghost/slider render; add unit tests with mocked `DeviceOrientationEvent.requestPermission` and component tests for visibility matrix.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Live/demo camera feed | Browser / Client | — | `getUserMedia` and `<video>` run entirely client-side via `useCameraStream` |
| Ghost overlay compositing | Browser / Client | — | CSS `mix-blend-screen` overlay on camera viewport; no server involvement |
| Level gauge (gamma tilt) | Browser / Client | — | `DeviceOrientationEvent` + haptic via `navigator.vibrate` |
| iOS orientation permission | Browser / Client | — | `DeviceOrientationEvent.requestPermission()` must run in user gesture handler |
| Persisted baseline eligibility | Browser / Client (IndexedDB) | — | `loadBaselineRaw(shelfId)` in `shelfStorage.ts` determines ghost source |
| Ghost opacity preference | Browser / Client (App state) | — | Ephemeral global state in `App.tsx`, not persisted (D-04) |
| Orientation-denied UX banner | Browser / Client | — | Inline banner on `CameraView`, same tier as camera error banner |
| Shelf switch ghost URL swap | Browser / Client | — | `objectUrlRegistry` revokes old blob URLs on shelf change |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Ghost Overlay Visibility (CAM-02)
- **D-01:** Ghost overlay renders **only when live camera is active** (`isUsingDemoFeed === false`). In demo mode the feed already shows the baseline reference — a second ghost layer is redundant and harms clarity. Hide ghost `div` and right-edge slider when demo feed is active.
- **D-02:** Ghost overlay renders **only when the active shelf has a persisted baseline** (`loadBaselineRaw(activeShelfId)` returned non-null). Empty shelves (indices 1–4 post-migration) show live/demo feed without ghost until user calibrates in Phase 4/5. Do not ghost-overlay `DEFAULT_CALIBRATION` CDN image on empty shelves. — **Reversibility:** costly — `CameraView` props contract gains `hasPersistedBaseline` boolean from App.
- **D-03:** Ghost image source is always **`baseline.imageDataUrl`** from the active shelf (Phase 2 `objectUrlRegistry` resolved URL). On shelf switch, ghost updates with `loadShelfData` — no cross-shelf bleed.
- **D-04:** Default ghost opacity stays **45%** on mount; opacity is **global App state** (not per-shelf, not IndexedDB-persisted in Phase 3) — matches Phase 2 global tolerance/language pattern.
- **D-05:** Ghost blend mode keeps existing **`mix-blend-screen`** + contrast/brightness filter in `CameraView.tsx`. PRD-specific visual polish deferred to Phase 5.

#### iOS Orientation Permission (CAM-07)
- **D-06:** Request orientation permission on the **same user gesture that enables live camera** — chain inside `startCamera` / `toggleDemoMode` path after successful `getUserMedia`. Do not request on app mount (iOS requires user activation).
- **D-07:** Extend `useDeviceOrientation` to export `requestOrientationPermission()`, `orientationPermission` state (`'granted' | 'denied' | 'prompt' | 'unsupported'`), and only attach `deviceorientation` listener after grant (or immediately on non-iOS where no prompt exists).
- **D-08:** If orientation permission denied, show **inline banner on CameraView** — same UX contract as Phase 1 camera error banner (D-07). Include i18n copy: enable Motion & Orientation in iOS Settings → Safari → [app]. Level crosshair remains visible but frozen at 0° / gray until granted.
- **D-09:** Banner includes **"Retry"** button that re-calls `requestOrientationPermission()` on tap. No automatic re-prompt loops.
- **D-10:** Permission request is **independent but sequential** with camera permission on the enable-camera gesture: `getUserMedia` first, then orientation request. Camera can work without orientation; orientation banner shown separately if camera succeeds but orientation fails.

#### Level Gauge Behavior (CAM-03)
- **D-11:** Level threshold locked at **±1.5°** on `gamma` axis (portrait roll). Mint green **`#10B981`** snap styling and **40ms vibrate** on level entry — existing hook behavior retained.
- **D-12:** Haptic debounce: **1200ms** on real sensor path, **800ms** on simulate path (existing `lastVibrateTime` logic).
- **D-13:** **No-sensor fallback:** After 3s without `deviceorientation` events, treat as no sensor. Show level pill with simulate toggle (`onSimulateTiltToggle`) when `!hasSensor` — enables desktop QA. In production mobile with denied permission, simulate toggle is **hidden**; user sees orientation-denied banner instead.
- **D-14:** Level crosshair **always visible** on camera view (unlike ghost slider). Rotating horizon line uses `transform: rotate(${tilt}deg)` — existing implementation.

#### Live Camera Feed (CAM-01)
- **D-15:** **Demo-first on launch** — retain Phase 1 D-10 default (`isUsingDemoFeed: true`). User opts into live rear camera via existing demo/camera toggle.
- **D-16:** Live camera uses **`facingMode: environment`**, ideal 1920×1080, `object-cover` full viewport — existing `useCameraStream` config. No auto-start camera on mount.
- **D-17:** Demo feed for any shelf shows **`baseline.imageDataUrl`** (resolved display URL or `DEFAULT_CALIBRATION` CDN for empty shelf 0 legacy path).

#### Testing & Verification
- **D-18:** Add **unit tests** for `useDeviceOrientation` permission flow (mock `DeviceOrientationEvent.requestPermission`). Add **component tests** for ghost visibility rules (hidden in demo mode, hidden when no persisted baseline, visible when live + baseline exists).
- **D-19:** Integration test: shelf switch updates ghost source URL without stale object URL leak (extend Phase 2 isolation test pattern).

### Claude's Discretion
- Exact i18n key names for orientation-denied banner strings in `constants.ts`.
- Whether to pass `hasPersistedBaseline` as prop vs derive inside App from `loadBaselineRaw` cache.
- Banner placement (stack below camera error vs single combined device-permissions banner).
- Minor crosshair sizing within existing Tailwind tokens.

### Deferred Ideas (OUT OF SCOPE)
- **PRD top bar** (baseline pill, level badge in header, torch + language) — Phase 5 (CAM-04).
- **Breathing shutter + 0.8s scan line** — Phase 5 (CAM-05/06).
- **INITIAL_GUIDE when shelf has no baseline** — Phase 5 (SHLF-05); Phase 3 hides ghost instead.
- **Persist ghost opacity to IndexedDB** — not required; global ephemeral state sufficient for v1.
- **Homography / advanced alignment beyond ghost overlay** — v2 (VIS-07).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAM-01 | Full-screen rear-camera live view (or demo baseline stream) | Existing `useCameraStream` + `CameraView` feed toggle; demo-first default retained (D-15) |
| CAM-02 | Ghost overlay at 45% default + right-side vertical slider | Visibility gate `!isUsingDemoFeed && hasPersistedBaseline`; opacity from App global state (D-01–D-05) |
| CAM-03 | Crosshair level gauge ±1.5° snap + haptic | Existing hook logic; extend with permission-gated listener + denied-state frozen crosshair (D-11–D-14) |
| CAM-07 | iOS orientation permission on user gesture; level gauge works after grant | `DeviceOrientationEvent.requestPermission()` chained after `getUserMedia` (D-06–D-10); MDN transient activation pattern |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.0.1 | UI + hooks | Existing app stack [VERIFIED: package.json:20] |
| Vitest | ^5.0.1 | Unit/integration tests | Phase 1 Wave 0 scaffold [VERIFIED: package.json:40] |
| @testing-library/react | ^16.3.3 | Hook/component tests | Existing test pattern [VERIFIED: package.json:27] |
| jsdom | ^30.1.0 | DOM environment | vitest.config.ts environment [VERIFIED: vitest.config.ts:6] |
| fake-indexeddb | 6.2.5 | IndexedDB in tests | Phase 2 integration tests [VERIFIED: package.json:35] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| idb-keyval | ^6.3.0 | Shelf baseline persistence | `loadBaselineRaw` eligibility check |
| Browser DeviceOrientationEvent | — | Gamma tilt sensor | iOS gated via `requestPermission()` |
| navigator.mediaDevices.getUserMedia | — | Live camera | Chained before orientation request |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `DeviceOrientationEvent.requestPermission` mock | `jsdom-testing-mocks` package | Adds dependency; manual `vi.fn` mock sufficient for one hook [ASSUMED] |
| Per-shelf ghost opacity | Global App state (locked D-04) | Simpler; matches tolerance/language pattern |

**Installation:** No new packages required for Phase 3.

**Version verification:**
```bash
# Verified 2026-09-22
npm view vitest version          # 5.x installed locally as 5.0.1
npm view @testing-library/react version  # 16.x installed as 16.3.3
```

## Package Legitimacy Audit

> Phase 3 is brownfield hardening — **no new external packages** to install.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| (none) | — | — | No installs |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
User tap "Demo → Cam" toggle
         │
         ▼
┌─────────────────────┐
│  App.tsx orchestrator│
│  toggleDemoMode path │
└─────────┬───────────┘
          │ 1. startCamera()
          ▼
┌─────────────────────┐     success      ┌──────────────────────────┐
│  useCameraStream    │ ───────────────► │ getUserMedia (environment)│
│  startCamera()      │                  │ isUsingDemoFeed = false   │
└─────────┬───────────┘                  └──────────────────────────┘
          │ 2. (if camera OK)
          ▼
┌─────────────────────┐     granted      ┌──────────────────────────┐
│ useDeviceOrientation│ ───────────────► │ addEventListener         │
│ requestOrientation  │                  │ 'deviceorientation'      │
│ Permission()        │     denied       └──────────────────────────┘
└─────────┬───────────┘ ───────────────► orientation banner + retry
          │
          ▼
┌─────────────────────┐
│  CameraView         │
│  live <video> feed  │
│  + ghost (if rules)│◄── hasPersistedBaseline + !isUsingDemoFeed
│  + level crosshair  │◄── tilt/isLevel from hook
└─────────────────────┘
          ▲
          │ baseline.imageDataUrl
┌─────────┴───────────┐
│ loadShelfData()     │
│ loadBaselineRaw(id) │── null → DEFAULT_CALIBRATION, hasPersisted=false
│ objectUrlRegistry   │── blob → display URL for ghost source
└─────────────────────┘
```

### Recommended Project Structure

No new directories. Extend existing files:

```
src/
├── hooks/
│   ├── useDeviceOrientation.ts    # Add permission state + lazy listener
│   └── useCameraStream.ts         # Optional: export startCamera for App chaining
├── components/
│   └── CameraView.tsx             # Ghost visibility + orientation banner
├── App.tsx                        # hasPersistedBaseline, permission orchestration
└── lib/
    └── constants.ts               # orientation I18N keys
tests (co-located):
├── hooks/useDeviceOrientation.test.ts
└── components/CameraView.ghost.test.tsx
```

### Pattern 1: iOS Orientation Permission (Lazy Listener)

**What:** Feature-detect iOS permission API; defer `deviceorientation` listener until grant; auto-attach on non-iOS.

**When to use:** Any hook reading motion/orientation on iOS 13+ Safari/PWA.

**Example:**
```typescript
// Source: MDN DeviceOrientationEvent.requestPermission
// Pattern aligned with CONTEXT D-06, D-07

type OrientationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

function needsOrientationPermission(): boolean {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
      .requestPermission === 'function'
  );
}

async function requestOrientationPermission(): Promise<OrientationPermission> {
  if (!needsOrientationPermission()) {
    return 'unsupported'; // Android/desktop — attach listener immediately
  }
  const state = await DeviceOrientationEvent.requestPermission();
  return state === 'granted' ? 'granted' : 'denied';
}
```

[CITED: developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static]

### Pattern 2: Ghost Visibility Gate

**What:** Single boolean expression controls both ghost overlay div and right-edge slider.

**When to use:** Any render of ghost layer in `CameraView`.

**Example:**
```typescript
// showGhost = live camera AND shelf has IndexedDB baseline (not DEFAULT_CALIBRATION fallback)
const showGhost = !isUsingDemoFeed && hasPersistedBaseline;

{showGhost && (
  <>
    <div className="... mix-blend-screen" style={{ opacity: ghostOpacity / 100 }}>
      <img src={baseline.imageDataUrl} alt="Baseline Ghost Overlay" />
    </div>
    {/* right-edge slider */}
  </>
)}
```

Current unconditional render at `CameraView.tsx:112-124` and slider at `:320-357` must wrap in `showGhost`.

### Pattern 3: hasPersistedBaseline in App

**What:** Track baseline persistence alongside `loadShelfData`; pass boolean to `CameraView`.

**When to use:** Shelf switch, migration, reset, upload baseline.

**Example:**
```typescript
// In loadShelfData — mirror existing loadBaselineRaw check [VERIFIED: App.tsx:100-109]
const persisted = await loadBaselineRaw(shelfId);
setHasPersistedBaseline(persisted !== null);
if (persisted) {
  const displayUrl = registry.set(`baseline:${shelfId}`, persisted.imageBlob);
  nextBaseline = toViewBaseline(persisted, displayUrl);
} else {
  nextBaseline = DEFAULT_CALIBRATION; // id: 'baseline-default' [VERIFIED: constants.ts:9]
}
```

`DEFAULT_CALIBRATION.id` is `'baseline-default'` — do **not** treat this as persisted baseline for ghost eligibility.

### Pattern 4: Orientation-Denied Banner (Mirror Camera Error)

**What:** Reuse Phase 1 inline banner structure from `CameraView.tsx:386-421` for orientation denial.

**When to use:** `orientationPermission === 'denied'` after request or retry.

**Props to add:** `orientationError?: boolean`, `onRetryOrientation?: () => void`, `onDismissOrientationError?: () => void`

Follow `CameraView.error.test.tsx` assertion pattern for camera banner.

### Anti-Patterns to Avoid

- **Requesting orientation on mount:** iOS throws `NotAllowedError` without transient activation [CITED: MDN requestPermission exceptions].
- **Awaiting orientation before camera:** CONTEXT D-10 requires camera-first sequencing.
- **Ghost in demo mode:** Double-renders baseline — current bug at `CameraView.tsx:95-124`.
- **Using DEFAULT_CALIBRATION for ghost on empty shelves:** Violates D-02; empty shelves show feed only.
- **Automatic permission retry loops:** Violates D-09; user must tap Retry.
- **Showing simulate toggle when permission denied on mobile:** Violates D-13.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iOS permission prompt UI | Custom modal | Native `DeviceOrientationEvent.requestPermission()` | OS-owned dialog; only API that unlocks sensor |
| Permission state persistence | Custom IndexedDB flag | Browser permission state + in-hook `'granted'/'denied'` | iOS doesn't expose Permissions API for orientation |
| Blob URL lifecycle | Ad-hoc createObjectURL | `objectUrlRegistry` from Phase 2 | Prevents leak on shelf switch (D-03) |
| Tilt level detection math | New algorithm | Existing gamma ±1.5° in hook | Already validated; retain D-11 |
| Ghost blend compositing | Canvas alpha blend | CSS `mix-blend-screen` (D-05) | Existing implementation; GPU-composited |

**Key insight:** The browser owns orientation permission UX — the app's job is gesture timing, listener lifecycle, and graceful degradation UI.

## Common Pitfalls

### Pitfall 1: Permission Called Outside User Gesture

**What goes wrong:** `NotAllowedError`; promise rejects; level gauge never activates on iOS.

**Why it happens:** Calling `requestPermission()` from `useEffect` on mount or after async delay loses transient activation.

**How to avoid:** Call synchronously within the click handler chain: `onToggleDemoMode` → `startCamera()` → `requestOrientationPermission()` without intermediate `await` gaps that lose activation [ASSUMED — verify on device if chaining async breaks activation].

**Warning signs:** Works on Android/desktop, frozen crosshair on iOS Safari/PWA.

### Pitfall 2: Double Baseline in Demo Mode

**What goes wrong:** Demo feed shows baseline image AND ghost overlay shows same image at 45% opacity — muddy, confusing preview.

**Why it happens:** Ghost renders whenever `baseline` is truthy; `DEFAULT_CALIBRATION` is always truthy.

**How to avoid:** Gate ghost on `!isUsingDemoFeed && hasPersistedBaseline` (D-01, D-02).

**Warning signs:** Demo mode looks washed out; slider adjusts invisible duplicate layer.

### Pitfall 3: Ghost on Empty Shelves

**What goes wrong:** Empty shelves 1–4 show CDN demo ghost over live camera, misleading alignment target.

**Why it happens:** `loadShelfData` sets `DEFAULT_CALIBRATION` when `loadBaselineRaw` returns null [VERIFIED: App.tsx:107-108].

**How to avoid:** Track `hasPersistedBaseline` separately from view `baseline` object.

**Warning signs:** Shelf 2 with no calibration still shows ghost slider.

### Pitfall 4: Stale Ghost URL on Shelf Switch

**What goes wrong:** Ghost shows previous shelf's baseline after switch.

**Why it happens:** Missing registry revoke or baseline state not updated before render.

**How to avoid:** Follow Phase 2 pattern: `registry.revokeAll()` on shelf change, then `loadShelfData` [VERIFIED: App.tsx:171-179].

**Warning signs:** Integration test `data-baseline-id` mismatch; memory growth from unreleased blob URLs.

### Pitfall 5: jsdom Missing requestPermission

**What goes wrong:** Hook tests pass on desktop shape but miss iOS code path entirely.

**Why it happens:** jsdom provides `DeviceOrientationEvent` constructor without static `requestPermission`.

**How to avoid:** Explicitly attach `DeviceOrientationEvent.requestPermission = vi.fn()` in test setup [ASSUMED: community Vitest pattern from wcstack/tilt mocks].

**Warning signs:** No tests cover `'denied'` banner path.

## Code Examples

### iOS Permission Request (MDN Canonical)

```javascript
// Source: developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static
document.querySelector("button").addEventListener("click", async () => {
  if (typeof DeviceOrientationEvent.requestPermission !== "function") {
    return;
  }
  const permission = await DeviceOrientationEvent.requestPermission();
  if (permission === "granted") {
    window.addEventListener("deviceorientation", (event) => {
      console.log(`Gamma: ${event.gamma}`);
    });
  }
});
```

### App Orchestration (Camera Then Orientation)

```typescript
// Recommended wiring for CONTEXT D-06, D-10
const handleToggleDemoMode = useCallback(async () => {
  if (isUsingDemoFeed) {
    await startCamera();
    if (!cameraError) {
      await requestOrientationPermission();
    }
  } else {
    toggleDemoMode(); // existing stop + demo fallback
  }
}, [isUsingDemoFeed, startCamera, cameraError, requestOrientationPermission, toggleDemoMode]);
```

### Vitest Mock: iOS requestPermission

```typescript
// Source: community pattern — jsdom lacks requestPermission static
import { vi } from 'vitest';

function installRequestPermission(
  impl: () => Promise<'granted' | 'denied'>,
) {
  const fn = vi.fn(impl);
  (globalThis.DeviceOrientationEvent as unknown as { requestPermission: typeof fn })
    .requestPermission = fn;
  return fn;
}

function emitDeviceOrientation(gamma: number) {
  const event = new Event('deviceorientation') as DeviceOrientationEvent;
  Object.defineProperty(event, 'gamma', { value: gamma });
  window.dispatchEvent(event);
}
```

[ASSUMED: pattern from wcstack/tilt `__tests__/mocks.ts`; not verified against installed jsdom 30.1.0 in this session]

### Component Test: Ghost Visibility Matrix

```typescript
// Extend CameraView.error.test.tsx pattern
it('hides ghost slider in demo mode even with persisted baseline', () => {
  render(
    <CameraView
      {...baseProps}
      isUsingDemoFeed={true}
      hasPersistedBaseline={true}
    />,
  );
  expect(screen.queryByLabelText('幽灵图透光率')).not.toBeInTheDocument();
  expect(screen.queryByAltText('Baseline Ghost Overlay')).not.toBeInTheDocument();
});

it('shows ghost when live camera + persisted baseline', () => {
  render(
    <CameraView
      {...baseProps}
      isUsingDemoFeed={false}
      hasPersistedBaseline={true}
    />,
  );
  expect(screen.getByAltText('Baseline Ghost Overlay')).toBeInTheDocument();
  expect(screen.getByLabelText('幽灵图透光率')).toBeInTheDocument();
});
```

Use `aria-label={t.ghostOpacity}` → `'幽灵图透光率'` (cn) [VERIFIED: constants.ts:80] and `alt="Baseline Ghost Overlay"` [VERIFIED: CameraView.tsx:119].

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unconditional `deviceorientation` listener | iOS `requestPermission()` gated listener | iOS 13 (2019) | Must feature-detect `requestPermission` |
| Ghost always on when baseline exists | Conditional on live feed + persisted baseline | Phase 3 (planned) | Fixes demo double-render |
| Console-only orientation failures | Inline banner + retry | Phase 3 (planned) | Matches CAM-08 camera pattern |

**Deprecated/outdated:**
- Auto-attaching orientation listener on mount for iOS Safari — blocked since iOS 13 [CITED: MDN Detecting device orientation].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PWA standalone (Add to Home Screen) uses same `requestPermission()` flow as Mobile Safari | Pitfall 1 / Environment | May need standalone-specific I18N if behavior differs |
| A2 | Async chain `await startCamera()` then `await requestPermission()` preserves transient activation | Pattern 1 | Permission silently fails; needs device QA |
| A3 | 3s no-event timeout correctly distinguishes desktop no-sensor from iOS pending-denied | D-13 | Wrong simulate toggle visibility |
| A4 | jsdom 30.1.0 allows attaching static `requestPermission` to global `DeviceOrientationEvent` | Code Examples | Test setup fails; may need `vi.stubGlobal` |
| A5 | Frozen crosshair at 0°/gray when denied satisfies "level visible but inactive" UX | D-08 | Product may want explicit "denied" styling on crosshair |

## Open Questions

1. **Does async getUserMedia break transient activation for the subsequent orientation request?**
   - What we know: MDN requires transient activation at call time [CITED: MDN].
   - What's unclear: Whether `await getUserMedia()` in same click handler retains activation for next await.
   - Recommendation: Keep both calls in single synchronous click handler start; add device QA checkpoint. If activation lost, call `requestOrientationPermission()` before any `await` or use `startCamera` callback fired synchronously from click.

2. **Combined vs stacked camera + orientation banners**
   - What we know: Claude's discretion allows either.
   - What's unclear: User preference when both permissions fail.
   - Recommendation: Stack separately (camera first, orientation below) — clearer remediation per permission type.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest test runner | ✓ | v23.10.0 | — |
| Vitest | D-18 unit/component tests | ✓ | 5.0.1 | — |
| jsdom | DOM test environment | ✓ | 30.1.0 (devDep) | — |
| HTTPS / secure context | DeviceOrientation on device | ✓ (Vercel prod) | — | localhost OK for dev |
| iOS Safari / PWA | CAM-07 manual verification | ✗ (CI) | — | Manual device QA at phase gate |
| Physical gyroscope | Level gauge E2E | ✗ (CI) | — | `setSimulatedTilt` + mocked events in tests |

**Missing dependencies with no fallback:**
- iOS device for CAM-07 success criteria verification — planner must include manual checkpoint

**Missing dependencies with fallback:**
- Physical sensor in CI — Vitest mocks + simulate toggle for desktop QA (D-13)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^5.0.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- src/hooks/useDeviceOrientation.test.ts -x` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAM-01 | Demo feed default; live camera on toggle | component | `npm test -- src/components/CameraView.ghost.test.tsx -x` | ❌ Wave 0 |
| CAM-02 | Ghost hidden demo / no baseline; visible live + baseline | component | `npm test -- src/components/CameraView.ghost.test.tsx -x` | ❌ Wave 0 |
| CAM-02 | Slider hidden when ghost hidden | component | same | ❌ Wave 0 |
| CAM-03 | Level snap at ±1.5° gamma | unit | `npm test -- src/hooks/useDeviceOrientation.test.ts -x` | ❌ Wave 0 |
| CAM-07 | requestPermission granted → listener active | unit | `npm test -- src/hooks/useDeviceOrientation.test.ts -x` | ❌ Wave 0 |
| CAM-07 | requestPermission denied → no listener | unit | same | ❌ Wave 0 |
| CAM-07 | Orientation denied banner + retry | component | `npm test -- src/components/CameraView.orientation.test.tsx -x` | ❌ Wave 0 |
| D-19 | Shelf switch updates ghost source | integration | `npm test -- src/App.shelfIsolation.integration.test.tsx -x` | ✅ extend |

### Sampling Rate

- **Per task commit:** `npm test -- <new-test-file> -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + iOS device manual check for CAM-07

### Wave 0 Gaps

- [ ] `src/hooks/useDeviceOrientation.test.ts` — permission flow, gamma level, simulate path
- [ ] `src/components/CameraView.ghost.test.tsx` — visibility matrix (demo/live × persisted/empty)
- [ ] `src/components/CameraView.orientation.test.tsx` — denied banner, retry handler
- [ ] Shared test helper `src/test/deviceOrientationMocks.ts` — `installRequestPermission`, `emitDeviceOrientation`
- [ ] Extend `App.shelfIsolation.integration.test.tsx` — ghost `img[src]` or `data-baseline-id` on shelf switch with live camera mock

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Validate `ghostOpacity` clamp 0–100; shelf ID 0–4 via existing `validateShelfId` |
| V6 Cryptography | no | — |

### Known Threat Patterns for Browser Sensor Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Permission prompt on non-gesture path | Information Disclosure | Only call `requestPermission` from user click handler [CITED: MDN] |
| Over-permissioning (absolute orientation) | Information Disclosure | Do not pass `absolute: true` — gamma-only level gauge needs accelerometer/gyro only |
| Blob URL leak across shelf context | Information Disclosure | `objectUrlRegistry.revokeAll()` on shelf switch [VERIFIED: objectUrlRegistry.ts:23-27] |
| Camera stream not stopped on mode exit | Information Disclosure | Existing `stopCamera` cleanup in `useCameraStream` [VERIFIED: useCameraStream.ts:79-89] |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory found in project workspace. No additional rule directives beyond CONTEXT.md and REQUIREMENTS.md.

## Sources

### Primary (HIGH confidence)
- MDN `/mdn/content` via Context7 — `DeviceOrientationEvent.requestPermission()` transient activation, granted/denied return values, secure context
- MDN — Detecting device orientation permission pattern in click handler

### Secondary (MEDIUM confidence)
- In-repo Phase 1 camera error banner pattern — `src/components/CameraView.error.test.tsx`, `CameraView.tsx:386-421`
- In-repo Phase 2 shelf isolation — `src/App.shelfIsolation.integration.test.tsx`, `loadBaselineRaw` API
- Community Vitest mock pattern for `requestPermission` [ASSUMED]

### Tertiary (LOW confidence)
- Stack Overflow / DEV community notes on PWA standalone permission parity with Safari [ASSUMED: A1]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; verified existing Vitest/jsdom versions
- Architecture: HIGH — brownfield files identified; CONTEXT locks all major decisions
- Pitfalls: HIGH — current ghost double-render confirmed in source; iOS gap documented in CONCERNS.md

**Research date:** 2026-09-22
**Valid until:** 2026-10-22 (stable browser APIs; 7 days if iOS behavior disputed)
