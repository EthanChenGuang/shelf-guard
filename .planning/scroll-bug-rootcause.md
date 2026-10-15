# Results screen does not scroll vertically on a real phone — root cause

Branch `feat/zoom-mode-magnifier` (PR #12) · 2026-10-15

## Symptom

On a real phone, `ResultInspectView` cannot be scrolled vertically at all. The magnifier, zoom, and X exit all work. The earlier harness reported PASS.

## Answers to the triage questions

| Question | Answer | Evidence |
|---|---|---|
| Does it fail before zoom is ever opened? | **Yes.** The cause is global: an App-level hook plus global CSS. Zoom is not involved. | `useLayoutViewportLock()` runs in `App.tsx` for every screen. The pre-fix harness fails `a-img`/`a-page` before the magnifier is touched. |
| Only on the image, or the whole page? | **Whole page.** The same failures appear when the swipe starts off the photo. | Pre-fix `a-page` FAIL with the same nested scrollers, listeners and scroll fighting as `a-img`. |
| Is the document actually taller than the viewport? | **Yes, on every device and orientation, with no injected height.** `room` is always about 350 px. The photo frame is sized to `100dvh − chrome − hint strip`, so the bottom control drawer (sliders, telemetry, CTA, about 350 px) always sits below the fold. | Natural `scrollingElement.scrollHeight − innerHeight`: iPhone 14 390×664 → 1016−664 = 352; same width with Safari bars at 484 → 352; landscape 750×340 → 350; Pixel 7 412×839 → 350; landscape 863×360 → 350. Galaxy S9+ and 15 Pro Max are the same (see the reports). |
| Did the harness inject height? | **No.** `room=350` was the natural measurement. The harness missed the bug for other reasons: (1) WebKit "swipe" PASS was a scripted `window.scrollBy`, which always moves the page; (2) headless Chromium never collapses a URL bar, so no `resize`/`visualViewport` events fire during a swipe; (3) it never instrumented `scrollTo` or listener registration. | `assertIdleSwipeScrolls` (old) in `control-shelfguard.mjs`. |

## Root cause

### 1. Primary: scroll fighting in `useLayoutViewportLock`

The old hook subscribed to window `resize` and to visualViewport `resize` and `scroll`. On each event it ran `lockHorizontalViewport()`, which did `window.scrollTo(0, window.scrollY)` and set `scrollLeft = 0` on html, body and #root. That happened immediately, again in rAF, and (for `resize`) again at +50 ms and +250 ms.

On a phone, the first swipe collapses the URL bar or Safari toolbar. That fires `resize` and visualViewport `resize`/`scroll` on every animation frame of the collapse, so the app issued dozens of programmatic scrolls while the finger was still moving. Programmatic scrolls during a touch scroll do two things:

- On iOS they cancel the in-flight pan or momentum.
- On both engines they write back the main thread's `scrollY`, which lags the compositor. The page snaps back.

Because this repeats on every toolbar frame, the page appears frozen.

Measured with `window.scrollTo`/`scroll`/`scrollBy`, `Element.scroll*` and html/body `scrollTop`/`scrollLeft` instrumented before app load:

- **Pixel 7, CDP touch swipe of 240 px while the viewport grows 4×14 px (URL bar collapse):** 96 programmatic scrolls. That breaks down as `window.scrollTo@resize` ×8 plus timer/rAF ×24, with the same counts for `html.scrollLeft=` and `body.scrollLeft=`.
- **iPhone 14 WebKit, the same 4-step toolbar resize at scrollY 120:** 48 programmatic scrolls.
- **First probe, 300 px swipe with toolbar collapse:** 32 `window.scrollTo` calls mid-gesture. The same swipe without a toolbar change had 0.

Headless Chromium keeps the main-thread `scrollY` in sync, so the snap-back itself is not visible there. The calls are.

### 2. Contributing: every ancestor was a hidden scroll container

`overflow-x: hidden` was set on `html`, `body`, `#root`, the App wrapper (`overflow-x-hidden`) and the ResultInspectView root (`overflow-x-hidden`). Per CSS, `overflow-x: hidden` forces `overflow-y: auto`, so the computed values were:

- `body`: `hidden/auto`
- `#root`: `hidden/auto`
- App div: `hidden/auto`
- results root: `hidden/auto`

Since `html` was already non-visible, body's overflow did not propagate to the viewport. That left **four nested scroll containers on every touch path**, and `body`/`#root` also had `overscroll-behavior: none`, which blocks scroll chaining. None of them has overflow, so desktop and headless engines skip them. iOS Safari can, however, latch a pan onto such a box, and `overscroll-behavior: none` then keeps the pan from chaining to the window.

### 3. Contributing: app-lifetime non-passive document touch listeners

`touchstart` and `touchmove` were registered on `document` with `{ passive: false, capture: true }` for the whole app lifetime. They only called `preventDefault` for two or more fingers, so they did not cancel one-finger scrolls. But every touch had to wait for the main thread before scrolling could start, which matters while React or OpenCV results are rendering.

### Ruled out

- **Idle photo handlers.** They never call `preventDefault`. The photo has `touch-action: pan-y`, React's root touch listeners are passive, and movement over 12 px cancels the hold. A new unit test asserts swipe events are not `defaultPrevented`.
- **`usePinchPanZoom`.** It only mounts inside the zoom overlay, and so does its non-passive listener and `setPointerCapture`.
- **`useBodyScrollLock` leftovers.** X, Esc and Back restore `html`/`body` `cssText` verbatim. After exit, body is not `position: fixed`, html/body overflow is not hidden, and `scrollY` is restored (`d-*` checks).
- **Layout clamped to the viewport.** `min-h-[100dvh]` is a minimum, and no ancestor has a fixed height. The document is about 350 px taller than the viewport everywhere.

### Limits of the evidence

The literal freeze cannot be reproduced in headless Playwright: there is no real toolbar, WebKit cannot take trusted touch input, and Chromium's main-thread and compositor scroll stay in sync. The diagnosis rests on three things: instrumented counts of programmatic scrolls during a gesture, the computed scroll-container topology, and known browser behaviour around `scrollTo` during touch scrolling. Final confirmation needs a real-device test.

## Fix (minimal blast radius)

| File | Change |
|---|---|
| `src/index.css` | `overflow-x: hidden` and `overscroll-behavior: none` now apply to `html` only, which propagates to the viewport, so the window is the single vertical scroller. `body` and `#root` use `overflow-x: clip`, which trims sideways overflow without creating a scroll container. `html { touch-action: pan-y }` is kept. |
| `src/App.tsx`, `src/components/ResultInspectView.tsx` (root) | `overflow-x-hidden` changed to `overflow-x-clip` (same visual clipping, no scroll container). |
| `index.html` | Dropped `overscroll-none` from `<body>`. |
| `src/components/ResultInspectView.tsx` | `<header>` and the filter HUD go from `sticky top-0` / `sticky top-[61px]` to `relative`. Their nearest scroll container used to be the non-scrolling results root, so they never actually stuck. Once that root stops being a scroll container, `sticky` would start pinning them to the viewport, about 110 px of a 340 px landscape screen, over the photo and its magnifier (seen in a screenshot). `relative` keeps the pre-fix behaviour, where they scroll away with the page. |
| `src/hooks/useLayoutViewportLock.ts` | No `resize` or visualViewport handlers. No inline overflow styles. No document `touchstart`/`touchmove` listeners. On `orientationchange` only (now, +50 ms, +250 ms), it calls `window.scrollTo({ left: 0 })` and only if `scrollX !== 0`, so the vertical position is never written. `gesturestart`/`gesturechange` are still prevented (iOS page pinch); these never cancel a one-finger scroll. |

Unchanged:

- Horizontal white-strip fix after rotation (`rotate` check plus the establish-baseline rotate offsets).
- Hold-to-reference.
- Zoom overlay. It is `touch-action: none` and its own non-passive listeners live on the stage only while open.
- X, Esc and Back exits, and `useBodyScrollLock`.

## Verification

- Unit tests:
  - `useLayoutViewportLock.test.ts`: resize and visualViewport events never scroll; orientationchange only fixes `scrollX`; no document touch listeners.
  - `ResultInspectView.zoom.test.tsx`: an idle swipe is not `defaultPrevented` and cancels the hold.
- Harness (`inspect-scan`, `inspect-scan-cross-platform`):
  - `a-img`/`a-page` (before zoom) and `g-img`/`g-page` (after X) use a real CDP touch swipe on Chromium. On WebKit they are a static topology and listener audit, with no `scrollBy`.
  - `h-fight` asserts zero programmatic scrolls while the viewport resizes mid-scroll.
  - The pre-fix build fails these checks on every device and orientation; the fixed build passes. See HANDOFF.md for the run ids.
