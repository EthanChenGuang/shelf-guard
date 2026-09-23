# Codebase Concerns

**Analysis Date:** 2026-09-20

## Tech Debt

**Mock vision pipeline presented as real analysis:**
- Issue: `analyzeShelfCapture()` in `src/lib/vision.ts` ignores `capturedDataUrl`, `baseline.splitYPercentages`, and `baseline.imageDataUrl`. It deep-clones hardcoded `INITIAL_MOCK_ANOMALIES` from `src/lib/constants.ts` and filters by tolerance level only. JSDoc claims "canvas pixel diffing, connected-component contour bounding" but no image processing exists.
- Files: `src/lib/vision.ts`, `src/lib/constants.ts`, `src/App.tsx`
- Impact: Every scan returns the same three preset anomalies (Drunk Elephant moved, NARS moved, Aesop missing) regardless of shelf state. The core product value — detecting real shelf changes — is not implemented.
- Fix approach: Implement tier-scoped pixel diff between baseline and capture using `baseline.splitYPercentages` as ROI bands; integrate `@google/genai` or canvas-based CV as planned in `metadata.json` and `README.md`.

**Declared AI/server stack with no implementation:**
- Issue: `package.json` lists `@google/genai`, `express`, and `dotenv` as dependencies; `.env.example` documents `GEMINI_API_KEY` and `APP_URL`; `metadata.json` declares `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`; `README.md` instructs setting `GEMINI_API_KEY`. None of these are imported or used anywhere under `src/`. `package.json` `clean` script references `server.js`, which does not exist in the repo.
- Files: `package.json`, `.env.example`, `metadata.json`, `README.md`
- Impact: Misleading setup docs; dead dependencies inflate bundle audit surface and install time; developers expect Gemini integration that does not exist.
- Fix approach: Either implement a server-side Gemini vision endpoint (Express + `@google/genai`) or remove unused deps and update docs/metadata to reflect client-only mock state.

**Unused AppMode states and onboarding flow:**
- Issue: `AppMode` in `src/types.ts` defines `INITIAL_GUIDE` and `PROCESSING` but `src/App.tsx` initializes to `CAMERA_IDLE` and never transitions through these modes. No first-run baseline setup wizard exists despite type comments ("无基准图时的首次引导").
- Files: `src/types.ts`, `src/App.tsx`
- Impact: New users with no baseline get default demo shelf silently; no guided calibration path.
- Fix approach: Wire `INITIAL_GUIDE` on first launch when IndexedDB baseline is default; use `PROCESSING` between capture and result instead of jumping `SCANNING_ANIM` → `RESULT_INSPECT`.

**Dead exports and incomplete hook surface:**
- Issue: `captureElementToDataUrl()` in `src/lib/vision.ts` is exported but never imported. `useCameraStream` exports `toggleCameraFacing`, `cameraError`, and `facingMode` but `src/components/CameraView.tsx` does not consume them — no front/back camera switch UI and no camera error display despite I18N strings (`cameraPermissionDenied`) in `src/lib/constants.ts`.
- Files: `src/lib/vision.ts`, `src/hooks/useCameraStream.ts`, `src/components/CameraView.tsx`, `src/lib/constants.ts`
- Impact: Camera switching and error feedback are coded but unreachable; duplicate capture logic in hook vs vision module.
- Fix approach: Consolidate capture into one module; expose camera error in UI or remove unused exports.

**Monolithic App state container:**
- Issue: `src/App.tsx` (~336 lines) holds all application state (mode machine, baseline, analysis results, history modals, device hooks) with no context, reducer, or service layer.
- Files: `src/App.tsx`
- Impact: Hard to test, extend, or reason about side effects; every new feature touches the root component.
- Fix approach: Extract audit workflow into a reducer or custom hook (`useAuditWorkflow`); move persistence calls behind a thin service.

**Duplicated compliance math:**
- Issue: Compliance rate formula `Math.max(70, Math.min(100, 100 - missingCount * 4 - displacedCount * 2))` appears in both `src/lib/vision.ts` and `src/App.tsx` (`handleDismissAnomaly`).
- Files: `src/lib/vision.ts`, `src/App.tsx`
- Impact: Formula drift if one path is updated and the other is not.
- Fix approach: Single `computeComplianceStats(anomalies, standardCount)` helper in `src/lib/vision.ts`.

**Stale AI Studio boilerplate:**
- Issue: `package.json` name is `"react-example"`; `README.md` still references generic AI Studio banner and deployment flow, not ShelfGuard-specific architecture.
- Files: `package.json`, `README.md`
- Impact: Onboarding confusion for contributors.
- Fix approach: Rename package, rewrite README to document actual mock vs planned vision pipeline.

