---
phase: 03-guided-capture-quality
verified: 2026-09-23T08:10:00Z
status: human_needed
score: 14/16 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/phases/03-guided-capture-quality/03-01-PLAN.md
  - .planning/phases/03-guided-capture-quality/03-01-SUMMARY.md
  - .planning/phases/03-guided-capture-quality/03-02-PLAN.md
  - .planning/phases/03-guided-capture-quality/03-02-SUMMARY.md
  - .planning/phases/03-guided-capture-quality/03-03-PLAN.md
  - .planning/phases/03-guided-capture-quality/03-03-SUMMARY.md
  - .planning/phases/03-guided-capture-quality/03-CONTEXT.md
  - src/App.shelfIsolation.integration.test.tsx
  - src/App.tsx
  - src/components/CameraView.ghost.test.tsx
  - src/components/CameraView.orientation.test.tsx
  - src/components/CameraView.tsx
  - src/hooks/useCameraStream.ts
  - src/hooks/useDeviceOrientation.test.ts
  - src/hooks/useDeviceOrientation.ts
  - src/lib/constants.ts
  - src/lib/objectUrlRegistry.ts
  - src/test/deviceOrientationMocks.ts
covered_digest: "v1:sha256:38b435ccf966e26d19422ab0cef29ff85c157df26b5542461073957ae7405e6c"
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "On iOS, Motion & Orientation permission prompt appears on the live-camera toggle gesture and level gauge responds to roll after grant (CAM-07 / ROADMAP SC4)"
    test: "On iOS Safari or installed PWA, tap Demo→Cam toggle; grant camera then orientation; rotate phone through ±1.5°"
    expected: "Native Motion & Orientation prompt appears; after grant crosshair turns mint green and haptic fires within ±1.5°; after deny, inline banner with Retry appears and camera feed still works"
    why_human: "Native iOS permission dialog and physical sensor/haptic cannot be exercised in jsdom; 03-03 checkpoint explicitly deferred"
  - truth: "Orientation permission request retains valid iOS transient user activation after getUserMedia resolves (CR-01 / D-06)"
    test: "On iOS Safari, tap live-camera toggle and observe whether Motion & Orientation prompt appears after granting camera"
    expected: "Orientation prompt appears (not auto-denied) despite await startCamera() completing before requestOrientationPermission()"
    why_human: "Code review CR-01 flags that awaiting getUserMedia may consume user activation; no automated test can prove Safari activation timing"
human_verification:
  - test: "iOS CAM-07 device checkpoint per 03-03-PLAN Task 3"
    expected: "Demo feed on launch; live-camera toggle triggers camera then orientation prompts; level gauge active after grant; denied path shows banner with Settings guide and Retry; ghost visible only on live + persisted baseline shelf"
    why_human: "Plan checkpoint:human-verify gate=blocking; 03-03-SUMMARY documents status NOT VERIFIED"
  - test: "Verify iOS transient user activation chain (CR-01 from 03-REVIEW.md)"
    expected: "Motion & Orientation prompt appears after camera grant on same tap — if prompt never appears, CR-01 fix (fire orientation request synchronously before await startCamera) is required"
    why_human: "handleEnableLiveCamera awaits startCamera() before requestOrientationPermission(); Safari activation semantics require real device"
  - test: "Demo-first launch UX smoke check"
    expected: "App opens to demo baseline feed without auto camera start; toggle switches to live rear camera"
    why_human: "CAM-01 demo-first default verified in code (useCameraStream isUsingDemoFeed=true) but launch UX not browser-tested in this verification pass"
---

# Phase 3: Guided Capture Quality Verification Report

**Phase Goal:** Users can capture shelf photos with ghost overlay guidance, device orientation level gauge, and iOS permission flows — guided capture quality for accurate shelf inspection.

**Verified:** 2026-09-23T08:10:00Z  
**Status:** human_needed  
**Re-verification:** No — initial verification

## Goal Achievement

Automated deliverables for CAM-01, CAM-02, and CAM-03 are implemented, wired, and test-green. CAM-07 code and unit/component tests exist, but native iOS permission UX and the transient user-activation chain flagged in `03-REVIEW.md` CR-01 require device QA before the phase goal is fully achieved.

