# Inspect scan (iPhone WebKit + Android Chromium)

Same gallery inspection as [inspect-scan](./inspect-scan.md), driven on Playwright **device profiles** so explicit zoom mode (magnifier → full-screen overlay) and idle page scrolling are proven on iOS WebKit and Android Chrome — not only a generic 390×844 Chromium viewport.

## Sub-features

- `webkit-iphone` — `iPhone 14` and `iPhone 15 Pro Max` (Playwright WebKit, `hasTouch`)
- `chromium-android` — `Pixel 7` and `Galaxy S9+` (Playwright Chromium Android UA, `hasTouch`)
- `result-inspect-zoom` — per device, **portrait and landscape**, the same checks as [inspect-scan](./inspect-scan.md): (a) idle swipe on the photo scrolls the page, (b) magnifier opens the overlay, (c) pinch/pan scale > 1, (d) X / Escape / Back exit and fully restore styles + scroll (and swipe works again), (e) hold shows the reference idle and in zoom mode, (f) Italian hint below, not on, the photo.

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
| Chromium (Pixel 7, Galaxy S9+) | **Trusted** CDP `Input.dispatchTouchEvent`; the idle swipe is a real compositor scroll measured via `window.scrollY` | `locator.tap()` (trusted) |
| WebKit (iPhone 14, 15 Pro Max) | **Synthetic**: untrusted `TouchEvent`s built from `document.createTouch`/`createTouchList` (`new Touch()` is an illegal constructor in WebKit; `PointerEvent` pointerType=mouse is the last fallback). Untrusted touches never scroll and Playwright refuses `mouse.wheel` in mobile WebKit, so (a) = computed `touch-action` allows pan-y on photo + ancestors **and** the synthetic swipe is not `defaultPrevented` by any listener **and** the emulated pan-y default action (`scrollBy`) moves `scrollY` | `locator.tap()` (trusted) |

WebKit host requirement: the repo pins Playwright 1.49, whose WebKit only has an Ubuntu-20.04 fallback build on unknown hosts (e.g. Debian 13 — fails with missing `libicu*.so.66`). Point `SHELFGUARD_WEBKIT_PLAYWRIGHT` at a newer `playwright` package directory to launch WebKit from it (device descriptors still come from the repo):

```bash
SHELFGUARD_WEBKIT_PLAYWRIGHT=/tmp/pw/node_modules/playwright \
  node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive inspect-scan-cross-platform ...
```

Run a single device with `--device "iPhone 14"`.

## Gotchas

- Do not pass Chromium-only launch args to WebKit
- **Ephemeral WebKit contexts reject Blobs in IndexedDB** (`Failed to save baseline for shelf 0: null`); the harness runs WebKit in a persistent context on a fresh temp profile, which is still empty per drive
- WebKit touch is synthetic (see table) — a WebKit PASS proves the app never cancels the swipe and leaves pan-y enabled, not that Safari's compositor scrolled
- Pinch implementation must not depend on iOS-only `gesturestart.scale` — that event is only `preventDefault`'d to stop Safari page-zoom
