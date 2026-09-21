---
phase: 01-next-js-migration-capture-foundation
verified: 2026-09-21T09:38:00Z
status: passed
score: 13/13 must-haves verified
covered_files:
  - .planning/phases/01-next-js-migration-capture-foundation/01-01-PLAN.md
  - .planning/phases/01-next-js-migration-capture-foundation/01-01-SUMMARY.md
  - .planning/phases/01-next-js-migration-capture-foundation/01-02-PLAN.md
  - .planning/phases/01-next-js-migration-capture-foundation/01-02-SUMMARY.md
  - .planning/phases/01-next-js-migration-capture-foundation/01-03-PLAN.md
  - .planning/phases/01-next-js-migration-capture-foundation/01-03-SUMMARY.md
  - .planning/phases/01-next-js-migration-capture-foundation/01-04-PLAN.md
  - .planning/phases/01-next-js-migration-capture-foundation/01-04-SUMMARY.md
  - .planning/phases/01-next-js-migration-capture-foundation/01-05-PLAN.md
  - .planning/phases/01-next-js-migration-capture-foundation/01-05-SUMMARY.md
  - package.json
  - vercel.json
  - vite.config.ts
  - vitest.config.ts
  - src/App.tsx
  - src/App.processing.integration.test.tsx
  - src/hooks/useCameraStream.ts
  - src/components/CameraView.tsx
  - src/components/OfflineIndicator.tsx
  - src/components/OfflineIndicator.test.tsx
  - src/components/ScanningAnimationOverlay.tsx
  - src/lib/constants.ts
  - src/lib/captureLock.ts
  - src/lib/imageDimensions.ts
covered_digest: "v1:sha256:7e6eee6909cc38ba389ff3715c4d42d4950a979340ac6c89c2dfa0a5ffba6c5b"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 12/13
  gaps_closed:
    - "Offline indicator text does not clip and does not overlap shutter control at 320px viewport (G-01-4)"
    - "PWA install/offline shell + demo capture on Vercel (G-01-7, PWA-01)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Install PWA from Vercel preview URL and verify offline app shell"
    expected: "PWA installs; after going offline the app loads from Service Worker cache; demo capture + analysis completes without network"
    result: pass
    signed_off: 2026-09-21
    note: "Human confirmed on shelf-guard-pearl.vercel.app; G-01-7 fix deployed."
  - test: "Deny camera permission on iOS Safari standalone PWA"
    expected: "Inline banner shows cameraPermissionDenied headline and cameraErrorIosGuide body; demo feed remains usable"
    result: pass
    signed_off: 2026-09-21
    note: "Human confirmed; Cam-mode capture deferred to Phase 3 per roadmap."
---

# Phase 1: Capture Foundation & Vercel Deploy — Verification Report

**Phase Goal:** App runs as a Vite 8 pure-client PWA deployed to Vercel with no backend dependencies; users can reliably capture shelf photos without race conditions, silent camera failures, or broken demo-mode frames.

**Verified:** 2026-09-20T19:28:00Z  
**Status:** human_needed  
**Re-verification:** Yes — after gap closure plan 01-05 (G-01-4)

> **MVP mode discrepancy:** ROADMAP marks this phase `mode: mvp`, but the phase goal is not in user-story format (`user-story.validate` returned `false`). User Flow Coverage below maps roadmap success-criteria outcomes instead. Run `/gsd mvp-phase 1` to align goal wording if strict MVP UAT framing is required.

## User Flow Coverage