### User Flow Coverage (MVP — ROADMAP Success Criteria)

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Open camera screen | Demo baseline feed default; no auto camera start | `useCameraStream.ts:36` `isUsingDemoFeed` default `true`; `CameraView` demo `<img>` path | ✓ VERIFIED |
| Enable live camera | Full-screen rear camera via getUserMedia | `useCameraStream` `facingMode: environment`; video element in `CameraView` | ✓ VERIFIED |
| Align with ghost | Ghost at 45% opacity + right slider on live + persisted baseline | `showGhost` gate; `ghostOpacity` default 45; `CameraView.ghost.test.tsx` 4 cases | ✓ VERIFIED |
| Level gauge | Crosshair snaps mint `#10B981` ±1.5° with 40ms vibrate | `useDeviceOrientation.test.ts` level/haptic tests; `CameraView` crosshair styling | ✓ VERIFIED (unit) |
| iOS orientation | Prompt on user gesture; gauge works after grant | `handleEnableLiveCamera` chains requests; hook lazy listener | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED |

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Demo-first feed default on launch (CAM-01, D-15) | ✓ VERIFIED | `useCameraStream.ts:36` `useState(true)` |
| 2 | Full-screen live rear-camera or demo baseline stream (SC1) | ✓ VERIFIED | `CameraView` video vs demo `<img>` branches |
| 3 | Ghost overlay + slider only on live camera + persisted baseline (CAM-02, SC2, D-01) | ✓ VERIFIED | `showGhost = !isUsingDemoFeed && hasPersistedBaseline && !!baseline`; 4 ghost matrix tests pass |
| 4 | Empty shelves show feed without DEFAULT_CALIBRATION ghost (D-02) | ✓ VERIFIED | `hasPersistedBaseline` from `loadBaselineRaw !== null`; ghost test live+false case |
| 5 | Ghost opacity 45% global default, not persisted to IndexedDB (D-04) | ✓ VERIFIED | `App.tsx:61` `useState(45)`; 0 matches in `shelfStorage.ts`/`storage.ts` |
| 6 | Ghost uses `mix-blend-screen` compositing (D-05) | ✓ VERIFIED | `CameraView.tsx:130` class includes `mix-blend-screen` |
| 7 | Shelf switch updates ghost img src without stale blob URL (D-19, CAM-02) | ✓ VERIFIED | `App.shelfIsolation.integration.test.tsx` ghost src swap test passes |
| 8 | Level snap ±1.5° gamma, mint green, 40ms vibrate, 1200/800ms debounce (CAM-03, SC3) | ✓ VERIFIED | `useDeviceOrientation.test.ts` 8 tests pass |
| 9 | Level crosshair always visible; gray frozen at 0° when denied (D-14, D-08) | ✓ VERIFIED | `#level-crosshair` always rendered; `displayTilt = orientationDenied ? 0 : tilt` |
| 10 | Simulate toggle only when `!hasSensor && !orientationDenied` (D-13) | ✓ VERIFIED | `CameraView.tsx:99-100`; orientation test hides simulate pill |
| 11 | Orientation permission API + lazy iOS listener (D-07, CAM-07) | ✓ VERIFIED | `useDeviceOrientation.ts` exports `requestOrientationPermission`, `orientationPermission`; hook tests |
| 12 | App chains camera then orientation on enable-live gesture (D-06) | ✓ VERIFIED | `App.tsx:373-378` `handleEnableLiveCamera`; wired to `onToggleDemoMode` |
| 13 | Orientation denied inline banner with i18n Settings guide + Retry, no auto loops (D-08, D-09) | ✓ VERIFIED | `constants.ts` keys; `CameraView.orientation.test.tsx` 4 tests |
| 14 | Camera works independently when orientation denied (D-10) | ✓ VERIFIED | Separate error/orientation banner props; denied hook keeps tilt 0 without blocking video |
| 15 | Full lint, build, and test suite pass | ✓ VERIFIED | `npm run lint` exit 0; `npm run build` exit 0; `npm test` 60/60 pass |
| 16 | iOS native permission prompt + level gauge after grant (CAM-07, SC4) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code wired; 03-03 checkpoint not executed; CR-01 activation concern |
| 17 | iOS transient user activation preserved camera→orientation chain (CR-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `await startCamera()` precedes `await requestOrientationPermission()` — may break Safari activation |

**Score:** 14/16 truths verified (2 present, behavior-unverified)

### Decision Coverage

All 19 trackable `03-CONTEXT.md` decisions honored by shipped artifacts (gsd-tools `check.decision-coverage-verify`).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/components/CameraView.ghost.test.tsx` | Ghost visibility matrix (CAM-02) | ✓ VERIFIED | 4 tests; imported by vitest; all pass |
| `src/hooks/useDeviceOrientation.test.ts` | Permission + level unit tests (CAM-03, CAM-07) | ✓ VERIFIED | 8 tests; substantive behavioral assertions |
| `src/components/CameraView.orientation.test.tsx` | Orientation denied banner (CAM-07) | ✓ VERIFIED | 4 tests; retry/dismiss/simulate guard |
| `src/test/deviceOrientationMocks.ts` | Test helpers for permission API | ✓ VERIFIED | `installRequestPermission`, `emitDeviceOrientation` |
| `src/App.shelfIsolation.integration.test.tsx` | Ghost src swap on shelf switch (D-19) | ✓ VERIFIED | Extended with ghost overlay assertions; 5/5 pass |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `App.loadShelfData` | `hasPersistedBaseline` | `setHasPersistedBaseline(persisted !== null)` | ✓ WIRED | `App.tsx:124` |
| `App` | `CameraView.showGhost` | `hasPersistedBaseline` + `isUsingDemoFeed` props | ✓ WIRED | `App.tsx:424-425`; `CameraView.tsx:96` |
| `App.handleEnableLiveCamera` | `requestOrientationPermission` | After `startCamera()` success | ✓ WIRED | `App.tsx:373-378` |
| `App` | `CameraView` orientation banner | `orientationDenied`, `onRetryOrientation` | ✓ WIRED | `App.tsx:431-433` |
| Integration test | Ghost overlay | Live camera mock + persisted baselines | ✓ WIRED | `mockIsUsingDemoFeed = false`; ghost test in integration file |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Ghost overlay `<img src>` | `baseline.imageDataUrl` | `loadBaselineRaw` → `objectUrlRegistry.set(blob)` | ✓ | ✓ FLOWING |
| `hasPersistedBaseline` | boolean | `loadBaselineRaw(shelfId) !== null` | ✓ | ✓ FLOWING |
| Level crosshair `tilt` | `displayTilt` | `deviceorientation` events via hook (or 0 when denied) | ✓ (mocked in tests) | ✓ FLOWING |
| Ghost opacity slider | `ghostOpacity` | App `useState(45)` user input | ✓ | ✓ FLOWING |

**Note (WR-02 advisory):** `objectUrlRegistry.set` returns `''` on blob failure while `hasPersistedBaseline` may still be true — ghost shell could render with empty `src`. Not blocking automated truths; human QA on corrupt blob edge case optional.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 3 targeted bundle | `npm test -- src/hooks/useDeviceOrientation.test.ts src/components/CameraView.ghost.test.tsx src/components/CameraView.orientation.test.tsx src/App.shelfIsolation.integration.test.tsx` | 21/21 pass | ✓ PASS |
| Ghost visibility matrix | `npm test -- src/components/CameraView.ghost.test.tsx` | 4/4 pass | ✓ PASS |
| Orientation permission hook | `npm test -- src/hooks/useDeviceOrientation.test.ts` | 8/8 pass | ✓ PASS |
| Full suite | `npm test` | 60/60 pass | ✓ PASS |
| Lint | `npm run lint` | exit 0 | ✓ PASS |
| Build | `npm run build` | exit 0, dist generated | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no phase-declared probes or `scripts/*/tests/probe-*.sh` for this UI phase.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `CameraView.ghost.test.tsx` | CAM-02 | 4 | 0 | No | Behavioral (DOM presence/absence) | PASS |
| `useDeviceOrientation.test.ts` | CAM-03, CAM-07 | 8 | 0 | No | Behavioral (state transitions, debounce) | PASS |
| `CameraView.orientation.test.tsx` | CAM-07 | 4 | 0 | No | Behavioral (banner copy, handlers) | PASS |
| `App.shelfIsolation.integration.test.tsx` | CAM-02 | 5 | 0 | No | Behavioral (src swap on shelf change) | PASS |

**Disabled tests on requirements:** 0  
**Circular patterns detected:** 0  
**Insufficient assertions:** 0

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CAM-01 | 03-01, 03-02, 03-03 | Full-screen live/demo feed; demo-first default | ✓ SATISFIED | `useCameraStream` default demo; `CameraView` feed paths |
| CAM-02 | 03-01, 03-03 | Ghost overlay 45% + slider; visibility rules | ✓ SATISFIED | Ghost gate + 4 unit tests + integration test |
| CAM-03 | 03-02, 03-03 | Level crosshair ±1.5° snap + haptic | ✓ SATISFIED (automated) | Hook unit tests + crosshair UI; real haptic needs device |
| CAM-07 | 03-02, 03-03 | iOS orientation permission on user gesture | ? NEEDS HUMAN | Code + mocked tests pass; device checkpoint pending; CR-01 unverified |

### Prohibitions (Judgment Tier)

| Prohibition | Status | Evidence |
|-------------|--------|----------|
| Must not ghost-overlay DEFAULT_CALIBRATION on empty shelves | ✓ VERIFIED | `hasPersistedBaseline` gate |
| Must not persist ghost opacity to IndexedDB | ✓ VERIFIED | No writes in storage layer |
| Must not request orientation permission on app mount | ✓ VERIFIED | Only in `handleEnableLiveCamera` / retry handlers |
| Must not auto-retry orientation in loops | ✓ VERIFIED | Retry on explicit button tap only |
| Must not show simulate toggle when orientation denied | ✓ VERIFIED | Component test |
| Must not skip iOS manual verification for CAM-07 | ⚠️ unverified-prohibition — human review recommended | 03-03 checkpoint not executed; documented pending in SUMMARY |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/App.tsx` | 429 | `onRetryCamera={startCamera}` bypasses orientation chain (WR-01) | ⚠️ Warning | Camera retry may skip orientation request |
| `src/lib/objectUrlRegistry.ts` | 14-25 | Silent empty string on blob failure (WR-02) | ⚠️ Warning | Ghost shell with broken img possible |
| `src/hooks/useDeviceOrientation.ts` | 107-111 | No listener detach on re-deny (WR-03) | ⚠️ Warning | Stale internal state; UI masked by `displayTilt` |
| `src/App.tsx` | 373-378 | `await startCamera()` before orientation request (CR-01) | ℹ️ Info | Potential iOS activation break — routes to human verification, not automated FAIL |

No `TBD`/`FIXME`/`XXX` debt markers in phase-modified source files.

### Human Verification Required

#### 1. iOS CAM-07 Device Checkpoint (blocking per 03-03-PLAN)

**Test:** Deploy preview or dev server over HTTPS; open ShelfGuard on iOS Safari/PWA. Confirm demo feed on launch. Tap Demo→Cam; grant camera then Motion & Orientation. Rotate phone — crosshair mint green ±1.5° with haptic. Reset permissions; deny orientation — confirm inline banner with Settings guide and Retry; camera feed still works; ghost only on live + persisted baseline shelf.

**Expected:** All steps pass; type "approved" or describe failures.

**Why human:** Native permission dialog and physical sensors cannot be verified in CI/jsdom. Plan explicitly requires this checkpoint.

#### 2. iOS Transient User Activation (CR-01)

**Test:** On iOS Safari, tap live-camera toggle once. After granting camera permission, observe whether Motion & Orientation prompt appears.

**Expected:** Orientation prompt appears. If it does not (auto-denied or silent failure), apply CR-01 fix: invoke `requestOrientationPermission()` synchronously before `await startCamera()`, or parallelize as suggested in `03-REVIEW.md`.

**Why human:** `handleEnableLiveCamera` currently awaits `getUserMedia` resolution before calling `requestOrientationPermission()` — code review flags this may invalidate Safari user activation.

#### 3. Demo-First Launch Smoke

**Test:** Open app in mobile browser without prior permissions.

**Expected:** Demo baseline feed visible immediately; no camera permission prompt on load.

**Why human:** Default verified in code; launch UX not exercised in this verification pass.

### Gaps Summary

No automated gaps blocking goal achievement — all wired artifacts pass lint, build, and 60/60 tests. Phase status is `human_needed` because:

1. **CAM-07 device checkpoint** was explicitly deferred in 03-03-SUMMARY (plan prohibition flagged).
2. **CR-01 iOS user activation** concern means SC4 ("orientation permission requested on user gesture and level gauge works after grant") is present in code but not behaviorally proven on real iOS hardware.

If device QA confirms CR-01 breaks the orientation prompt, gap closure should fix `handleEnableLiveCamera` activation ordering before marking phase passed.

---

_Verified: 2026-09-23T08:10:00Z_  
_Verifier: Claude (gsd-verifier)_
