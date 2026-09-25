# Quick Task: Replace weak camera capture with a mature open-source library - Research

**Researched:** 2026-09-25
**Domain:** Browser `getUserMedia`/`MediaTrackConstraints`/`ImageCapture` camera control in a client-only PWA (Vite + React 19 + TS, Vercel-hosted)
**Confidence:** MEDIUM-HIGH (the feasibility ceiling is well documented by the W3C spec repo; library maturity is verified via registry/GitHub; the "which library is best" recommendation is the part with genuine judgment)

## Summary

The premise "find a mature GitHub library that gives us real focus/autofocus/lens-switching/zoom" runs into a hard platform ceiling before any library choice matters: **these are not JS-library problems, they are browser/OS API exposure problems.** No JavaScript library — however mature — can expose a capability the browser doesn't put on `MediaStreamTrack.getCapabilities()`. Verified against the W3C `mediacapture-image` spec's own cross-browser implementation-status tracker `[CITED: github.com/w3c/mediacapture-image/implementation-status.md]`:

- **`focusMode` / `focusDistance`** (manual/tap-to-focus): Chrome on **Android only** (plus Chrome desktop on Linux/ChromeOS/Windows/Mac 76+, which is moot for a phone-camera PWA). **Not implemented in Safari at all** — no iOS Safari support, full stop, and iOS Safari is also the engine behind every other iOS browser (Chrome-on-iOS, Firefox-on-iOS all wrap WebKit).
- **`zoom`**: Android, Linux/ChromeOS, Windows, and Mac (60+) — reasonably broad, this is what the project's current zoom-preset feature already correctly relies on.
- **`torch`**: Android + Linux/ChromeOS only. No Mac/Windows/Safari.
- **Lens switching** (wide/ultra-wide/tele on multi-camera phones): there is **no standardized web API** for selecting a specific physical lens. `facingMode` only distinguishes front vs. back; some Android/Chrome devices multiplex multiple back lenses under a single "environment" video track and let `zoom` implicitly trigger a lens crossover internally, but this is a device/driver implementation detail, not something any JS library can control directly.

**This means: on iOS (Safari/WebKit, all iOS browsers), a pure-PWA cannot get manual focus, focus distance, torch, or lens selection through any web API or library — the OS only offers continuous autofocus with zero JS override.** This is a platform ceiling, confirmed by the spec's own implementation matrix, not a library gap.

Given that ceiling, the three "mature open-source camera library" candidates that exist for the browser (`react-webcam`, `react-camera-pro`, `react-html5-camera-photo`) were all evaluated and **none of them add any focus/zoom/torch/lens capability beyond raw `getUserMedia`/`ImageCapture`** — they are convenience wrappers around video-element mounting + canvas snapshot + front/back toggle. The project's existing `useCameraStream.ts` **already implements the more advanced pieces** (zoom-capability detection + presets, torch toggle, `ImageCapture.takePhoto()` with a canvas fallback, black-frame detection) that these libraries don't even attempt. Swapping to one of them would be a **downgrade** in capability, only buying marginally better cross-device video-mount edge-case handling.

The one library that *does* offer native-level focus/lens/zoom control — `@capacitor-community/camera-preview` — requires wrapping the app in a **Capacitor native shell** (Android/iOS builds), which is explicitly **out of scope** per this project's own `PROJECT.md` ("原生 iOS/Android 应用 — PWA 优先，应用商店分发不在 v1").

**Primary recommendation:** Do **not** adopt a third-party camera capture library. Keep and **harden the existing `useCameraStream.ts`/`CameraView.tsx`** implementation — it already uses the correct, most-capable APIs (`ImageCapture`, capability-gated zoom/torch). Close the actual gaps: (1) add capability-gated `focusMode: 'continuous'`/tap-to-focus support for Android Chrome where `focusDistance` exists (graceful no-op elsewhere, matching the existing `hasTorch`/`hasZoom` pattern), and (2) explicitly document/accept that iOS gets continuous-AF-only with no manual override, no torch control beyond what already degrades gracefully, and no lens selection. If true manual focus/multi-lens control is a hard product requirement, the only path is a native shell (Capacitor + `@capacitor-community/camera-preview` or `@capgo/camera-preview`) — which is a scope/architecture decision, not a "swap a library" fix.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Camera stream acquisition (`getUserMedia`) | Browser / Client | — | Must run in the client; no server involved in a pure PWA |
| Focus / zoom / torch capability detection & control | Browser / Client | — | `MediaStreamTrack.getCapabilities()`/`applyConstraints()` are client-only APIs; no library can move this to another tier |
| Frame capture to still image | Browser / Client | — | `ImageCapture.takePhoto()` / canvas `drawImage` + `toDataURL`, already implemented client-side |
| Captured image persistence | Database / Storage (IndexedDB via `idb-keyval`) | — | Existing pattern per PROJECT.md; unaffected by this research |
| True manual focus / multi-lens selection (if required) | Native shell (Capacitor) | Browser / Client (degraded) | Not exposed to web engines on iOS; only a native wrapper reaches OS camera APIs directly |