| Step | User outcome (from SC) | Evidence | Status |
|------|------------------------|----------|--------|
| Open app | Demo shelf feed visible on first launch | `useCameraStream.ts:34` `isUsingDemoFeed` defaults `true` | ✓ VERIFIED |
| Capture shelf photo | Demo mode snapshots displayed frame, not CDN constant | `App.tsx:131` `captureFrame(baseline.imageDataUrl)`; `useCameraStream.capture.test.ts` | ✓ VERIFIED |
| Double-tap shutter | Second tap ignored during scan/processing | `App.tsx:125` `isCaptureLocked()`; `captureLock.ts`; `App.capture.test.ts` | ✓ VERIFIED |
| Slow analysis | PROCESSING overlay when analysis exceeds 800ms | `App.processing.integration.test.tsx` clicks shutter, advances 800ms, asserts processing copy | ✓ VERIFIED |
| Camera denied | Inline banner with iOS guidance, not console-only | `CameraView.tsx:341-376`; `CameraView.error.test.tsx` (3 tests pass) | ✓ VERIFIED |
| Go offline | Offline pill visible when disconnected | `OfflineIndicator.tsx:29-35`; `OfflineIndicator.test.tsx` (3 tests pass) | ✓ VERIFIED |
| Offline pill at 320px | Pill does not overlap shutter on narrow viewport | `OfflineIndicator.tsx:32` `bottom-24`; G-01-4 layout test passes | ✓ VERIFIED |
| Install PWA / offline use | Installable PWA with offline app shell | `dist/manifest.json`, `dist/sw.js`, `vite.config.ts` VitePWA `registerType: 'autoUpdate'` | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | App builds with Vite 8; client-only SPA; Vercel deploy path ready (SC1, TECH-01, TECH-02) | ✓ VERIFIED | `vite@^8.3.0`, `react@^19.0.1`; `bun run build` exit 0; `vercel.json` SPA rewrite + cache headers; no server imports under `src/` |
| 2 | `@google/genai`, `express`, `dotenv` removed; pure-client deps (SC2, TECH-03) | ✓ VERIFIED | `package.json` name `shelfguard`; forbidden deps absent; `rg` finds no server imports in `src/` |
| 3 | Shutter double-tap ignored during capture lock (SC3, STAB-01) | ✓ VERIFIED | `isCaptureLocked()` guards `handleShutterClick`; `captureLockRef` set before async work; 4 tests in `App.capture.test.ts` pass |
| 4 | Camera errors render inline banner with iOS PWA guidance (SC4, CAM-08) | ✓ VERIFIED | `cameraError` wired App→CameraView; I18N keys `cameraPermissionDenied`, `cameraErrorIosGuide`; 3 component tests pass |
| 5 | Demo mode captures displayed baseline frame (SC5, CAM-09) | ✓ VERIFIED | `captureFrame(baselineImageUrl)` demo branch draws passed URL; 2 unit tests pass |
| 6 | Offline indicator visible when offline (PWA-03) | ✓ VERIFIED | `OfflineIndicator` listens online/offline; I18N `offlineMode`; 3 tests pass |
| 7 | PWA installable + offline app shell usable (PWA-01, SC6) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Build produces `dist/sw.js`, `manifest.json`, `registerSW.js`, icons; runtime install/offline flow not exercised |
| 8 | SW precache shell-only, no user photo blobs (PWA-02) | ✓ VERIFIED | `grep` on `dist/sw.js`: zero `blob:`/`data:image` patterns; 4 precache entries |
| 9 | PROCESSING overlay when analysis exceeds 800ms (SC7, STAB-03) | ✓ VERIFIED | `App.processing.integration.test.tsx` renders App, clicks shutter, advances 800ms, asserts `正在分析展架差异，请稍候...` |
| 10 | Torch UI hidden when unsupported or demo feed (STAB-02) | ✓ VERIFIED | `hasTorch` from `getCapabilities`; CameraView conditional render; 2 hook tests pass |
| 11 | Custom baseline upload sets imageDimensions (STAB-04) | ✓ VERIFIED (coincidental-reliance) | `handleUploadCustomBaseline` calls `loadImageDimensions`; helper tested in `App.baseline.test.ts` — upload handler integration not directly tested |
| 12 | `lucide-react` icon library retained (TECH-05) | ✓ VERIFIED | Dependency present; `CameraView.tsx` imports lucide icons |
| 13 | `vite-plugin-pwa` autoUpdate SW (TECH-07) | ✓ VERIFIED | `vite.config.ts:13` `registerType: 'autoUpdate'` |
| 14 | Offline pill at 320px does not clip or overlap shutter (G-01-4, backstop) | ✓ VERIFIED | `OfflineIndicator.tsx:32` `bottom-24` (was `bottom-3`); G-01-4 layout test asserts pill bottom ≤ shutter band (608px) at 320×640 |

**Score:** 12/13 truths verified (1 present, behavior-unverified)

### Re-verification: G-01-4 Gap Closure

