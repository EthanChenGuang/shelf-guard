# Results image: explicit zoom mode (design note)

Branch `feat/zoom-mode-magnifier` · 2026-10-15

## Problem

`ResultInspectView` armed inline two-finger pinch permanently: the image frame had
`touch-action: none` (inline style **and** `index.css`), and `usePinchPanZoom` attached
non-passive `touchstart`/`touchmove` listeners that `preventDefault()` whenever scale > 1.
A vertical swipe that starts on the photo (the photo fills most of a phone screen) therefore
never scrolls the page. Separately, `useLayoutViewportLock` called `window.scrollTo(0, 0)` on
every `resize`/`orientationchange` — on Android Chrome the URL bar hiding fires `resize`, so
the page snapped back to the top.

## Decisions

| Topic | Decision |
|---|---|
| Idle gestures | Image frame is `touch-action: pan-y` (the `html` already is `pan-y`; page pinch is disabled by the viewport meta). No pinch handlers and no non-passive touch listeners are attached while idle. Only the hold-to-reference handlers remain, and those never `preventDefault`; movement > 12 px cancels the hold, so a swipe is a scroll. |
| Entering zoom | Explicit magnifier button (lucide `ZoomIn`) in the photo's top-right corner, `aria-label="Ingrandisci immagine"`. Discoverable, keyboard-reachable, and avoids having to infer intent from a two-finger touch. |
| Zoom surface | Full-screen modal rendered with `createPortal(…, document.body)`: `position: fixed; inset: 0`, black backdrop, `touch-action: none` on the gesture stage only. The portal escapes every `overflow`/`transform`/`contain` ancestor, so the old "lift overflow on html/body/#root while zoomed" hacks (`setInspectZoomed`, `html[data-inspect-zoomed]` CSS) are removed. |
| Pinch implementation | Reuse `usePinchPanZoom` (TouchEvents first, PointerEvents as fallback for mouse/pen and engines without TouchEvent). The hook only mounts inside the overlay, so its non-passive listeners exist only in zoom mode. Scale clamps 1–5; one-finger pan when scale > 1. Double-tap is optional and **not** implemented (it conflicts with hold-to-reference timing). |
| Pointer vs touch | TouchEvents drive the gesture on phones (`touches` gives a consistent finger set on iOS Safari; Pointer Events for touch on iOS lack reliable multi-pointer capture). Pointer path is ignored for `pointerType: touch` when `TouchEvent` exists, preventing double-scaling on Android where both fire. |
| iOS Safari `gesture*` | iOS ignores `user-scalable=no`; the global `gesturestart/gesturechange` `preventDefault` (already in `useLayoutViewportLock`) and the overlay's own listeners stop page zoom. We never use `GestureEvent.scale` (WebKit-only). |
| Android Chrome | Honors `user-scalable=no` and `touch-action`; `touch-action: none` on the stage is enough to receive every `touchmove` uncancelled. The hook still calls `preventDefault` on multi-touch moves for older engines. |
| Scroll lock | On enter: save `scrollX/scrollY` and the exact inline `style.cssText` of `<html>` and `<body>`, then set `html{overflow:hidden; overscroll-behavior:none}` and `body{position:fixed; top:-scrollY; left:-scrollX; right:0; width:100%; overflow:hidden}` (the iOS-Safari-safe lock: `overflow:hidden` alone does not stop touch scroll on iOS < 16 and lets the page rubber-band behind the modal). `html[data-inspect-zoom-mode="true"]` marks the state. On exit: restore both `cssText` strings verbatim (so `overflow`, `position`, `touch-action`, etc. return to their pre-zoom inline values, including the viewport lock's `overflow-x: hidden`), remove the attribute, then `window.scrollTo(savedX, savedY)`. Restore runs from the effect cleanup, so unmounting mid-zoom also unlocks. |
| Viewport lock interplay | `lockHorizontalViewport` now resets only the horizontal offset (`scrollTo(0, scrollY)`), so rotations and URL-bar resizes no longer jump to the top. During zoom (`body` fixed) `scrollY` is 0 and the saved value is what we restore. |
| Exit paths | X button (lucide `X`, `aria-label="Chiudi ingrandimento"`), `Escape`, and browser/hardware Back. Enter does `history.pushState({ sgInspectZoom: true })` in the click handler (not an effect — StrictMode double effects would push twice); a `popstate` listener (only while open) closes the overlay. Closing via X/Esc calls `history.back()` to consume our entry, after the listener is gone. |
| Hold-to-reference | Same `useBlinkCompareHold` instance in both modes, so the status chip text is shared. Idle: handlers on the frame; zoom: handlers on the stage. The magnifier and X buttons stop propagation of `mousedown/touchstart/pointerdown`, and the X is a sibling of the stage, so tapping a button never starts a hold, and the stage's non-passive listeners never cancel the button's click. |
| Focus / a11y | Overlay is `role="dialog" aria-modal="true"` with an Italian label; focus moves to X on open, `Tab` is trapped on X (only focusable control), focus returns to the magnifier on close. Status hint inside the overlay is `role="status"` so the reference/hold change is announced. |
| Hint copy | One line below the photo (never on it): it "Tocca 🔍 per ingrandire · Tieni premuto per il riferimento", en "Tap 🔍 to zoom · Hold to see reference", zh "点 🔍 放大 · 按住显示参考图". In the overlay: "Pizzica per ingrandire · Tieni premuto per il riferimento". |
| dvh / safe areas | Overlay uses `inset: 0` (fixed) which tracks the dynamic viewport; photo frame is sized with `frameBoxStyle(dims, '100dvh')` fit inside `100vw`. X button is offset by `env(safe-area-inset-top/right)` (viewport meta already has `viewport-fit=cover`) and the hint by `env(safe-area-inset-bottom)` so neither sits under the notch / home indicator in landscape. |
| Orientation change | The overlay is pure CSS layout (fixed + aspect-ratio box), so it reflows on rotate. Transform is kept (user's zoom survives rotation); pan is clamped by the user, not auto-reset. Scroll restore uses the saved Y; browsers clamp if the new layout is shorter. |

## Testing

- Vitest: idle frame `touch-action: pan-y` and no `data-zoom-scale` pinch on two-finger touch; enter via magnifier renders portal overlay + locks scroll; pinch in overlay scales > 1; X / Escape / `popstate` exit; exit restores `html`/`body` `cssText` byte-for-byte and calls `scrollTo(savedX, savedY)`; hold works in both modes and button taps don't start a hold; focus moves to X and back.
- Harness (`inspect-scan`, `inspect-scan-cross-platform`): per device × orientation checks (a)–(f) written to `cross-platform-report.txt`, non-zero exit on any FAIL. Chromium uses trusted CDP `Input.dispatchTouchEvent` (real compositor scroll + real touch pinch). WebKit has no touch-injection API in Playwright beyond `tap()` (used for the magnifier/X), `new Touch()` is an illegal constructor, and `mouse.wheel` is refused in mobile WebKit. WebKit pinch/pan/hold therefore use untrusted `TouchEvent`s built from `document.createTouch`/`createTouchList` (still the app's real TouchEvent path), and idle scroll is proven by: computed `touch-action` on the photo and every ancestor allows `pan-y`; the synthetic cancelable `touchstart/touchmove` swipe on the photo is **not** `defaultPrevented`; and the emulated pan-y default action (`scrollBy`) moves `scrollY` (the page is not locked). Documented as synthetic in the report. Ephemeral WebKit contexts reject Blobs in IndexedDB, so WebKit runs in a fresh persistent profile.
