---
phase: quick-261014-tol
plan: 1
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  - src/components/ResultInspectView.tsx
  - src/components/ResultInspectView.zoom.test.tsx
  - src/index.css
  - src/hooks/usePinchPanZoom.ts
  - src/hooks/usePinchPanZoom.test.ts
  - src/hooks/useLayoutViewportLock.test.ts
  - .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs
  - .cursor/skills/verify-shelfguard/SKILL.md
  - .cursor/skills/verify-shelfguard/features/inspect-scan.md
  - .cursor/skills/verify-shelfguard/features/inspect-scan-cross-platform.md
estimate:
  tokens: 28000
  raw_tokens: 28000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "On Android Chrome (and Playwright Chromium Android profiles) a two-finger pinch of the inspection comparison image paints over the phone, not inside the original frame"
    - "At rest the frame stays mx-auto / aspect-ratio sized with no fullscreen overlay or expand control"
    - "iPhone WebKit portrait and landscape still pass; blink-compare, no flicker, no rotate white strip, centering still hold"
  artifacts:
    - src/components/ResultInspectView.tsx
    - src/index.css
    - src/hooks/usePinchPanZoom.ts
    - src/components/ResultInspectView.zoom.test.tsx
    - .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs
  key_links:
    - "inspect-image-viewport is always overflow-visible + contain:none (never a clip/scrollport on the transform ancestor)"
    - "inspect-image-zoom-layer scales without will-change-transform layer promotion"
    - "setInspectZoomed(true) runs synchronously on two-finger start so useLayoutViewportLock cannot re-apply overflow-x lock during the pinch"
    - "assertUnclippedWholeScreenZoom treats auto/scroll as clippers, rejects contain:paint on the viewport, and elementFromPoint outside the original frame hits the comparison image"
---

<objective>
On real Android Chrome, two-finger pinch of the inspection-results comparison image must grow over the whole screen instead of staying clipped to the image frame. 261012-qce toggled overflow after scale crossed 1.01; Playwright getBoundingClientRect passed while Blink-on-Android keeps a baked compositor clip. Fix that compositor clip, set data-inspect-zoomed on pinch start, and close the harness hole that treated only hidden/clip as clippers.

Purpose: iPhone already paints over the screen; Android Chrome users still see a framed crop.
Output: unclipped inline pinch on Android Chrome; tighter verify-shelfguard asserts; artifacts under /opt/cursor/artifacts/; branch pushed. Orchestrator opens the PR — executor must not open or merge it.
</objective>