**TypeScript strictness disabled:**
- Issue: `tsconfig.json` has no `strict`, `noUnusedLocals`, or `noUnusedParameters`. Lint script is `tsc --noEmit` only — no ESLint/Prettier config at project root.
- Files: `tsconfig.json`, `package.json`
- Impact: Unused imports (e.g., `Trash2`, `ArrowLeft` in `src/components/AuditHistoryModal.tsx`) and dead props compile silently.
- Fix approach: Enable `strict: true`; add ESLint with `no-unused-vars` rule.

## Known Bugs

**Demo mode capture ignores displayed frame:**
- Symptoms: In demo mode (`isUsingDemoFeed === true`), `captureFrame()` in `src/hooks/useCameraStream.ts` always returns `DEFAULT_SHELF_IMAGE_URL` from `src/lib/constants.ts` instead of rendering the current `baseline.imageDataUrl` shown in `src/components/CameraView.tsx`.
- Files: `src/hooks/useCameraStream.ts`, `src/components/CameraView.tsx`, `src/lib/constants.ts`
- Trigger: Use default demo feed, upload custom baseline, tap shutter without switching to real camera.
- Workaround: Switch to physical camera before capture.

**Custom baseline upload preserves stale imageDimensions:**
- Symptoms: `handleUploadCustomBaseline` in `src/App.tsx` sets `imageDataUrl` but spreads existing `baseline` without updating `imageDimensions`. Field is never read by rendering code (images use `object-cover`), but any future aspect-ratio logic will be wrong.
- Files: `src/App.tsx`, `src/types.ts`
- Trigger: Upload a non-9:16 image as baseline.
- Workaround: None currently — latent bug.

**Torch toggle shows ON when hardware unsupported:**
- Symptoms: `toggleTorch()` in `src/hooks/useCameraStream.ts` falls through to `setIsTorchOn((prev) => !prev)` when torch capability is absent or constraint fails, updating UI without changing hardware.
- Files: `src/hooks/useCameraStream.ts`, `src/components/CameraView.tsx`
- Trigger: Tap torch on desktop or unsupported mobile browser.
- Workaround: None — misleading UI state.

**Shutter animation race on rapid re-capture:**
- Symptoms: `handleShutterClick` in `src/App.tsx` uses unguarded `setTimeout(..., 800)` to transition to `RESULT_INSPECT`. A second shutter press before 800ms elapses schedules a second timeout without cancellation.
- Files: `src/App.tsx`
- Trigger: Double-tap shutter quickly.
- Workaround: Wait for animation to finish.

**Hardcoded placeholder timestamp in camera view:**
- Symptoms: When no audit history exists, `src/components/CameraView.tsx` displays `'14:20'` as thumbnail time instead of empty or current time.
- Files: `src/components/CameraView.tsx`
- Trigger: Fresh install with no completed audits.
- Workaround: Complete one audit.

## Security Considerations

**Client-side-only storage of shelf imagery:**
- Risk: Baseline photos and audit thumbnails are stored as full JPEG data URLs in IndexedDB via `src/lib/storage.ts`. No encryption, access control, or data retention policy. Device loss exposes retail shelf photos and audit metadata locally.
- Files: `src/lib/storage.ts`, `src/App.tsx`
- Current mitigation: Data stays on device (no network sync).
- Recommendations: Document data sensitivity for retail operators; add optional purge/export; consider compressing or storing blobs separately from metadata.

**Unbounded image upload size:**
- Risk: `handleUploadCustomBaseline` in `src/App.tsx` reads arbitrary `image/*` files via `FileReader.readAsDataURL` with no size check before persisting to IndexedDB.
- Files: `src/App.tsx`, `src/components/ResetBaselineModal.tsx`
- Current mitigation: Browser FileReader limits apply; IndexedDB quota will eventually reject writes.
- Recommendations: Reject files over ~5MB; resize/compress before storing; show user-facing error from `saveBaseline` failures.

**External CDN dependency for default baseline:**
- Risk: Default shelf image loads from `lh3.googleusercontent.com` URL in `src/lib/constants.ts`. Offline-first PWA cannot show default baseline if CDN is unreachable and no local copy exists.
- Files: `src/lib/constants.ts`, `public/manifest.json`
- Current mitigation: PWA caches app shell via `vite-plugin-pwa`; image URL is not bundled.
- Recommendations: Bundle default baseline image in `public/` for true offline default.

**Future API key exposure risk:**
- Risk: `.env.example` documents `GEMINI_API_KEY` for client-side AI Studio pattern. If Gemini is wired client-side (as AI Studio templates often do), the key would be exposed in the browser bundle.
- Files: `.env.example`, `README.md`, `metadata.json`
- Current mitigation: Key is not referenced in `src/` yet.
- Recommendations: Keep Gemini calls server-side via Express proxy; never embed API keys in Vite `define` or client env.