| Gap | Prior Status | Current Status | Evidence |
|-----|-------------|----------------|----------|
| G-01-4: Offline pill overlaps shutter at 320px | ✗ FAILED (Playwright UAT: pill bottom-3 rect overlapped shutter by ~96px) | ✓ CLOSED | Commits `5fccce1` (bottom-24) + `6b1e921` (layout test); `bun run test -- src/components/OfflineIndicator.test.tsx` 3/3 pass |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vitest.config.ts` | jsdom + `@/` alias | ✓ VERIFIED | Matches `vite.config.ts` alias to project root |
| `vitest.setup.ts` | jest-dom setup | ✓ VERIFIED | Exists (referenced by vitest config) |
| `vercel.json` | SPA rewrite + PWA cache headers | ✓ VERIFIED | Rewrite to index.html; no-store on sw/manifest/html; immutable on assets/workbox |
| `src/hooks/useCameraStream.ts` | Demo capture + torch + cameraError | ✓ VERIFIED | 162 lines; exports all required APIs |
| `src/App.tsx` | FSM monolith with capture lock | ✓ VERIFIED | `captureLockRef`, PROCESSING timer, baseline upload dimensions |
| `src/components/CameraView.tsx` | Error banner + shutter lock + torch hide | ✓ VERIFIED | Inline banner; conditional torch; disabled shutter styling |
| `src/components/OfflineIndicator.tsx` | i18n offline pill, raised on narrow viewports | ✓ VERIFIED | `bottom-24`; returns null when online |
| `src/lib/captureLock.ts` | STAB-01 guard helper | ✓ VERIFIED | Used by `handleShutterClick` |
| `src/lib/imageDimensions.ts` | STAB-04 dimension loader | ✓ VERIFIED | Used by upload handler |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `App.tsx` | `captureFrame` | `captureFrame(baseline.imageDataUrl)` on shutter | ✓ WIRED | grep confirms call at line 131 |
| `useCameraStream.ts` | demo canvas | `captureDemoFrameFromUrl(baselineImageUrl)` | ✓ WIRED | Draws passed URL to canvas |
| `App.tsx` | `CameraView` | `cameraError`, `onRetryCamera`, `onDismissCameraError` props | ✓ WIRED | Lines 300-302 |
| `App.tsx` | `OfflineIndicator` | `lang` prop | ✓ WIRED | Line 375 |
| `App.tsx` | `ScanningAnimationOverlay` | `variant` from `appMode` | ✓ WIRED | Lines 312-317 |
| `App.tsx` | `isCaptureLocked` | early return in `handleShutterClick` | ✓ WIRED | Line 125 |
| `vercel.json` | `dist/` output | manifest.json path (not .webmanifest) | ✓ WIRED | Build emits `dist/manifest.json`; headers match |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CameraView` demo feed | `baseline.imageDataUrl` | IndexedDB via `loadBaseline()` / DEFAULT_CALIBRATION | Yes | ✓ FLOWING |
| `captureFrame` demo branch | `baselineImageUrl` param | Shutter passes `baseline.imageDataUrl` | Yes (canvas JPEG) | ✓ FLOWING |
| `CameraView` error banner | `cameraError` | `getUserMedia` catch in `startCamera` | Yes | ✓ FLOWING |
| `OfflineIndicator` | `navigator.onLine` | Browser connectivity API + events | Yes | ✓ FLOWING |
| `handleUploadCustomBaseline` | `imageDimensions` | `loadImageDimensions(dataUrl)` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript lint | `bun run lint` | exit 0 (regression) | ✓ PASS |
| Production build + PWA artifacts | `bun run build` | dist/sw.js, manifest.json, registerSW.js, assets/ | ✓ PASS |
| Full test suite | `bun run test` | 8 files, 17 passed, 0 skipped | ✓ PASS |
| SW precache no user blobs | `grep blob: dist/sw.js` | no matches | ✓ PASS |
| G-01-4 layout regression | `bun run test -- src/components/OfflineIndicator.test.tsx` | 3 passed (includes G-01-4) | ✓ PASS |
| STAB-03 App integration | `bun run test -- src/App.processing.integration.test.tsx` | 1 passed | ✓ PASS |
| CAM-09 named test | `bun run test -- src/hooks/useCameraStream.capture.test.ts` | 2 passed | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no phase-declared probes or `scripts/*/tests/probe-*.sh` for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TECH-01 | 01-01, 01-02 | Vite 8 + React 19 + TS + Tailwind 4 | ✓ SATISFIED | package.json deps; build passes |
| TECH-02 | 01-02 | Client-only SPA mount tree | ✓ SATISFIED | No server code/imports in src |
| TECH-03 | 01-02 | No backend runtime deps | ✓ SATISFIED | genai/express/dotenv removed |
| TECH-05 | 01-02 | lucide-react icons | ✓ SATISFIED | Dependency + CameraView imports |
| TECH-07 | 01-01, 01-02 | vite-plugin-pwa autoUpdate SW | ✓ SATISFIED | vite.config.ts VitePWA config |
| STAB-01 | 01-03 | Shutter double-tap guard | ✓ SATISFIED | captureLockRef + isCaptureLocked |
| STAB-02 | 01-03 | Torch UI matches hardware | ✓ SATISFIED | hasTorch + conditional render |
| STAB-03 | 01-03 | PROCESSING when analysis slow | ✓ SATISFIED | App.processing.integration.test.tsx exercises App.tsx shutter path |
| STAB-04 | 01-03 | Upload sets imageDimensions | ✓ SATISFIED | loadImageDimensions in upload path |
| CAM-08 | 01-04 | Camera error in UI | ✓ SATISFIED | Banner + 3 component tests |
| CAM-09 | 01-02 | Demo captures displayed frame | ✓ SATISFIED | captureDemoFrameFromUrl + 2 tests |
| PWA-01 | 01-02, 01-04 | Installable PWA, offline flow | ⚠️ NEEDS HUMAN | Build artifacts ready; runtime unverified |
| PWA-02 | 01-02 | SW shell-only precache | ✓ SATISFIED | dist/sw.js precache audit |
| PWA-03 | 01-04, 01-05 | Offline indicator when disconnected | ✓ SATISFIED | OfflineIndicator + 3 tests including G-01-4 layout |