<execution_context>
Stay on branch cursor/android-pinch-zoom-clip-49b1 (already checked out from origin/main). Do not switch, create, or rename branches.
Commit production/test/harness code atomically per task. Do not commit PLAN.md, SUMMARY.md, or STATE.md.
Do not reintroduce a comparison fullscreen overlay or expand control (removed in 261012-of5).
Leave InspectShelfCanvas overflow as-is — that node is inside the transformed layer and clips AR boxes to the photo, not the photo to the frame.
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261012-qce-restore-whole-screen-results-pinch-zoom-/261012-qce-SUMMARY.md
@src/components/ResultInspectView.tsx
@src/hooks/useLayoutViewportLock.ts
@src/hooks/usePinchPanZoom.ts
@src/index.css
@src/components/InspectShelfCanvas.tsx
@src/components/ResultInspectView.zoom.test.tsx
@.cursor/skills/verify-shelfguard/SKILL.md
@.cursor/skills/verify-shelfguard/features/inspect-scan.md
@.cursor/skills/verify-shelfguard/features/inspect-scan-cross-platform.md
@.cursor/android-emulator.md
@.cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Never clip the inspect transform ancestor</name>
  <files>src/index.css, src/components/ResultInspectView.tsx, src/components/ResultInspectView.zoom.test.tsx</files>
  <read_first>src/components/ResultInspectView.tsx, src/index.css, src/components/ResultInspectView.zoom.test.tsx, src/components/InspectShelfCanvas.tsx</read_first>
  <behavior>
    - At rest, inspect-image-viewport computed overflow is visible on both axes and contain is none; class list still includes mx-auto; no inspect-image-fullscreen node
    - After a two-finger pinch that raises data-zoom-scale above 1, inspect-image-viewport still has overflow visible, gains z-[60], and inspect-image-zoom-layer has no will-change-transform class
    - inspect-shelf-canvas keeps its existing inner overflow (AR boxes stay inside the photo)
  </behavior>
  <action>
    Primary Android Chrome mechanism (investigation finding 3): inspect-image-viewport currently starts as a clipper and is the parent of inspect-image-zoom-layer, which uses will-change-transform plus a CSS scale. Toggling overflow after compositing does not update Blink-on-Android's baked clip rect, so the photo still paints inside the frame. Desktop and emulated Chromium update the clip, which is why Pixel 7 / Galaxy S9+ Playwright passed.

    In src/index.css, on [data-testid="inspect-image-viewport"], set overflow: visible and contain: none from first paint (not after a scale commit). Keep the existing touch-action: none and callout disables.

    In ResultInspectView, drop the isZoomed ternary that switches overflow on inspect-image-viewport. That node always uses overflow-visible. Keep z-[60] only while isZoomed. Keep mx-auto, frameBoxStyle, and touch-none. Do not add a new overlay, dialog, or expand control; at rest the frame stays aspect-ratio sized.

    On inspect-image-zoom-layer, remove will-change-transform so the scale transform does not promote a compositor layer that bakes a parent clip. Keep h-full w-full and the existing translate/scale style from usePinchPanZoom.

    Rewrite the rest-vs-zoomed class test in ResultInspectView.zoom.test.tsx: at rest expect overflow-visible (not a clip/scrollport) and no z-[60]; after pinch expect overflow-visible plus z-[60]; zoom layer className must not include will-change-transform. Existing no-overlay, mx-auto, blink-at-same-zoom, and hint tests must still pass.

    Do not change InspectShelfCanvas. Do not change html/body overflow rules in this task (task 2).
  </action>
  <verify>
    <automated>npm --prefix /workspace test -- src/components/ResultInspectView.zoom.test.tsx</automated>
  </verify>
  <done>inspect-image-viewport is overflow-visible with contain none at rest and while zoomed; z-[60] only while zoomed; zoom layer is not will-change promoted; no fullscreen overlay; mx-auto frame at rest.</done>
</task>