## Standard Stack

### Core (recommendation: no new dependency)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| *(none — keep custom hook)* | — | Camera stream + capture | No web library adds capability the browser doesn't already expose via the native `getUserMedia`/`ImageCapture` APIs the project already calls directly |

### Supporting (only if project later adopts a native shell — NOT recommended for this task)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@capacitor-community/camera-preview` | 8.0.2 [VERIFIED: npm registry] | Native camera preview w/ tap-to-focus, zoom, front/back switch | Only if project adds a Capacitor native shell (out of current scope) |
| `@capgo/camera-preview` | — (community fork) [ASSUMED — not independently verified this session] | Same as above, adds `setFocus(x,y)`/`setZoom()` with finer control | Same native-shell precondition |

### Alternatives Considered (and rejected)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `useCameraStream.ts` hook | `react-webcam` 7.2.0 [VERIFIED: npm registry] | Simpler mount/video-ref boilerplate, but **no** focus/zoom/torch API at all — you'd still hand-write capability detection on top of it; last published 2023-10-25 [VERIFIED: npm registry], i.e. ~3 years stale relative to today |
| Custom `useCameraStream.ts` hook | `react-camera-pro` 1.4.0 [VERIFIED: npm registry] | Adds `switchCamera()`/`getNumberOfCameras()` convenience only [CITED: github.com/purple-technology/react-camera-pro]; no torch/zoom/focus; last published 2024-05-30 [VERIFIED: npm registry] |
| Custom `useCameraStream.ts` hook | `react-html5-camera-photo` 1.5.11 [VERIFIED: npm registry] | Oldest/least maintained of the three; last published 2022-11-13 [VERIFIED: npm registry]; narrowest feature set (still-photo only) |
| Pure PWA | `@capacitor-community/camera-preview` (native shell) | Only route to true hardware AF/lens control; requires abandoning "PWA-only, no app store" constraint from PROJECT.md |

**Installation:** None required — recommendation is to keep the existing implementation and extend it in place.

**Version verification:** All four candidate npm packages confirmed to exist and current versions retrieved via `npm view <pkg> version time.modified` on 2026-09-25:
- `react-webcam` 7.2.0, published 2023-10-25 [VERIFIED: npm registry]
- `react-camera-pro` 1.4.0, published 2024-05-30 [VERIFIED: npm registry]
- `react-html5-camera-photo` 1.5.11, published 2022-11-13 [VERIFIED: npm registry]
- `@capacitor-community/camera-preview` 8.0.2, published 2026-09-25 [VERIFIED: npm registry] (major-version bump published same day as this research — repository itself is long-established, see audit below)

## Package Legitimacy Audit