**No Content Security Policy:**
- Risk: `index.html` loads Google Fonts from external CDN with no CSP headers defined in app config.
- Files: `index.html`, `vite.config.ts`
- Current mitigation: Standard Vite dev/prod defaults.
- Recommendations: Add CSP meta or server headers when deploying.

## Performance Bottlenecks

**IndexedDB bloat from inline JPEG data URLs:**
- Problem: Each `AuditRecord.thumbnailUrl` and `ShelfCalibration.imageDataUrl` stores a full base64 JPEG (~200KB–2MB each). History capped at 50 records in `src/lib/storage.ts` but baseline + 50 thumbnails can exceed 50MB.
- Files: `src/lib/storage.ts`, `src/App.tsx`, `src/types.ts`
- Cause: `canvas.toDataURL('image/jpeg', 0.92)` at 1080×1920 without downscaling for storage.
- Improvement path: Store `Blob` in IndexedDB via `idb-keyval` custom serializer; persist thumbnails at 320px width; keep full-res only for active comparison.

**Large React state strings trigger re-renders:**
- Problem: `capturedFrame` and `baseline.imageDataUrl` are multi-hundred-KB strings held in React state in `src/App.tsx`, passed to child components on every state change.
- Files: `src/App.tsx`, `src/components/CameraView.tsx`, `src/components/ResultInspectView.tsx`
- Cause: Data URL strings used directly as `img src`.
- Improvement path: Use `URL.createObjectURL(blob)` with revocation on unmount; memoize image components.

**Synchronous deep clone on every analysis:**
- Problem: `JSON.parse(JSON.stringify(INITIAL_MOCK_ANOMALIES))` in `src/lib/vision.ts` runs on every capture and tolerance change despite static data.
- Files: `src/lib/vision.ts`, `src/App.tsx`
- Cause: Defensive copy pattern applied to constant mock data.
- Improvement path: Remove once real analysis returns fresh objects; until then, clone once at module load.

**PWA service worker enabled in development:**
- Problem: `vite.config.ts` sets `devOptions.enabled: true` for `vite-plugin-pwa`, adding service worker overhead during local development.
- Files: `vite.config.ts`
- Cause: AI Studio template default for offline testing.
- Improvement path: Disable dev SW unless explicitly testing PWA; keep production `autoUpdate`.

## Fragile Areas

**Camera stream lifecycle in useCameraStream:**
- Files: `src/hooks/useCameraStream.ts`
- Why fragile: `startCamera` includes `stream` in its `useCallback` dependency array, causing callback identity to change whenever stream updates. `toggleDemoMode` depends on `startCamera`. Rapid demo/camera toggles may leave orphaned MediaStream tracks or fail to reattach to `videoRef`.
- Safe modification: Remove `stream` from deps; use functional cleanup ref pattern. Test toggle cycle 10+ times on mobile.
- Test coverage: None.

**Side effects inside setState updater:**
- Files: `src/App.tsx` (`handleDismissAnomaly`)
- Why fragile: Calls `setMissingCount`, `setDisplacedCount`, `setActualCount`, `setComplianceRate` inside the `setAnomalies` functional updater. React 18 batching may cause transient inconsistent UI if other updates interleave.
- Safe modification: Compute next anomalies first, then batch all derived stat updates in one handler body.
- Test coverage: None.

**Device orientation without iOS permission flow:**
- Files: `src/hooks/useDeviceOrientation.ts`, `src/components/CameraView.tsx`
- Why fragile: iOS 13+ requires `DeviceOrientationEvent.requestPermission()` for accurate tilt; hook listens unconditionally. Desktop relies on hidden `setSimulatedTilt` via level button click — not discoverable.
- Safe modification: Add iOS permission prompt on first camera view mount; hide simulate control behind dev flag.
- Test coverage: None.

**ROI divider drag pointer capture:**
- Files: `src/components/RoiSetupView.tsx`
- Why fragile: Pointer events attach to divider `div` elements; `handlePointerMove` only fires when `activeTierIndex === index`. Dragging fast across tiers may drop capture. Magnifier CSS transform is hand-tuned, not tied to actual image coordinates.
- Safe modification: Attach move listener to `stageRef` container during drag; add touch-action CSS.
- Test coverage: None.

**Tolerance re-analysis on stale capture:**
- Files: `src/App.tsx` (`handleToleranceChange`), `src/lib/vision.ts`
- Why fragile: Tolerance change re-runs mock analysis on `capturedFrame`, but mock logic ignores the frame anyway — when real vision is added, must ensure ROI alignment uses same registration as initial capture.
- Safe modification: Pass baseline + capture pair through a single analysis pipeline with explicit homography step.
- Test coverage: None.

