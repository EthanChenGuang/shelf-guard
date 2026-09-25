---
type: feature
plan: 1
autonomous: true
files_modified:
  - src/hooks/useCameraStream.ts
  - src/hooks/useCameraStream.zoom.test.ts
  - src/components/CameraView.tsx
  - src/components/CameraView.zoom.test.tsx
  - src/App.tsx
  - src/lib/constants.ts
estimate:
  tokens: 42000
  raw_tokens: 42000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "On a device/browser whose camera track reports a `zoom` capability, the user sees exactly 4 tappable zoom-level buttons spanning the hardware's real min→max zoom range (widest to narrowest), and tapping one visibly applies it"
    - "On a device/browser whose camera track does NOT report a `zoom` capability, no zoom control renders at all — no empty row, no disabled buttons, no console spam"
    - "No fake wide-angle or CSS-transform/crop trick is used — only the real `MediaTrackConstraints` zoom capability range is exposed"
  artifacts:
    - src/hooks/useCameraStream.ts (hasZoom, zoomLevels, currentZoom state + setZoomLevel callback)
    - src/hooks/useCameraStream.zoom.test.ts (capability detection + preset math + applyConstraints coverage)
    - src/components/CameraView.tsx (conditional 4-button zoom row)
    - src/components/CameraView.zoom.test.tsx (render/interaction coverage for the new row)
    - src/lib/constants.ts (zoomLevel i18n string, cn + en)
  key_links:
    - "useCameraStream.startCamera(): track.getCapabilities().zoom -> computeZoomPresets(min,max,step) -> hasZoom/zoomLevels/currentZoom state -> App.tsx destructure -> CameraView props -> conditional button row -> onClick -> setZoomLevel(value) -> track.applyConstraints({advanced:[{zoom:value}]})"
---

<objective>
Add a 4-level zoom selector to the camera capture view, driven entirely by the real
`MediaTrackConstraints` `zoom` capability of the active camera track — 4 evenly-spaced preset
values from the hardware's reported min (widest available) to max (narrowest available). The
control must not render at all when the active track has no `zoom` capability.

Purpose: Users currently have no way to frame a shelf tighter or wider than the camera's default
field of view, which can hurt ROI alignment on shelves that are unusually close or far from the
device. This gives them 4 discrete, hardware-real options without ever faking an optical effect
the device can't actually produce.

Output: `useCameraStream` exposes `hasZoom`, `zoomLevels`, `currentZoom`, `setZoomLevel`;
`CameraView` renders a compact 4-button zoom row (highlighting the active preset) only when
`hasZoom` is true; `App.tsx` wires the two together; new bilingual (cn/en) label string in
`src/lib/constants.ts`; a dedicated hook test and a dedicated component test cover the new
behavior end to end.
</objective>

<execution_context>
@/home/guang/Projects/Experiments/image-comparation/.claude/gsd-core/workflows/execute-plan.md
@/home/guang/Projects/Experiments/image-comparation/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Existing torch-capability precedent to mirror exactly for zoom (same file, same shape):
# - `useCameraStream`'s `startCamera()` already does:
#     const capabilities = (track.getCapabilities?.() || {}) as Record<string, unknown>;
#     setHasTorch('torch' in capabilities);
#   Zoom detection follows the identical cast-and-check pattern, just reading a `zoom` key whose
#   value is `{min, max, step?}` instead of a boolean.
# - `toggleTorch()` already does: capability check -> `track.applyConstraints({advanced:[{torch:
#   nextState} as MediaTrackConstraintSet]})` inside try/catch, `console.warn` on failure, state
#   updated only on success. `setZoomLevel(value)` mirrors this exactly, swapping `torch` for
#   `zoom: value`.
# - `stopCamera()` already resets `hasTorch`/`isTorchOn` to false when the stream tears down —
#   `hasZoom`/`zoomLevels`/`currentZoom` must reset the same way (hasZoom->false,
#   zoomLevels->[], currentZoom->null).
# - CameraView's top-right glass-panel button cluster (torch + language toggle) uses this active
#   vs inactive styling pattern: active = `bg-sg-success text-white shadow-sm`, inactive =
#   `text-sg-primary hover:bg-sg-surface` (or `text-white/80 hover:bg-white/15` on dark overlays).
#   Mirror this exact active/inactive class split for the zoom buttons.