<task type="auto" tdd="true">
  <name>Set data-inspect-zoomed on two-finger start</name>
  <files>src/hooks/usePinchPanZoom.ts, src/hooks/usePinchPanZoom.test.ts, src/components/ResultInspectView.tsx, src/hooks/useLayoutViewportLock.test.ts</files>
  <read_first>src/hooks/usePinchPanZoom.ts, src/hooks/useLayoutViewportLock.ts, src/components/ResultInspectView.tsx, src/hooks/usePinchPanZoom.test.ts, src/hooks/useLayoutViewportLock.test.ts</read_first>
  <behavior>
    - Touch path: onTouchStart with two touches calls setInspectZoomed(true) synchronously before scale updates; documentElement data-inspect-zoomed is true while visualViewport resize/scroll handlers run
    - Pointer path: when two pointers are down (mouse/pen, or touch on engines without TouchEvent), the same attr is set on pinch start
    - After fingers lift with scale still 1, the attr is cleared; after fingers lift with scale greater than 1.01, the attr stays true until scale returns to 1
    - useLayoutViewportLock visualViewport/orientation handlers must not write overflowX hidden on html/body/#root while the attr is true
  </behavior>
  <action>
    Secondary mechanism (investigation finding 4): isZoomed (and therefore data-inspect-zoomed) is derived from transform.scale greater than 1.01 after a React commit. Android Chrome visualViewport resize/scroll from the pinch can re-run lockHorizontalViewport before the attr exists and re-apply overflow-x hidden. CSS 2.1 then computes the other axis to auto, creating a scrollport that clips both axes. Pointer pinch is a no-op for pointerType=touch when window.TouchEvent exists, so the touch path must set the attr.

    In usePinchPanZoom, when entering pinch (reanchorPinch on two touches, and reanchorPointerPinch on two pointers), call setInspectZoomed(true) synchronously in the event handler before setTransform. Export isPinching (true while gesture mode is pinch or two contacts are down). ResultInspectView must compute isZoomed as transform.scale greater than 1.01 OR isPinching, and keep the existing useLayoutEffect that syncs setInspectZoomed(isZoomed) and clears on unmount.

    On last-finger/last-pointer up: isPinching becomes false; if scale is still 1, the layout effect clears the attr; if scale remains above 1.01, the attr stays. Do not wait for scale to cross 1.01 before the first attr write.

    Add hook tests: two-finger touchstart sets the documentElement attr to true at scale 1; two mouse pointers do the same; reset/end at scale 1 clears it. Extend useLayoutViewportLock.test.ts: after setInspectZoomed(true), dispatch visualViewport scroll and resize (fallback to window resize if visualViewport is missing in jsdom) and assert html overflowX stays visible.

    Do not re-clip inspect-image-viewport. Do not change InspectShelfCanvas.
  </action>
  <verify>
    <automated>npm --prefix /workspace test -- src/hooks/usePinchPanZoom.test.ts src/hooks/useLayoutViewportLock.test.ts src/components/ResultInspectView.zoom.test.tsx</automated>
  </verify>
  <done>Two-finger start sets data-inspect-zoomed before scale changes; viewport lock cannot re-apply overflow-x hidden during that gesture; attr still tracks scale after fingers lift.</done>
</task>