| Package | Registry | Age (repo) | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `react-webcam` | npm | est. 8+ yrs (repo), last publish 2023 | 434,481/wk [VERIFIED: npm registry] | github.com/mozmorris/react-webcam (1,751 ★, pushed 2026-03-10) [VERIFIED: GitHub API] | OK | Not recommended (no capability gain) |
| `react-camera-pro` | npm | est. 4+ yrs (repo) | 16,121/wk [VERIFIED: npm registry] | github.com/purple-technology/react-camera-pro (232 ★, pushed 2024-05-30) [VERIFIED: GitHub API] | OK | Not recommended (no capability gain) |
| `react-html5-camera-photo` | npm | est. 8+ yrs (repo) | 20,948/wk [VERIFIED: npm registry] | github.com/mabelanger/react-html5-camera-photo (219 ★, pushed 2024-10-29) [VERIFIED: GitHub API] | OK | Not recommended (stalest, narrowest feature set) |
| `@capacitor-community/camera-preview` | npm | est. 8+ yrs (repo) | 27,252/wk [VERIFIED: npm registry] | github.com/capacitor-community/camera-preview (228 ★, pushed 2026-09-25) [VERIFIED: GitHub API] | **SUS** ("too-new" — flagged by the legitimacy seam purely on today's publish timestamp of v8.0.2; the underlying repository is long-established with 228 ★ and active history, so this reads as a routine major-version release rather than a slopsquat signal, but flagging is preserved per protocol) | Not applicable to current scope (requires native shell); if pursued later, gate the install behind `checkpoint:human-verify` |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `@capacitor-community/camera-preview` — flagged by the legitimacy seam solely due to today's publish date; not currently recommended for installation in this PWA-only project regardless, so no checkpoint is needed unless a future phase revisits the native-shell path.

## Architecture Patterns

### Current data flow (verified by reading source this session)

```
User taps shutter (CameraView.tsx: handleShutterClick)
        |
        v
useCameraStream().captureFrame()  [VERIFIED: src/hooks/useCameraStream.ts:312-323]
        |
        +--> captureVideoFrame(video, stream)
        |         |
        |         +--> captureWithImageCapture(track)   -- tries ImageCapture.takePhoto() first
        |         |         (native hi-res still capture, bypasses video element entirely)
        |         |
        |         +--> [fallback] waitForVideoReady() + drawVideoToCanvas()
        |                   (canvas.drawImage from <video>, JPEG data URL, black-frame guard)
        |
        v
JPEG data URL returned to App-level capture/compare pipeline
```

Zoom/torch control flow: `track.getCapabilities()` gates `hasZoom`/`hasTorch` state on stream start `[VERIFIED: src/hooks/useCameraStream.ts:196-224]`; `setZoomLevel`/`toggleTorch` call `track.applyConstraints({ advanced: [...] })` only when the capability was detected present `[VERIFIED: src/hooks/useCameraStream.ts:254-288]` — this capability-gating pattern is exactly right and should be extended (not replaced) for focus.

### Recommended Project Structure
No structural change needed — extend in place:
```
src/hooks/
├── useCameraStream.ts     # add focusMode/focusDistance capability detection + setFocus(), mirroring existing zoom pattern
src/components/
├── CameraView.tsx         # add optional tap-to-focus UI, gated on hasFocus (new prop), mirroring hasZoom/hasTorch pattern
```

### Pattern 1: Capability-gated constraint control (already in use — extend it)
**What:** Detect a `MediaTrackCapabilities` key before exposing any UI control for it; apply via `track.applyConstraints({ advanced: [...] })`; never assume a capability exists.
**When to use:** Any `MediaTrackConstraints`-based control (zoom, torch, focus) in a cross-device PWA.
**Example (existing code, read this session):**
```typescript
// Source: src/hooks/useCameraStream.ts:196-218 (verbatim, project's own pattern)
const capabilities = (track.getCapabilities?.() || {}) as Record<string, unknown> & {
  zoom?: { min?: number; max?: number; step?: number };
};
setHasTorch('torch' in capabilities);

if (
  capabilities.zoom &&
  typeof capabilities.zoom.min === 'number' &&
  typeof capabilities.zoom.max === 'number'
) {
  const presets = computeZoomPresets(capabilities.zoom.min, capabilities.zoom.max, capabilities.zoom.step);
  setZoomLevels(presets);
  setHasZoom(true);
  setCurrentZoom(presets[0]);
}
```
**Extension for focus (new, following the same pattern):**
```typescript
// New code — mirrors the zoom pattern above
const caps = track.getCapabilities?.() as MediaTrackCapabilities & {
  focusMode?: string[];
  focusDistance?: { min: number; max: number; step?: number };
};
const supportsTapToFocus = Array.isArray(caps.focusMode) && caps.focusMode.includes('manual');
setHasFocus(supportsTapToFocus); // false on iOS Safari — capability simply absent, UI hides itself
```

### Anti-Patterns to Avoid
- **Assuming `ImageCapture`/focus/zoom exist without a capability check:** calling `applyConstraints({ advanced: [{ focusDistance: x }] })` on a track that doesn't support it either silently no-ops or throws `OverconstrainedError` depending on browser — always gate on `getCapabilities()` first, exactly as the existing code already does for zoom/torch.
- **Swapping to a generic camera library expecting it to add hardware control:** none of the evaluated libraries touch focus/lens capabilities; they only wrap what `getUserMedia` already gives you, so migrating is pure churn risk (losing the project's already-correct `ImageCapture`-first capture path and black-frame guard) for zero capability gain.
- **Treating "device has 3 lenses" as web-controllable:** even where a phone's `environment`-facing track transparently switches lenses as `zoom` increases (an OS/driver behavior on some Android devices), there is no JS API to pick "ultra-wide" vs "tele" directly — don't design UI around explicit lens names, only around the zoom range the browser exposes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting whether a MediaStreamTrack supports a given constraint | A hardcoded per-browser/per-device capability table | `track.getCapabilities()` + presence checks (already implemented) | Capabilities are queryable at runtime; a hardcoded table goes stale and misses device variance |
| Still-frame capture from a live stream | Manual `requestAnimationFrame` + canvas polling from scratch | `ImageCapture.takePhoto()` first, canvas `drawImage` fallback (already implemented) | `ImageCapture` gets the sensor's native still-capture pipeline (often higher quality than a video frame grab) where supported; the project already does this correctly |
| Real hardware autofocus/lens control on iOS | A JS/WASM "autofocus" shim or heuristic sharpness-based refocus loop | Accept the platform ceiling; if truly required, native shell (Capacitor) | No amount of client JS can drive the iOS camera's physical focus motor — WebKit does not expose it, and there is no legitimate way to reach it from a web page |

**Key insight:** The perceived weakness in the current capture flow is very unlikely to be "the library is wrong" — it's more likely one of: (a) users on iOS where focus/torch/lens control genuinely cannot be improved from the web layer, (b) the existing capability-gating not yet extended to `focusMode`, or (c) a UX issue (e.g., users not realizing continuous AF needs a moment to settle before shutter). Before any code change, get a concrete failure report (device + OS + browser) to confirm which bucket it falls into.

## Common Pitfalls

### Pitfall 1: Believing "zoom" on iOS means "lens switching"
**What goes wrong:** Team assumes setting a zoom constraint lets them pick a specific physical lens (wide/ultra-wide/tele) on an iPhone.
**Why it happens:** Native iOS Camera app does lens-switching at certain zoom thresholds, creating an expectation that the web `zoom` constraint does the same.
**How to avoid:** Treat `zoom` purely as a numeric range from `getCapabilities().zoom`; do not build UI copy or logic implying explicit lens selection on the web.
**Warning signs:** Zoom presets that don't visibly change field-of-view the way the native camera app does at the same numbers — expected, not a bug.

### Pitfall 2: `OverconstrainedError` from applying an unsupported advanced constraint
**What goes wrong:** Calling `applyConstraints({ advanced: [{ focusMode: 'manual' }] })` on a browser/device where `focusMode` isn't in `getCapabilities()` throws or silently fails depending on engine.
**Why it happens:** The Media Capture spec's "advanced" constraint list has inconsistent enforcement across engines.
**How to avoid:** Always gate behind a capability check (see Pattern 1) and wrap `applyConstraints` calls in try/catch — the existing `toggleTorch`/`setZoomLevel` implementations already do this correctly; replicate for any new focus control.
**Warning signs:** Console warnings like the existing `console.warn('Zoom constraint failed:', e)` pattern firing unexpectedly on a specific device.

### Pitfall 3: Expecting a "mature GitHub library" to paper over a spec-level gap
**What goes wrong:** Time spent evaluating/integrating a third-party camera library under the assumption it must have solved focus/lens control since it's popular.
**Why it happens:** High star counts and download numbers create an impression of comprehensive capability; in reality these libraries solve *video-mounting and cross-device quirks*, not *capability exposure*, which is bounded by the browser engine, not the library.
**How to avoid:** Check the library's actual exposed API surface (props/ref methods) against the spec's capability list before assuming it adds anything; in this case, none of the three general-purpose React camera libraries expose `focusMode`/`focusDistance`/lens selection at all.
**Warning signs:** Library README doesn't mention `getCapabilities()`, `focusMode`, or `applyConstraints` anywhere.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `video.pause()` + canvas `drawImage` only | `ImageCapture.takePhoto()` first (native still-capture), canvas fallback | Chrome 59+ (ImageCapture landed ~2017); project already adopted this | Better quality stills where supported, graceful fallback elsewhere — already implemented, no action needed |

**Deprecated/outdated:** None identified as in-use by this project that need replacing.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@capgo/camera-preview`'s exact current version/maintenance status | Standard Stack (Supporting) | Low — this package is not recommended for the current PWA-only scope; only relevant if the project later pivots to a native shell, at which point it must be re-verified before use |
| A2 | Package names `react-webcam`, `react-camera-pro`, `react-html5-camera-photo`, `@capacitor-community/camera-preview` were surfaced via WebSearch/training knowledge before registry confirmation | Standard Stack, Package Legitimacy Audit | Low — all four independently confirmed to exist via direct `npm view` and GitHub API calls this session, and all resolve to real, long-running open-source repos with substantial star/download counts; no slopsquat indicators found |

**If this table is empty:** N/A — see above.

## Open Questions

1. **What specific "weak" behavior prompted this task?**
   - What we know: Current implementation already does capability-gated zoom + torch + `ImageCapture`-first capture with a canvas fallback and black-frame retry loop — objectively more robust than any of the three general-purpose libraries evaluated.
   - What's unclear: Whether "too weak" refers to (a) missing focus control on Android where it's actually achievable, (b) iOS focus/lens limitations that are a platform ceiling, (c) capture reliability/lag bugs, or (d) something UX-related (e.g., shutter feedback, framing guides).
   - Recommendation: Before planning implementation, get 1-2 concrete repro reports (device model + OS + browser) of what "fails" today. If it's (a), the fix is a small, low-risk extension of the existing capability-gating pattern (see Architecture Patterns). If it's (b), the fix is a documented platform limitation + UX copy, not a library swap. If it's (c) or (d), the fix is unrelated to library choice entirely.

2. **Is a native shell (Capacitor) actually on the table?**
   - What we know: PROJECT.md explicitly scopes this as PWA-only, no app-store distribution, for v1.
   - What's unclear: Whether this constraint is truly fixed or could be revisited if hardware-level focus/lens control turns out to be a hard requirement.
   - Recommendation: If real product need for manual focus/lens selection emerges, escalate as a scope/architecture decision (not a quick-task library swap) before any Capacitor work begins.

## Sources

### Primary (HIGH/MEDIUM confidence)
- W3C `mediacapture-image` implementation-status.md (github.com/w3c/mediacapture-image) — cross-browser focusMode/focusDistance/zoom/torch support matrix [CITED: github.com/w3c/mediacapture-image/implementation-status.md]
- npm registry (`npm view <pkg> version time.modified`) for `react-webcam`, `react-camera-pro`, `react-html5-camera-photo`, `@capacitor-community/camera-preview` [VERIFIED: npm registry]
- GitHub REST API (`api.github.com/repos/...`) for stars/pushed_at/open_issues on all four candidate repos [VERIFIED: GitHub API]
- `capacitor-community/camera-preview` README (github.com) — confirms "web is not supported" for lens switching, tap-to-focus and zoom are native-only features [CITED: github.com/capacitor-community/camera-preview]
- `purple-technology/react-camera-pro` README (github.com) — confirms API surface (`takePhoto`, `switchCamera`, `getNumberOfCameras`), no torch/zoom/focus props [CITED: github.com/purple-technology/react-camera-pro]
- Project source read this session: `src/hooks/useCameraStream.ts`, `src/components/CameraView.tsx`, `package.json` [VERIFIED: local repo, read this session]

### Secondary (MEDIUM confidence)
- WebSearch aggregation corroborating focusMode Android-Chrome-only / iOS-Safari-none finding (Dynamsoft blog, MDN excerpts) — consistent with the W3C primary source above [CITED: aggregated web search]
- npmtrends.com download/comparison data for react-webcam vs react-html5-camera-photo [CITED: npmtrends.com]

### Tertiary (LOW confidence)
- None relied upon for load-bearing claims in this document.

## Metadata

**Confidence breakdown:**
- Feasibility ceiling (focus/lens/torch platform support): HIGH — corroborated by the W3C spec's own implementation tracker plus independent web search agreement
- Library maturity/legitimacy data: HIGH — all figures pulled via direct `npm view`/GitHub API calls this session, not training memory
- "No library adds capability" conclusion: HIGH — verified by reading each library's actual documented API surface, not inferred
- Recommendation to extend existing hook rather than swap: MEDIUM-HIGH — sound given the evidence, but the real root cause of "feels weak" is an open question (see Open Questions) pending a concrete repro

**Research date:** 2026-09-25
**Valid until:** ~2026-12-25 (browser capability support shifts slowly but not never; re-check W3C implementation-status.md if this task is revisited after a Safari/Chrome major version bump)