@src/hooks/useCameraStream.ts
@src/hooks/useCameraStream.torch.test.ts
@src/components/CameraView.tsx
@src/components/CameraView.topBar.test.tsx
@src/App.tsx
@src/lib/constants.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Zoom capability detection + setZoomLevel in useCameraStream</name>
  <files>src/hooks/useCameraStream.ts, src/hooks/useCameraStream.zoom.test.ts</files>
  <behavior>
    - Test: mocking `track.getCapabilities()` to return `{zoom: {min: 1, max: 4, step: 1}}`,
      after `startCamera()` resolves, `result.current.hasZoom` is `true` and
      `result.current.zoomLevels` deep-equals `[1, 2, 3, 4]` (4 evenly-spaced values across
      min→max, snapped to the given step) and `result.current.currentZoom` equals the first
      (widest) level, `1`.
    - Test: mocking `track.getCapabilities()` to return `{}` (no `zoom` key), after
      `startCamera()` resolves, `result.current.hasZoom` is `false`, `result.current.zoomLevels`
      is an empty array, and no error/throw occurs.
    - Test: with the `{min:1,max:4,step:1}` mock active and the stream started, calling
      `result.current.setZoomLevel(3)` causes the mocked `track.applyConstraints` to have been
      called with `{advanced: [{zoom: 3}]}`, and `result.current.currentZoom` becomes `3`.
    - Write `src/hooks/useCameraStream.zoom.test.ts` FIRST, following the exact mocking shape of
      `src/hooks/useCameraStream.torch.test.ts` (stub `navigator.mediaDevices.getUserMedia` to
      resolve a fake `MediaStream` whose `getVideoTracks()`/`getTracks()` return one fake track
      object with `getCapabilities`, `applyConstraints: vi.fn().mockResolvedValue(undefined)`,
      and `stop: vi.fn()`). Run it and confirm all 3 cases fail against the current
      implementation before writing the fix below.
  </behavior>
  <action>
    In `src/hooks/useCameraStream.ts`, add a top-level helper `computeZoomPresets(min: number,
    max: number, step?: number): number[]` placed alongside the other top-level helpers (near
    `isCanvasMostlyBlack`/`blobToDataUrl`, before the `useCameraStream` function). It returns 4
    values evenly spaced across `[min, max]` inclusive (`min + (max-min)*i/3` for `i` in
    `0..3`); when `step` is a positive number, snap each value to the nearest multiple of `step`
    from `min` and clamp the result back into `[min, max]`; when `max <= min` or either bound is
    non-finite, return `[min]` as a single-entry fallback (defensive, not expected on real
    hardware).

    Inside `useCameraStream()`, add three new state hooks: `hasZoom` (`boolean`, default
    `false`), `zoomLevels` (`number[]`, default `[]`), `currentZoom` (`number | null`, default
    `null`).

    In `startCamera()`, in the same block that currently reads `capabilities` and calls
    `setHasTorch('torch' in capabilities)`, also check for a `zoom` key: cast the capabilities
    object to include an optional `zoom?: { min?: number; max?: number; step?: number }` field,
    and when `capabilities.zoom` exists with numeric `min` and `max`, call
    `computeZoomPresets(capabilities.zoom.min, capabilities.zoom.max, capabilities.zoom.step)`,
    store the result via `setZoomLevels`, set `setHasZoom(true)`, and set `setCurrentZoom` to the
    first computed level (the widest preset). When the `zoom` key is absent (or missing numeric
    bounds), set `hasZoom` to `false`, `zoomLevels` to `[]`, and `currentZoom` to `null` — mirror
    the existing `else { setHasTorch(false); }` branch for the no-track case the same way.

    Add a new `setZoomLevel` callback (`useCallback`, dependent on `stream`) with the exact same
    shape as `toggleTorch`: bail out silently if there is no `stream` or no video track; read
    `track.getCapabilities()` and bail out (return, no state change) if `'zoom' in capabilities`
    is false; otherwise `await track.applyConstraints({ advanced: [{ zoom: value } as
    MediaTrackConstraintSet] })` inside a try/catch, call `setCurrentZoom(value)` only on
    success, and `console.warn('Zoom constraint failed:', e)` in the catch — no other error
    handling, no thrown exceptions out of this callback.

    In `stopCamera()`, alongside the existing `setHasTorch(false)` / `setIsTorchOn(false)` reset,
    add `setHasZoom(false)`, `setZoomLevels([])`, `setCurrentZoom(null)`.

    Add `hasZoom`, `zoomLevels`, `currentZoom`, `setZoomLevel` to the hook's returned object.
  </action>
  <verify>
    <automated>bunx vitest run src/hooks/useCameraStream.zoom.test.ts</automated>
  </verify>
  <done>
    `src/hooks/useCameraStream.zoom.test.ts` exists with the 3 cases above and passes.
    `useCameraStream` exposes `hasZoom`, `zoomLevels`, `currentZoom`, `setZoomLevel`; a
    `zoom`-capable mock track yields 4 correctly-spaced, step-snapped presets with the widest
    first; a non-`zoom`-capable mock track yields `hasZoom=false` and an empty `zoomLevels` with
    no crash; `setZoomLevel` calls `applyConstraints` with the requested value and updates
    `currentZoom` only on success.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Render the 4-level zoom row in CameraView and wire it from App.tsx</name>
  <files>src/components/CameraView.tsx, src/components/CameraView.zoom.test.tsx, src/App.tsx, src/lib/constants.ts</files>
  <behavior>
    - Test: rendering `CameraView` with `hasZoom={false}` (or the prop omitted, matching its
      default) renders no zoom-row element (`screen.queryByTestId('zoom-level-row')` is `null`).
    - Test: rendering `CameraView` with `hasZoom={true}`, `zoomLevels={[1, 2, 3, 4]}`,
      `currentZoom={1}` renders exactly 4 buttons inside the zoom row
      (`within(screen.getByTestId('zoom-level-row')).getAllByRole('button')` has length 4), each
      labeled with its level formatted as `{level.toFixed(1)}×` (so `1.0×`, `2.0×`, `3.0×`,
      `4.0×`), and the button matching `currentZoom` (`1.0×`) carries the active highlight class
      `bg-sg-success` while the others do not.
    - Test: clicking the `3.0×` button calls the mocked `onZoomLevelChange` prop with the
      argument `3`.
    - Write `src/components/CameraView.zoom.test.tsx` FIRST (reuse the `baseProps` shape from
      `src/components/CameraView.topBar.test.tsx`) and confirm it fails against the current
      component before implementing.
  </behavior>
  <action>
    In `src/components/CameraView.tsx`, add four new optional props to `CameraViewProps`:
    `hasZoom?: boolean`, `zoomLevels?: number[]`, `currentZoom?: number | null`,
    `onZoomLevelChange?: (value: number) => void`. Destructure them with defaults `hasZoom =
    false, zoomLevels = [], currentZoom = null, onZoomLevelChange` alongside the existing
    `hasTorch = false` destructure.

    Render a new zoom-level row only when `hasZoom && zoomLevels.length > 0`, placed in the
    bottom overlay container (the `relative z-20 pb-8 pt-3 px-6 flex flex-col items-center` div
    that already holds the camera-error/analysis-error banners and the "tap shutter to scan"
    hint pill), positioned immediately before that hint pill so it reads as part of the same
    bottom cluster. Give the row `data-testid="zoom-level-row"` and style it as a dark glass pill
    consistent with the hint bar right below it (`bg-[#0F172A]/75 backdrop-blur-md`, rounded
    full, `border border-white/10`, small horizontal padding, flex row with a small gap). Inside
    it, map `zoomLevels` to one button per level: `type="button"`, `key={level}`, `onClick={()
    => onZoomLevelChange?.(level)}`, label text `${level.toFixed(1)}×`, `aria-label` combining
    the new `t.zoomLevel` i18n string with the formatted value. Apply the same active/inactive
    class split already used for the torch button: when `currentZoom === level` use `bg-sg-
    success text-white shadow-sm`, otherwise use `text-white/80 hover:bg-white/15` (this row
    sits over the dark bottom overlay, unlike the torch button's light glass-panel context, so
    use the dark-context inactive classes, not the torch button's `text-sg-primary hover:bg-sg-
    surface`).

    In `src/lib/constants.ts`, add a `zoomLevel` key to both the `cn` object (next to
    `torchOn`/`torchOff`) and the `en` object (same position): cn value `'变焦'`, en value
    `'Zoom'`.

    In `src/App.tsx`, destructure `hasZoom, zoomLevels, currentZoom, setZoomLevel` from the
    `useCameraStream()` call (same destructure block that already pulls `isTorchOn, hasTorch,
    toggleTorch`), and pass them into `<CameraView />` as `hasZoom={hasZoom}`
    `zoomLevels={zoomLevels}` `currentZoom={currentZoom}` `onZoomLevelChange={setZoomLevel}`,
    placed next to the existing `hasTorch={hasTorch}` / `isTorchOn={isTorchOn}`
    `onToggleTorch={toggleTorch}` props.
  </action>
  <verify>
    <automated>bunx vitest run src/components/CameraView.zoom.test.tsx && bun run lint && bun run test</automated>
  </verify>
  <done>
    `src/components/CameraView.zoom.test.tsx` passes its 3 cases (no row when `hasZoom` is
    false, exactly 4 correctly-labeled buttons with the right one highlighted when `hasZoom` is
    true, click forwards the correct value). `bun run lint` (tsc --noEmit) reports no errors and
    the full `bun run test` suite passes with zero regressions in the existing App/CameraView
    integration tests that mock `useCameraStream` without the new fields.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser `MediaStreamTrack.getCapabilities()`/`applyConstraints()` -> App | The zoom range and step reported by the browser/device driver is trusted input this feature reads and re-applies; a malformed or unexpected shape must degrade to "no zoom control" rather than crash the camera view |
| User tap -> `applyConstraints({advanced:[{zoom}]})` -> physical camera hardware | User-selected preset values are computed entirely from the device's own reported min/max/step, never a value outside that range, so the hardware never receives an out-of-bounds constraint |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick260925-01 | Denial of Service | `useCameraStream.computeZoomPresets` / `setZoomLevel` | low | mitigate | `computeZoomPresets` clamps every generated preset into `[min, max]` before it is ever offered as a button, and `setZoomLevel` only forwards values that came from that clamped list, so `applyConstraints` never receives an out-of-range zoom value that could throw or destabilize the camera track |
| T-quick260925-02 | Tampering (malformed capability shape) | `useCameraStream.startCamera` capability read | low | accept | If `track.getCapabilities().zoom` exists but lacks numeric `min`/`max` (unexpected browser behavior), the code treats it the same as "no zoom capability" (`hasZoom=false`, empty `zoomLevels`) rather than guessing — worst case is the control simply doesn't appear, matching the required "hide if unsupported" behavior |
</threat_model>

<verification>
1. `bunx vitest run src/hooks/useCameraStream.zoom.test.ts` — hook-level capability detection, preset math, and `setZoomLevel` behavior all pass.
2. `bunx vitest run src/components/CameraView.zoom.test.tsx` — UI renders/hides correctly and forwards clicks with the right value.
3. `bun run lint` — `tsc --noEmit` reports no type errors across the new props/state.
4. `bun run test` — full suite green, confirming existing camera/torch/App integration tests are unaffected by the new optional fields.
</verification>

<success_criteria>
- A camera track that reports a `zoom` capability shows exactly 4 tappable presets spanning its real min→max range, widest first, with the active one highlighted; tapping one calls `applyConstraints` with that exact value.
- A camera track without a `zoom` capability shows no zoom control at all, with no console errors.
- No fake/CSS/crop-based wide-angle simulation exists anywhere in the diff.
- New `zoomLevel` i18n string exists in both `cn` and `en`.
</success_criteria>

<output>
Create `.planning/quick/260925-gdb-4-mediatrackconstraints-zoom-capability/260925-gdb-SUMMARY.md` when done
</output>
