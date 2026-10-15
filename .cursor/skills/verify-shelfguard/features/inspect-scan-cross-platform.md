# Inspect scan (iPhone WebKit + Android Chromium)

Same gallery inspection as [inspect-scan](./inspect-scan.md), driven on Playwright **device profiles** so explicit zoom mode (magnifier → full-screen overlay) and idle page scrolling are proven on iOS WebKit and Android Chrome — not only a generic 390×844 Chromium viewport.

## Sub-features

- `webkit-iphone` — `iPhone 14` and `iPhone 15 Pro Max` (Playwright WebKit, `hasTouch`)
- `chromium-android` — `Pixel 7` and `Galaxy S9+` (Playwright Chromium Android UA, `hasTouch`)
- `result-inspect-zoom` — per device, **portrait and landscape**, the same checks as [inspect-scan](./inspect-scan.md): `a-img`/`a-page` page scroll before zoom (swipe starting on the photo / off it), `h-fight` no scroll fighting, (b) magnifier opens the overlay, (c) pinch/pan scale > 1, (d) X / Escape / Back exit and fully restore styles + scroll, `g-img`/`g-page` page scroll after X, (e) hold shows the reference idle and in zoom mode, (f) Italian hint below, not on, the photo.

## How to get to it (user POV)

Same as inspect-scan: save a baseline, pick an inspection photo from the gallery, wait for **Risultato dell'ispezione**.

## Driving it with control-shelfguard

```bash
node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive inspect-scan-cross-platform \
  --url http://127.0.0.1:4173 \
  --artifacts-dir /opt/cursor/artifacts/verify-shelfguard/<run-id>/inspect-scan-cross-platform
```

Install Playwright WebKit once: `node node_modules/playwright/cli.js install webkit` (and host libs if the CLI asks).

Each device opens a fresh context from `playwright.devices` (empty IndexedDB), uploads fixtures, then runs the checks at the device's portrait viewport and its `<device> landscape` viewport. Output: `cross-platform-report.txt` — a device/orientation × check PASS/FAIL matrix followed by one detailed row per check; the command exits **1** if any row FAILs.

How touch is produced (recorded in the report header):

| Engine | Pinch / pan / hold / idle swipe | Buttons |
|---|---|---|
| Chromium (Pixel 7, Galaxy S9+) | **Trusted** CDP `Input.dispatchTouchEvent`; `a-*`/`g-*` are real compositor scrolls asserted on `window.scrollY` (≥ 20 px) with zero app-issued programmatic scrolls during the swipe. `Input.synthesizeScrollGesture` (touch) is also tried and reported in the header — informational only: headless Chromium completes it without scrolling, even on a plain 3000 px page | `locator.tap()` (trusted) |
| WebKit (iPhone 14, 15 Pro Max) | **Synthetic** pinch/pan/hold: untrusted `TouchEvent`s built from `document.createTouch`/`createTouchList` (`new Touch()` is an illegal constructor in WebKit; `PointerEvent` pointerType=mouse is the last fallback). Untrusted touches never scroll and Playwright refuses `mouse.wheel` in mobile WebKit (attempted; error recorded in the header), so `a-*`/`g-*` are a **static proof with no scripted `scrollBy`**: computed `touch-action` allows pan-y from the start element up to `<html>`; no ancestor is a user-scrollable box (`auto`/`scroll` on either axis — `overflow-x: hidden` silently forces `overflow-y: auto`); no other element holds overflowing vertical content; no non-passive `touchstart`/`touchmove` listener on window/document/ancestors (`addEventListener` instrumented by `addInitScript`; Playwright's own hit-target interceptor is excluded by name); no `position: fixed` / hidden overflow / zoom attribute on html/body; `document.scrollingElement` has natural vertical overflow; and the untrusted swipe is not `defaultPrevented` | `locator.tap()` (trusted) |

`h-fight` (both engines): `window.scrollTo/scroll/scrollBy`, `Element.scroll*` and html/body `scrollTop`/`scrollLeft` are instrumented at init. The viewport grows 4×14 px (a collapsing URL bar / Safari toolbar fires `resize` + visualViewport `resize`/`scroll`) — mid-swipe on Chromium, at `scrollY` 120 on WebKit — and the app must issue **zero** programmatic scrolls.

No harness step adds height or padding. Every scroll row reports the natural `scrollingElement.scrollHeight`, `innerHeight` and `room`; if content were not taller than the viewport the row FAILs saying so.

WebKit host requirement: the repo pins Playwright 1.49, whose WebKit only has an Ubuntu-20.04 fallback build on unknown hosts (e.g. Debian 13 — fails with missing `libicu*.so.66`). Point `SHELFGUARD_WEBKIT_PLAYWRIGHT` at a newer `playwright` package directory to launch WebKit from it (device descriptors still come from the repo):

```bash
SHELFGUARD_WEBKIT_PLAYWRIGHT=/tmp/pw/node_modules/playwright \
  node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive inspect-scan-cross-platform ...
```

Run a single device with `--device "iPhone 14"`.

## Gotchas

- Do not pass Chromium-only launch args to WebKit
- **Ephemeral WebKit contexts reject Blobs in IndexedDB** (`Failed to save baseline for shelf 0: null`); the harness runs WebKit in a persistent context on a fresh temp profile, which is still empty per drive
- WebKit touch is synthetic and its scroll rows are static (see table) — a WebKit PASS proves the window is the single, unlocked, pan-y scroller with no non-passive touch listener and no scroll fighting, not that Safari's compositor scrolled. Confirm on a real iPhone
- Pinch implementation must not depend on iOS-only `gesturestart.scale` — that event is only `preventDefault`'d to stop Safari page-zoom