**Orphaned requirements:** None — all 14 Phase 1 requirement IDs appear in plan frontmatter.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `App.capture.test.ts` | STAB-01 | 4 | 0 | No | Behavioral (guard states) | ✓ OK — tests production `isCaptureLocked` |
| `App.processing.integration.test.tsx` | STAB-03 | 1 | 0 | No | Behavioral (App.tsx path) | ✓ OK — exercises handleShutterClick + PROCESSING overlay |
| `App.processing.test.ts` | STAB-03 | 1 | 0 | Yes | Behavioral (isolated) | ℹ️ Info — superseded by integration test; kept as unit fallback |
| `App.baseline.test.ts` | STAB-04 | 1 | 0 | No | Value | ⚠️ WARNING — tests helper only, not upload handler |
| `useCameraStream.capture.test.ts` | CAM-09 | 2 | 0 | No | Value + behavioral | ✓ OK |
| `useCameraStream.torch.test.ts` | STAB-02 | 2 | 0 | No | Behavioral | ✓ OK |
| `CameraView.error.test.tsx` | CAM-08 | 3 | 0 | No | Behavioral | ✓ OK |
| `OfflineIndicator.test.tsx` | PWA-03, G-01-4 | 3 | 0 | No | Behavioral + layout | ✓ OK — G-01-4 held-out layout test with mocked rect |

**Disabled tests on requirements:** 0  
**Circular patterns detected:** 1 (`App.processing.test.ts`) → ℹ️ Info (superseded by integration test)  
**Insufficient assertions:** 0 blockers

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX in phase-modified src files | — | — |

### Advisory (New Scope, Unevidenced)

None — re-verification scoped to G-01-4 gap closure; no new-scope blockers without deterministic evidence.

### Coincidental Reliance

| Truth | Reason | Harden |
|-------|--------|--------|
| STAB-04 baseline upload dimensions | fixture-only — test covers `loadImageDimensions` helper, not `handleUploadCustomBaseline` FileReader path | Add integration test mocking FileReader + assert saved calibration dimensions |

### Human Verification Required

### 1. PWA install + offline shell (PWA-01)

**Test:** Deploy to Vercel preview; install PWA; go offline; reload and run demo capture cycle.  
**Expected:** App shell loads offline; inspection completes client-side.  
**Why human:** Service Worker install/offline navigation requires real HTTPS browser context.

### 2. iOS standalone camera permission (CAM-08)

**Test:** Open as iOS Safari PWA; deny camera permission.  
**Expected:** Inline banner with iOS Settings / Add to Home Screen guidance; demo feed remains.  
**Why human:** Permission API behavior differs on iOS standalone; jsdom cannot simulate.

### Gaps Summary

**G-01-4 is closed.** Plan 01-05 raised the offline pill from `bottom-3` to `bottom-24` and added a held-out layout regression test asserting the pill sits above the shutter band at 320×640. All automated checks pass (17/17 tests, build green). STAB-03 is now behaviorally verified via `App.processing.integration.test.tsx`. One behavior-dependent truth remains unproven (PWA-01 runtime install/offline). Status remains **human_needed** for PWA install/offline shell and iOS camera permission UX — not **gaps_found**.

---

_Verified: 2026-09-20T19:28:00Z_  
_Verifier: Claude (gsd-verifier)_
