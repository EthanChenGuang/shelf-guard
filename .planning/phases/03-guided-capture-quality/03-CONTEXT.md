# Phase 3: Guided Capture Quality - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver **reliable guided re-shoot alignment** before vision analysis: full-screen live camera (or demo baseline stream), per-shelf ghost overlay with adjustable transparency, crosshair level gauge with ±1.5° snap + haptic feedback, and **iOS DeviceOrientation permission** on user gesture.

**In scope:** CAM-01 (live/demo feed), CAM-02 (ghost overlay + slider), CAM-03 (level gauge), CAM-07 (iOS orientation permission). Harden existing brownfield implementations in `CameraView`, `useDeviceOrientation`, `useCameraStream`, and shelf-scoped baseline wiring from Phase 2.

**Out of scope:** PRD top bar polish (CAM-04), breathing shutter / scan-line (CAM-05/06 — Phase 5), INITIAL_GUIDE onboarding (SHLF-05 — Phase 5), real pixel diff (Phase 4), swipe carousel (SHLF-01 — Phase 5), ghost opacity IndexedDB persistence (optional v2), homography alignment (v2 VIS-07).
</domain>

<decisions>
## Implementation Decisions

### Ghost Overlay Visibility (CAM-02)
- **D-01:** Ghost overlay renders **only when live camera is active** (`isUsingDemoFeed === false`). In demo mode the feed already shows the baseline reference — a second ghost layer is redundant and harms clarity. Hide ghost `div` and right-edge slider when demo feed is active.
- **D-02:** Ghost overlay renders **only when the active shelf has a persisted baseline** (`loadBaselineRaw(activeShelfId)` returned non-null). Empty shelves (indices 1–4 post-migration) show live/demo feed without ghost until user calibrates in Phase 4/5. Do not ghost-overlay `DEFAULT_CALIBRATION` CDN image on empty shelves. — **Reversibility:** costly — `CameraView` props contract gains `hasPersistedBaseline` boolean from App.
- **D-03:** Ghost image source is always **`baseline.imageDataUrl`** from the active shelf (Phase 2 `objectUrlRegistry` resolved URL). On shelf switch, ghost updates with `loadShelfData` — no cross-shelf bleed.
- **D-04:** Default ghost opacity stays **45%** on mount; opacity is **global App state** (not per-shelf, not IndexedDB-persisted in Phase 3) — matches Phase 2 global tolerance/language pattern.
- **D-05:** Ghost blend mode keeps existing **`mix-blend-screen`** + contrast/brightness filter in `CameraView.tsx`. PRD-specific visual polish deferred to Phase 5.

### iOS Orientation Permission (CAM-07)
- **D-06:** Request orientation permission on the **same user gesture that enables live camera** — chain inside `startCamera` / `toggleDemoMode` path after successful `getUserMedia`. Do not request on app mount (iOS requires user activation).
- **D-07:** Extend `useDeviceOrientation` to export `requestOrientationPermission()`, `orientationPermission` state (`'granted' | 'denied' | 'prompt' | 'unsupported'`), and only attach `deviceorientation` listener after grant (or immediately on non-iOS where no prompt exists).
- **D-08:** If orientation permission denied, show **inline banner on CameraView** — same UX contract as Phase 1 camera error banner (D-07). Include i18n copy: enable Motion & Orientation in iOS Settings → Safari → [app]. Level crosshair remains visible but frozen at 0° / gray until granted.
- **D-09:** Banner includes **"Retry"** button that re-calls `requestOrientationPermission()` on tap. No automatic re-prompt loops.
- **D-10:** Permission request is **independent but sequential** with camera permission on the enable-camera gesture: `getUserMedia` first, then orientation request. Camera can work without orientation; orientation banner shown separately if camera succeeds but orientation fails.

### Level Gauge Behavior (CAM-03)
- **D-11:** Level threshold locked at **±1.5°** on `gamma` axis (portrait roll). Mint green **`#10B981`** snap styling and **40ms vibrate** on level entry — existing hook behavior retained.
- **D-12:** Haptic debounce: **1200ms** on real sensor path, **800ms** on simulate path (existing `lastVibrateTime` logic).
- **D-13:** **No-sensor fallback:** After 3s without `deviceorientation` events, treat as no sensor. Show level pill with simulate toggle (`onSimulateTiltToggle`) when `!hasSensor` — enables desktop QA. In production mobile with denied permission, simulate toggle is **hidden**; user sees orientation-denied banner instead.
- **D-14:** Level crosshair **always visible** on camera view (unlike ghost slider). Rotating horizon line uses `transform: rotate(${tilt}deg)` — existing implementation.

### Live Camera Feed (CAM-01)
- **D-15:** **Demo-first on launch** — retain Phase 1 D-10 default (`isUsingDemoFeed: true`). User opts into live rear camera via existing demo/camera toggle.
- **D-16:** Live camera uses **`facingMode: environment`**, ideal 1920×1080, `object-cover` full viewport — existing `useCameraStream` config. No auto-start camera on mount.
- **D-17:** Demo feed for any shelf shows **`baseline.imageDataUrl`** (resolved display URL or `DEFAULT_CALIBRATION` CDN for empty shelf 0 legacy path).