<task type="auto">
  <name>Close harness hole and prove Android plus iPhone</name>
  <files>.cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs, .cursor/skills/verify-shelfguard/SKILL.md, .cursor/skills/verify-shelfguard/features/inspect-scan.md, .cursor/skills/verify-shelfguard/features/inspect-scan-cross-platform.md</files>
  <read_first>.cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs, .cursor/skills/verify-shelfguard/SKILL.md, .cursor/skills/verify-shelfguard/features/inspect-scan.md, .cursor/skills/verify-shelfguard/features/inspect-scan-cross-platform.md, .cursor/android-emulator.md</read_first>
  <action>
    Playwright previously passed because getBoundingClientRect grows with CSS transforms even when an ancestor still paints with a compositor clip, and because assertUnclippedWholeScreenZoom only treated overflow hidden/clip as clippers — not auto/scroll (investigation findings 1–2). Real Android users see pixels, not the transformed border box.

    In assertUnclippedWholeScreenZoom, treat computed overflow/overflow-x/overflow-y values auto and scroll as clippers in addition to hidden and clip. Assert getComputedStyle(inspect-image-viewport).contain does not include paint. After pinch to ~2.75, pick a client point that is outside the original frame rect captured before the pinch and inside the transformed inspect-image-zoom-layer rect; document.elementFromPoint at that location must hit inspect-comparison-image (or inspect-shelf-canvas / inspect-image-zoom-layer), not header, chips, hold strip, or the page background. Write the hit target, contain, and clip list into inspect-scan-zoom-overflow.txt (and the cross-platform report). Keep short-axis cover ≥90%, scale ~2.75, beyond-frame geometry, blink-compare, flicker, centering, and rotate-offset asserts.

    Update inspect-scan.md: at rest the frame is mx-auto with overflow visible (clip is unnecessary because the photo already fits); while zoomed, elementFromPoint outside the original frame hits the photo. Update inspect-scan-cross-platform.md the same way. Update SKILL.md evidence table for the new overflow.txt fields.

    Then verify:
    1. npm --prefix /workspace test && npm --prefix /workspace run lint
    2. Follow .cursor/skills/verify-shelfguard/SKILL.md: install Playwright chromium+webkit if needed; launch-verify-server.sh; doctor against http://127.0.0.1:4173.
    3. Drive inspect-scan and inspect-scan-cross-platform (iPhone 14 and iPhone 15 Pro Max WebKit, Pixel 7 and Galaxy S9+ Chromium, portrait and landscape). Artifacts under /opt/cursor/artifacts/verify-shelfguard/261014-tol/.
    4. Attempt real Android Chrome via .cursor/android-emulator.md: TCG fallback if nested KVM fails; adb reverse to :4173; unlock with adb shell input keyevent 82 and adb shell wm dismiss-keyguard; open the local preview in com.android.chrome; pinch the results image; screenshot. Mobile MCP may only write cwd or /tmp — copy shots into /opt/cursor/artifacts/android-chrome-pinch/. If TCG drops focus or Chrome first-run blocks the pinch, record the attempt (devices, boot flags, last screenshot, failure) in that artifacts dir; Playwright drives must still pass.

    Push branch cursor/android-pinch-zoom-clip-49b1. Do not open a PR and do not merge. Do not kill processes by name; stop only the preview PID you started.
  </action>
  <verify>
    <automated>npm --prefix /workspace test && npm --prefix /workspace run lint && .cursor/skills/verify-shelfguard/bin/launch-verify-server.sh && node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs doctor --url http://127.0.0.1:4173 --pid-file /tmp/shelfguard-verify.pid && node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive inspect-scan --url http://127.0.0.1:4173 --artifacts-dir /opt/cursor/artifacts/verify-shelfguard/261014-tol/inspect-scan && node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive inspect-scan-cross-platform --url http://127.0.0.1:4173 --artifacts-dir /opt/cursor/artifacts/verify-shelfguard/261014-tol/inspect-scan-cross-platform</automated>
  </verify>
  <done>Harness fails if auto/scroll clips or elementFromPoint outside the original frame misses the photo; inspect-scan and inspect-scan-cross-platform pass on Android Chromium and iPhone WebKit (portrait+landscape); emulator attempt is recorded; unit tests and tsc clean; branch pushed; no PR opened.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| touch/pointer → inspect-image-viewport | Untrusted gesture input on a client-only PWA |
| CSS overflow lift html/body/#root | Zoomed paint is allowed over chrome; must restore lock at scale 1 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261014-01 | Elevation of privilege | inspect-image-viewport overflow visible | low | accept | Local UI only; photo already fits the frame at rest; z-[60] is visual stacking, not a new origin |
| T-261014-02 | Denial of service | html overflow visible while zoomed | medium | mitigate | setInspectZoomed(false) on unmount and when scale returns to 1; lockHorizontalViewport restores overflow-x |
| T-261014-SC | Tampering | npm/pip/cargo installs | low | accept | No new package.json dependencies; Playwright browser install is the existing verify-shelfguard toolchain |
</threat_model>

<verification>
Unit tests for ResultInspectView pinch, usePinchPanZoom pinch-start attr, and useLayoutViewportLock skip-while-zoomed. tsc --noEmit. verify-shelfguard inspect-scan plus inspect-scan-cross-platform. Best-effort real Android Chrome via emulator + adb/Chrome. Artifacts under /opt/cursor/artifacts/.
</verification>

<success_criteria>
- Android Chrome pinch of the comparison image covers the phone, not the original frame
- Viewport node is overflow-visible + contain:none from first paint; zoom layer is not will-change promoted
- data-inspect-zoomed is true from two-finger start
- Harness uses elementFromPoint plus auto/scroll clip detection
- iPhone WebKit portrait and landscape still pass
- No fullscreen overlay; blink-compare / flicker / rotate / centering unchanged
- Branch pushed; PR is orchestrator-owned
</success_criteria>

<output>
Create `.planning/quick/261014-tol-fix-android-chrome-pinch-zoom-on-inspect/261014-tol-SUMMARY.md` when done (orchestrator commits docs).
</output>
