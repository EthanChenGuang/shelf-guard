# Pitfalls Research

**Domain:** Retail shelf inspection PWA (camera capture, orientation guidance, client-side image diff, multi-shelf local storage)
**Researched:** 2026-09-20
**Confidence:** HIGH (camera/storage/PWA mechanics cross-checked with MDN, web.dev, WebKit); MEDIUM (retail CV heuristics from industry practice, not ShelfGuard-specific benchmarks)

## Critical Pitfalls

### Pitfall 1: iOS Standalone PWA Camera Stream Silently Fails

**What goes wrong:**
`getUserMedia()` resolves and permission appears granted, but the `<video>` element never plays — only `loadstart`, `progress`, and `suspend` fire. Users see a frozen black preview in home-screen PWA mode while the same URL works in Safari tabs. On some devices the camera indicator pill loops indefinitely. Recovery may require device restart or closing the app during the permission prompt.

**Why it happens:**
WebKit has long-standing bugs ([252465](https://bugs.webkit.org/show_bug.cgi?id=252465), [273938](https://bugs.webkit.org/show_bug.cgi?id=273938)) where standalone PWAs (`display: standalone` in manifest) mishandle MediaStream playback. Triggers include closing the app while video is clipped off-screen, keyboard pushing video off-screen, or stale stream state after backgrounding. ShelfGuard's `useCameraStream` assigns stream to `videoRef` with `playsinline` but has no health check or PWA-specific recovery path.

**How to avoid:**
- Require `<video autoplay playsinline muted>` attributes (already partially present).
- Add stream health probe: if `loadedmetadata`/`playing` does not fire within 2s, stop tracks, re-request permission, show actionable error.
- Detect standalone mode (`window.matchMedia('(display-mode: standalone)')`) and surface "Open in Safari" fallback when stream stalls.
- Never close app during active capture flow; stop tracks explicitly in `visibilitychange` handler before backgrounding.
- Test every iOS release on installed PWA, not just Safari tab — CONCERNS.md flags zero mobile test coverage.

**Warning signs:**
- Video events stop at `suspend` with no `NotAllowedError`.
- Camera works in dev (localhost Safari) but fails after "Add to Home Screen."
- `cameraError` stays null despite blank preview — today `CameraView.tsx` does not even display `cameraError` from the hook.

**Phase to address:**
Camera hardening phase (before field pilot). Block production PWA install until iOS standalone smoke test passes.

---

### Pitfall 2: Device Orientation Level Gate Is Inert on iOS

**What goes wrong:**
The ±1.5° level indicator and haptic "snap" never activate on iPhone. Users capture at tilted angles, causing perspective mismatch that pixel diff interprets as mass displacement across all four ROI tiers.

**Why it happens:**
iOS 13+ requires `DeviceOrientationEvent.requestPermission()` from an explicit user gesture (button tap). ShelfGuard's `useDeviceOrientation.ts` listens unconditionally with no permission request. The hook's `hasSensor` may stay false forever on iOS Safari/PWA. Desktop relies on hidden `setSimulatedTilt` via level button — not discoverable in production.

**How to avoid:**
- On first camera mount, show one-time "Enable tilt sensor" button that calls `DeviceOrientationEvent.requestPermission()` inside the click handler (MDN pattern).
- Block shutter until `isLevel === true` OR user explicitly overrides with documented warning.
- Log `hasSensor` state; if false after permission flow, show "Hold phone level manually" guidance instead of fake level UI.
- Do not use `gamma` alone for portrait shelf shots — validate which axis maps to roll for fixed portrait mount; document in baseline setup.

**Warning signs:**
- Level bubble animates on desktop simulator but is static on iPhone.
- Every real capture flags displaced items on top/bottom tiers only (perspective skew signature).

**Phase to address:**
Orientation & capture quality phase — must precede real vision pipeline, or diff will inherit bad geometry.

---

### Pitfall 3: Naive Pixel Diff Without Registration Produces Unusable Results

**What goes wrong:**
Replacing the mock in `analyzeShelfCapture()` with raw canvas `ImageData` subtraction flags hundreds of false positives: lighting shifts, shadow movement, auto-exposure changes, and 2–5° viewpoint drift all appear as "MOVED" or "MISSING" anomalies. Users lose trust within one audit cycle.

**Why it happens:**
ShelfGuard assumes fixed tripod position but only provides a ghost overlay — no homography, no photometric normalization. Industry practice (shelf analytics workflows) requires: undistort → white balance → warp to shelf plane → compare in LAB/structural space → morphology on diff mask. The mock in `src/lib/vision.ts` hides this entirely; JSDoc claims "connected-component contour bounding" that does not exist.

**How to avoid:**
- Implement minimum pipeline: (1) ROI crop per `splitYPercentages`, (2) optional feature-based alignment (ORB/SIFT or corner markers on shelf edge), (3) reject frame if alignment RMS > ~4px, (4) compare in luminance-normalized space, (5) connected components with minimum area threshold per tier.
- Treat tolerance slider as diff threshold + min blob area, not mock anomaly filter — `handleToleranceChange` must re-run same pipeline on stored capture pair.
- Dead-letter captures with bad alignment instead of scoring them — a confident wrong score is worse than "recapture needed."
- Reserve Gemini pass for low-confidence regions only; do not send full 1080×1920 JPEG client-side (API key exposure per CONCERNS.md).

**Warning signs:**
- Anomaly count spikes when store lights turn on or sun angle shifts.
- Bottom ROI tiers have more false positives than top (homography drift signature).
- Tolerance "loose" still floods results — threshold alone cannot fix misalignment.

**Phase to address:**
Vision pipeline phase — core product value; do not ship multi-shelf UI before this works on real photos.

---

### Pitfall 4: Demo Mode Capture Analyzes Wrong Image

**What goes wrong:**
User uploads custom baseline, stays on demo feed, taps shutter — `captureFrame()` returns `DEFAULT_SHELF_IMAGE_URL` instead of the displayed baseline or live frame. Analysis compares unrelated images; results appear authoritative because UI shows real bounding boxes.

**Why it happens:**
Known bug in `useCameraStream.ts`: demo branch short-circuits to constant URL. Combined with mock vision ignoring `capturedDataUrl`, the failure is invisible today. Once real diff ships, this becomes a data-integrity incident.

**How to avoid:**
- Unify capture: always rasterize what user sees (`videoRef` or displayed baseline image) via shared `captureElementToDataUrl()` (currently dead export in `vision.ts`).
- Disable shutter in demo mode unless explicitly labeled "Simulation."
- After capture, show thumbnail confirmation before analysis — user verifies frame matches shelf.

**Warning signs:**
- Capture instant with no shutter flash on demo feed.
- Captured frame URL host is `lh3.googleusercontent.com` after custom baseline upload.

**Phase to address:**
Camera hardening phase — fix before any vision work lands; one-line bug with catastrophic downstream impact.

---

### Pitfall 5: IndexedDB Quota Exhaustion Across 5 Shelves

**What goes wrong:**
After adding 5 independent baselines (each ~500KB–2MB JPEG data URL) plus 50 audits × 5 shelves of thumbnails, writes throw `QuotaExceededError`. `saveBaseline()` and `saveAuditRecord()` only `console.error` — user sees success UI while data silently fails to persist. On iOS installed PWA, storage is a separate container from Safari with no quota expansion prompt.

**Why it happens:**
Current schema stores full base64 JPEGs under single keys (`shelfguard_baseline`, `shelfguard_audit_history`). No size check on upload (`handleUploadCustomBaseline`). Multi-shelf multiplies storage ~5×. web.dev notes Safari PWA home-screen apps may not offer quota increase dialogs. idb-keyval stores structured clone of entire history array on every audit — O(n) read-modify-write.

**How to avoid:**
- Migrate to per-shelf keys: `baseline:{shelfId}`, `history:{shelfId}:{auditId}`.
- Store `Blob` or ArrayBuffer (Safari WebKit blob URLs are unreliable — recreate Blob from buffer + MIME on read).
- Persist thumbnails at 320px width; keep full-res in memory only during active comparison session.
- Call `navigator.storage.estimate()` before writes; block with user-facing error at 80% quota.
- Cap per-shelf history (e.g., 20) with explicit "storage full" UX and export/purge action.
- Compress on ingest: reject uploads >5MB; resize to max 1080p before `set()`.

**Warning signs:**
- Audit history count stops growing while UI shows success toast.
- App slower over weeks of use (large JSON parse on every history load).
- Fresh install works; long-running store device fails after ~2–4 weeks.

**Phase to address:**
Multi-shelf storage phase — design schema before UI swipe ships, not after.

---

### Pitfall 6: React State Holding Multi-MB Data URLs Kills Mobile Performance

**What goes wrong:**
Each state update re-renders tree with 500KB–2MB strings (`capturedFrame`, `baseline.imageDataUrl`). Tolerance slider drag triggers re-analysis and re-render at 60fps attempts. Analysis on main thread blocks scanning animation; frame drops break 0.8s scan line PRD spec.

**Why it happens:**
CONCERNS.md documents `canvas.toDataURL('image/jpeg', 0.92)` at 1080×1920 stored directly in React state. No `URL.createObjectURL` pattern, no Web Worker for diff, no `OffscreenCanvas`.

**How to avoid:**
- Hold captures as `Blob` in refs; expose object URLs to `<img>` only.
- Run pixel diff in Web Worker with `ImageBitmap` transferables.
- Debounce tolerance re-analysis (300ms); show progress on `PROCESSING` mode (type exists, unused).
- Revoke object URLs on mode transition and unmount.

**Warning signs:**
- UI jank when dragging tolerance slider on mid-range Android.
- Memory climb in Safari Web Inspector after 10 consecutive audits.

**Phase to address:**
Vision pipeline phase (parallel with storage migration).

---

### Pitfall 7: Shutter Race and Unguarded Timeouts Corrupt Result State

**What goes wrong:**
Double-tap shutter schedules two 800ms timeouts; second transition overwrites first analysis mid-flight. User sees results from wrong capture or stale anomalies mixed with new frame.

**Why it happens:**
Known bug: `handleShutterClick` in `App.tsx` uses unguarded `setTimeout(..., 800)` with no in-flight lock. Mock analysis is synchronous today; real async vision exposes race immediately.

**How to avoid:**
- Add `captureInFlight` ref; ignore shutter while true.
- Use `AbortController` for analysis; clear timeouts on unmount.
- Wire `PROCESSING` AppMode between capture and result.

**Warning signs:**
- Scan animation restarts mid-flight on double tap.
- Result anomalies don't match visible capture after rapid re-shoot.

**Phase to address:**
App state machine refactor phase — before async vision lands.

---

### Pitfall 8: False Confidence from Mock UI Masking Missing Backend

**What goes wrong:**
Stakeholders demo ShelfGuard, see polished anomaly boxes and compliance scores, approve rollout — then discover every shelf returns the same three preset SKUs (Drunk Elephant, NARS, Aesop). Field trial fails catastrophically because UI/UX was validated separately from detection accuracy.

**Why it happens:**
`INITIAL_MOCK_ANOMALIES` filtered by tolerance creates plausible UX. Export button shows toast without file (`handleExport`). I18N `auditSyncSuccess` implies cloud sync that does not exist. This is the brownfield trap described in PROJECT.md.

**How to avoid:**
- Banner "SIMULATION MODE" until real vision passes golden test set.
- Separate acceptance criteria: UI parity vs detection accuracy vs storage reliability.
- Build golden image pairs (aligned/misaligned/missing SKU) before removing mock.

**Warning signs:**
- Anomaly titles are always the same brand names regardless of shelf photo.
- Compliance rate formula duplicated in `App.tsx` and `vision.ts` — easy to tune UI numbers independently of detection.

**Phase to address:**
Vision pipeline phase gate — explicit mock removal checklist in "Looks Done But Isn't" below.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Base64 data URLs in idb-keyval | Fast to ship, works everywhere | 33% size overhead, quota blowout, Safari blob bugs | Never for production multi-shelf |
| Single global baseline key | Matches v1 prototype | Cannot add 5 shelves without migration | Only during single-shelf prototype |
| Mock vision with realistic labels | Demo-ready UI | Hides missing core value; false QA sign-off | Until golden tests exist — then remove |
| `devOptions.enabled: true` for PWA SW | Offline testing in dev | Stale cache masks camera/SW bugs; confuses debugging | Dev only; disable by default |
| Client-side Gemini via Vite env | AI Studio template speed | API key in bundle, quota abuse | Never — server proxy only |
| Ghost overlay without numeric alignment score | Simple UX | Users think they're aligned when diff will fail | MVP if shutter blocked until level + optional corner match score |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `getUserMedia` | Requesting 1920×1080 on all devices; no fallback | Progressive constraint downgrade; accept device max; show resolution in debug |
| iOS DeviceOrientation | Auto-listening on mount | `requestPermission()` on user gesture; handle `denied` gracefully |
| `@google/genai` | Wiring in browser with `GEMINI_API_KEY` in Vite | Express proxy (`metadata.json` intent); client sends capture ID only |
| vite-plugin-pwa | Expecting SW to cache camera stream | SW caches app shell only; camera requires live network permission |
| IndexedDB (idb-keyval) | Single JSON blob for all history | Object store per record; index by shelfId + timestamp |
| External baseline CDN | Default image from `googleusercontent.com` | Bundle default in `public/` for offline-first promise |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-res JPEG in React state | Slider jank, OOM on iPhone 11 | Blob refs + object URLs | ~5 captures/session |
| Synchronous canvas diff on main thread | Scan animation stutters | Web Worker + downscaled compare (640px) | First real vision commit |
| History array RMW | Save audit takes 500ms+ | Per-record keys, append-only | ~30 audits with thumbnails |
| 5 shelves × 50 audits × 200KB thumb | QuotaExceededError | 320px thumbs, 20 cap/shelf, quota monitor | ~2 weeks daily use |
| JSON deep clone mock anomalies | Wasted CPU each tolerance change | Remove when real analysis returns fresh objects | Negligible now; remove with vision |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Unbounded baseline upload | IndexedDB DoS, memory spike | 5MB cap, resize, reject non-image |
| Shelf photos unencrypted in IDB | Device theft exposes planogram intel | Document sensitivity; optional purge; no cloud without consent |
| Gemini key in client bundle | Key scraping, billing abuse | Server-side proxy only |
| No CSP on deployed PWA | XSS → camera + storage access | CSP meta/headers at deploy |
| Persisting full audit images indefinitely | GDPR/retention issues | Retention policy; thumbnail-only after N days |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Torch UI toggles when hardware unsupported | User thinks flash is on in dim aisle | Query `track.getCapabilities().torch` before showing active state — fix known bug in `useCameraStream.ts` |
| No camera error display | Blank screen, no next step | Wire `cameraError` to banner with `I18N.cameraPermissionDenied` |
| Ghost overlay at 45% opacity | False alignment confidence | Require level gate; optional edge-match score before shutter enable |
| Tolerance slider without explanation | Users crank to "loose" to silence false alarms | Show "sensitivity" label; when real diff ships, explain alignment vs threshold |
| Export toast without file | Manager thinks report was sent | Disable export until PDF/share sheet exists |
| No baseline-from-camera flow | Upload-only calibration fails in field | Add "Capture baseline" in reset modal |
| 5-shelf swipe without shelf label | Wrong baseline compared | Persistent shelf name/number chip; confirm shelf on capture |

## "Looks Done But Isn't" Checklist

- [ ] **Vision pipeline:** `analyzeShelfCapture` still clones `INITIAL_MOCK_ANOMALIES` — verify real diff on 10+ golden pairs before removing banner
- [ ] **Camera capture:** Demo mode returns CDN URL — verify capture hash matches displayed video frame
- [ ] **Level gate:** iOS permission granted — verify `hasSensor === true` on physical iPhone PWA
- [ ] **IndexedDB saves:** `saveAuditRecord` catch block — verify QuotaExceededError surfaces in UI, not console only
- [ ] **Multi-shelf:** Swipe UI present — verify isolated baseline/history per shelfId in storage keys
- [ ] **PWA install:** Manifest + SW — verify camera works in standalone mode on iOS 17+ and Android Chrome
- [ ] **Export:** Toast shown — verify file/share payload exists
- [ ] **Gemini optional pass:** Dependency declared — verify server proxy, no client key
- [ ] **Offline default:** CDN baseline — verify bundled fallback in `public/`
- [ ] **Tolerance re-run:** Slider updates — verify same alignment transform applied, not full re-capture

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| iOS PWA camera stuck | LOW–MEDIUM | Force-stop app; reopen; if persistent, open in Safari tab; worst case device restart |
| QuotaExceededError | MEDIUM | Export audits; purge history; compress baselines; clear site data (loses all shelves) |
| Bad baseline calibration | LOW | Re-capture baseline from fixed mount; re-draw ROI dividers |
| False positive flood after vision ship | HIGH | Roll back to stricter alignment gate; tune per-store lighting profile; temporary tolerance default "loose" with review flag |
| Corrupt history JSON | MEDIUM | `loadAuditHistory` falls back to `[]` — restore from export if exists; else data loss |
| Wrong shelf compared | LOW | Re-audit after selecting correct shelf; add confirm dialog prevention |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| iOS PWA camera failure | Camera hardening | Standalone PWA records video on 3 iOS + 2 Android devices |
| iOS orientation permission | Orientation & capture quality | `hasSensor` true after tap; shutter blocked when not level |
| Naive pixel diff | Vision pipeline | Golden set: <5% FP, <5% FN on staged shelf changes |
| Demo capture wrong frame | Camera hardening | Capture bytes match video frame checksum |
| IndexedDB 5-shelf quota | Multi-shelf storage | `storage.estimate` <80% after 30 audits × 5 shelves |
| React data URL perf | Vision pipeline | Tolerance drag maintains 60fps on target Android |
| Shutter race | App state machine | 10 double-taps → single result, no orphan timeouts |
| Mock masking real gaps | Vision pipeline gate | Simulation banner removed only after golden tests pass |
| Gemini key exposure | Server integration | Bundle audit shows no API key strings |
| Service worker dev confusion | PWA production config | `devOptions.enabled: false` default; prod install update test |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Multi-shelf UI | Migrating single `shelfguard_baseline` key breaks existing users | Versioned schema + one-time migration on init |
| ROI drag | Fast drag drops pointer capture across tiers | Attach move listener to stage container; `touch-action: none` |
| Ghost overlay | Users skip baseline recalibration after camera mount move | Prompt baseline refresh if capture alignment RMS high |
| Scanning animation 0.8s | Async vision exceeds animation | Extend to `PROCESSING` mode with cancel; don't fake completion |
| Stitch UI parity | Pixel-perfect CSS while vision still mock | Don't conflate design review with functional sign-off |
| First-run guide (`INITIAL_GUIDE`) | Skipped; demo baseline used silently | Block audit until baseline captured or explicitly imported |

## Sources

- [MDN: MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — secure context, permission model (HIGH)
- [WebKit Bug 252465](https://bugs.webkit.org/show_bug.cgi?id=252465) — PWA video stream playback failure (HIGH)
- [WebKit Bug 273938](https://bugs.webkit.org/show_bug.cgi?id=273938) — standalone PWA camera regression iOS 17.x (HIGH)
- [MDN: DeviceOrientationEvent.requestPermission()](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static) — iOS gesture requirement (HIGH)
- [web.dev: Storage for the web](https://web.dev/articles/storage-for-the-web) — quota, PWA separate container (HIGH)
- [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) — Safari 17 quota rules (HIGH)
- [Shelf Analytics: Preprocessing & homography](https://www.shelfanalytics.org/image-parsing-computer-vision-workflows/shelf-image-preprocessing-and-normalization/) — alignment/normalization requirements (MEDIUM)
- [Stack Overflow: Image diff with viewpoint/lighting](https://stackoverflow.com/questions/67736244/differences-between-two-images-with-slightly-different-point-of-view-and-lightin) — false positive patterns (MEDIUM)
- [Clobotics: Planogram compliance pitfalls](https://clobotics.com/resources/insights/planogram-compliance-measure-improve-in-store-execution/) — partial coverage, occlusion (MEDIUM)
- ShelfGuard codebase audit: `.planning/codebase/CONCERNS.md` — known bugs and fragile areas (HIGH)

---
*Pitfalls research for: ShelfGuard retail shelf inspection PWA*
*Researched: 2026-09-20*