## Scaling Limits

**Audit history cap (50 records):**
- Current capacity: 50 records max (`src/lib/storage.ts` line 53: `.slice(0, 50)`)
- Limit: Older audits silently dropped; no archive/export before eviction
- Scaling path: Paginate history; move to IndexedDB object store with cursor; optional cloud sync

**IndexedDB single-key arrays:**
- Current capacity: Entire history stored under one key `shelfguard_audit_history`
- Limit: Every append reads full array, prepends, writes back — O(n) per audit on growing history
- Scaling path: Per-record keys with timestamp index; or migrate to Dexie.js

**No multi-store or multi-user support:**
- Current capacity: Single-device, single-operator model
- Limit: Cannot share baselines across store associates or central dashboard
- Scaling path: Backend API for baseline sync and audit aggregation

## Dependencies at Risk

**@google/genai (^2.4.0):**
- Risk: Declared but unused; version may drift from AI Studio template expectations before integration work begins
- Impact: Breaking API changes when finally wired
- Migration plan: Pin version at integration time; follow server-side proxy pattern from `metadata.json`

**vite-plugin-pwa (^1.3.0) with manifest: false:**
- Risk: PWA plugin registered in `vite.config.ts` but `manifest: false` defers to `public/manifest.json` — dual manifest sources can confuse cache/update behavior
- Impact: Install prompt and update semantics may differ between dev and prod
- Migration plan: Consolidate manifest config in one place; test install on Android/iOS

**motion (^12.23.24):**
- Risk: Listed in `package.json` dependencies but not imported anywhere under `src/`
- Impact: Dead weight (~tens of KB gzipped)
- Migration plan: Remove or use for scanning/transition animations instead of inline `<style>` in `src/components/ScanningAnimationOverlay.tsx`

## Missing Critical Features

**Real image comparison engine:**
- Problem: No homography alignment, pixel diff, or object detection between baseline and capture
- Blocks: Accurate missing/displaced product detection — the app's primary purpose

**Export/report generation:**
- Problem: Share button in `src/components/ResultInspectView.tsx` (`handleExport`) only shows a toast for 2.6s — no PDF, CSV, clipboard, or share sheet. I18N key `exportReport` and success message imply export occurred.
- Blocks: Audit handoff to store managers or HQ systems

**Audit history interaction:**
- Problem: `AuditHistoryModal` imports `Trash2` and accepts `onSelectRecord` prop but neither is wired — records are view-only, no delete, no drill-down to past inspection
- Blocks: History management and regression comparison

**Baseline capture from camera:**
- Problem: Reset flow allows upload or ROI recalibration of existing image, but no "capture new baseline from camera" action
- Blocks: Field operators setting baseline from live shelf photo in one workflow

**Network sync:**
- Problem: I18N string `auditSyncSuccess` ("巡检数据已归档并持久化保存") implies sync; storage is local IndexedDB only
- Blocks: Multi-device visiblity and backup

## Test Coverage Gaps

**Vision/analysis pipeline:**
- What's not tested: `analyzeShelfCapture` tolerance filtering, stat computation, future pixel diff
- Files: `src/lib/vision.ts`
- Risk: Mock-to-real swap could break compliance math and tolerance behavior unnoticed
- Priority: High

**Storage layer:**
- What's not tested: IndexedDB read/write, 50-record cap, malformed data fallback to defaults
- Files: `src/lib/storage.ts`
- Risk: Data loss or silent fallback to demo baseline in production
- Priority: High

**Camera capture path:**
- What's not tested: Demo vs real capture branching, canvas fallback, stream cleanup
- Files: `src/hooks/useCameraStream.ts`
- Risk: Memory leaks from unstopped MediaStream tracks on mobile
- Priority: Medium

**App mode state machine:**
- What's not tested: Transitions among `CAMERA_IDLE` → `SCANNING_ANIM` → `RESULT_INSPECT` → `ROI_CONFIG`
- Files: `src/App.tsx`
- Risk: Race conditions and orphaned timeouts
- Priority: Medium

**Component interaction (ROI drag, anomaly dismiss):**
- What's not tested: Pointer drag constraints, dismiss animation + stat recalculation
- Files: `src/components/RoiSetupView.tsx`, `src/components/ResultInspectView.tsx`, `src/App.tsx`
- Risk: UI regressions on touch devices
- Priority: Medium

**Zero test infrastructure:**
- What's not tested: Entire application — no `*.test.*` or `*.spec.*` files; no Vitest/Jest/Playwright config
- Files: `package.json` (no test script)
- Risk: All regressions caught manually or in production
- Priority: High

---

*Concerns audit: 2026-09-20*