### Testing & Verification
- **D-18:** Add **unit tests** for `useDeviceOrientation` permission flow (mock `DeviceOrientationEvent.requestPermission`). Add **component tests** for ghost visibility rules (hidden in demo mode, hidden when no persisted baseline, visible when live + baseline exists).
- **D-19:** Integration test: shelf switch updates ghost source URL without stale object URL leak (extend Phase 2 isolation test pattern).

### Claude's Discretion
- Exact i18n key names for orientation-denied banner strings in `constants.ts`.
- Whether to pass `hasPersistedBaseline` as prop vs derive inside App from `loadBaselineRaw` cache.
- Banner placement (stack below camera error vs single combined device-permissions banner).
- Minor crosshair sizing within existing Tailwind tokens.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — CAM-01, CAM-02, CAM-03, CAM-07 (Phase 3 scope)
- `.planning/ROADMAP.md` — Phase 3 goal and four success criteria
- `.planning/PROJECT.md` — Ghost overlay and level gauge listed as existing brownfield features to harden

### Prior Phase Context
- `.planning/phases/01-next-js-migration-capture-foundation/01-CONTEXT.md` — Demo-first default (D-10), camera error inline banner pattern (D-07/D-08)
- `.planning/phases/02-multi-shelf-data-layer/02-CONTEXT.md` — Per-shelf baseline via `objectUrlRegistry`, `loadBaselineRaw`, empty shelves start without persisted baseline (D-10)

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — CameraView, useDeviceOrientation, useCameraStream responsibilities
- `.planning/codebase/CONCERNS.md` — iOS orientation permission gap, device orientation fragile area
- `.planning/codebase/STACK.md` — Browser DeviceOrientation API, MediaDevices getUserMedia

### Implementation Targets
- `src/hooks/useDeviceOrientation.ts` — Add iOS permission flow, export permission state
- `src/hooks/useCameraStream.ts` — Chain orientation request after getUserMedia on enable-camera gesture
- `src/components/CameraView.tsx` — Ghost visibility rules, slider hide, orientation banner
- `src/App.tsx` — Pass `hasPersistedBaseline`, wire orientation permission + banner handlers
- `src/lib/constants.ts` — I18N for orientation permission denied / retry copy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/components/CameraView.tsx`** — Ghost overlay (mix-blend-screen), right-edge vertical opacity slider (0–100, default 45), center crosshair level gauge with mint-green snap styling, demo vs video feed toggle already wired.
- **`src/hooks/useDeviceOrientation.ts`** — Gamma tilt ±1.5° level detection, haptic on snap, `setSimulatedTilt` for desktop QA, `hasSensor` flag — **missing iOS `requestPermission()` flow**.
- **`src/hooks/useCameraStream.ts`** — Rear camera getUserMedia, demo capture fix (CAM-09), `isUsingDemoFeed` default true.
- **`src/App.tsx`** — `ghostOpacity` state (default 45), shelf-scoped `baseline` via `loadShelfData` + `objectUrlRegistry`, `useDeviceOrientation()` wired to CameraView.

### Established Patterns
- **Inline banner on CameraView** for device errors (camera permission, quota) — orientation denied follows same pattern.
- **Global UI prefs in App state** — ghost opacity matches tolerance/language (not per-shelf).
- **I18N via `I18N[lang]`** in `constants.ts` — extend for orientation strings.
- **Integration tests mock `useDeviceOrientation`** — extend mocks for permission states.

### Integration Points
- **`toggleDemoMode` → `startCamera`** — insertion point for orientation permission request after getUserMedia success.
- **`loadShelfData(shelfId)`** — determines whether shelf has persisted baseline (ghost eligibility).
- **`activeShelfId` change** — ghost source URL swaps via registry; must revoke old URLs on switch (Phase 2 pattern).

</code_context>

<specifics>
## Specific Ideas

- All four gray areas resolved with **recommended defaults** via `--auto` mode — no user overrides.
- Primary gap vs success criteria: **iOS orientation permission** (CAM-07) — only requirement not yet implemented; ghost/level UI exists but needs visibility rules hardened.
- Ghost hidden in demo mode is a **behavior fix** — current code double-renders baseline in demo feed + ghost layer.

</specifics>

<deferred>
## Deferred Ideas

- **PRD top bar** (baseline pill, level badge in header, torch + language) — Phase 5 (CAM-04).
- **Breathing shutter + 0.8s scan line** — Phase 5 (CAM-05/06).
- **INITIAL_GUIDE when shelf has no baseline** — Phase 5 (SHLF-05); Phase 3 hides ghost instead.
- **Persist ghost opacity to IndexedDB** — not required; global ephemeral state sufficient for v1.
- **Homography / advanced alignment beyond ghost overlay** — v2 (VIS-07).

</deferred>

---

*Phase: 3-Guided Capture Quality*
*Context gathered: 2026-09-22*
