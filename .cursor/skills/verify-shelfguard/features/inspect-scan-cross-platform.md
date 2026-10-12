# Inspect scan (iPhone WebKit + Android Chromium)

Same gallery inspection as [inspect-scan](./inspect-scan.md), driven on Playwright **device profiles** so whole-screen pinch-zoom is proven on iOS WebKit and Android Chrome — not only a generic 390×844 Chromium viewport.

## Sub-features

- `webkit-iphone` — `iPhone 14` and `iPhone 15 Pro Max` (Playwright WebKit, `hasTouch`)
- `chromium-android` — `Pixel 7` and `Galaxy S9+` (Playwright Chromium Android UA, `hasTouch`)
- `result-inspect-zoom` — two-finger **touch** pinch on `[data-testid="inspect-image-viewport"]` in portrait **and** landscape; zoom layer overflows the frame; no ancestor `overflow: hidden/clip`

## How to get to it (user POV)

Same as inspect-scan: save a baseline, pick an inspection photo from the gallery, wait for **Risultato dell'ispezione**.

## Driving it with control-shelfguard

```bash
node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive inspect-scan-cross-platform \
  --url http://127.0.0.1:4173 \
  --artifacts-dir /opt/cursor/artifacts/verify-shelfguard/<run-id>/inspect-scan-cross-platform
```

Install Playwright WebKit once: `node node_modules/playwright/cli.js install webkit` (and host libs if the CLI asks).

Each device opens a fresh context from `playwright.devices`, uploads fixtures, pinches to ~2.75, then `setViewportSize` to that device’s landscape profile and pinches again.

## Gotchas

- Do not pass Chromium-only launch args to WebKit
- WebKit may lack `new Touch()`; the harness falls back to PointerEvent (`pointerType: mouse`) so the app’s pointer path is exercised, while real phones still use TouchEvents
- Pinch implementation must not depend on iOS-only `gesturestart.scale` — that event is only `preventDefault`’d to stop Safari page-zoom
