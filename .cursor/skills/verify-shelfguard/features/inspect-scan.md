# Inspect scan (gallery)

Compares a new shelf photo against the saved baseline using the in-browser OpenCV worker and shows the **inspection result** screen with compliance stats and anomaly overlays.

## Sub-features

- `gallery-capture` — **Scegli la foto dell'ispezione dalla galleria** uploads the inspection photo
- `scan-progress` — scanning / processing overlays while the worker runs
- `result-inspect` — **Risultato dell'ispezione** with **Conferma e concludi l'ispezione**
- `result-inspect-zoom` — two-finger pinch zoom/pan **inline** on `[data-testid="inspect-image-viewport"]` (no fullscreen overlay or expand control). AR boxes transform with the photo. Long-press still blink-compares the baseline at the same zoom/pan. Rapid 1↔2 finger sequences must not toggle blink-compare or reset scale.
- `layout-lock` — after portrait↔landscape rotation on capture and results, `scrollX === 0` and document width equals the viewport (no left white strip).

## How to get to it (user POV)

- Establish a baseline on the shelf (see establish-baseline)
- On camera idle with **Riferimento pronto**, tap the gallery icon (**Scegli la foto dell'ispezione dalla galleria**)
- Choose an inspection photo from the library
- Wait for analysis, then review the result screen

Alternate entry (not used in CI harness): tap shutter to open the OS camera when baseline was taken with the device camera.

## Driving it with control-shelfguard

Preconditions:

- Preview at `http://127.0.0.1:4173` (not Vite dev)
- `/opencv/opencv.js` returns the large Emscripten bundle (doctor checks this)
- Baseline established in the same browser context (harness runs establish-baseline first if needed)

- **Ensure baseline.** After hydration, pill shows **Riferimento pronto**.
- **First capture (comparison).** Click gallery button by Italian `aria-label`, set `public/test-fixtures/capture-displaced.jpg` on `[data-testid="gallery-input"]`. This is the first capture with a persisted baseline — it must run comparison, not save a new baseline.
- **Wait for results.** Button **Conferma e concludi l'ispezione** becomes visible (timeout up to 120s for worker init). Camera idle must not remain on screen.
- **Confirm centering.** `[data-testid="inspect-image-viewport"]` is `mx-auto` on the sized frame. Left/right gaps match in portrait **and** landscape (`inspect-scan-center.txt`). There is no `[data-testid="inspect-image-fullscreen"]` or expand control.
- **Viewports.** Assert 390×844, 844×390, 932×430.
- **Inline pinch-zoom.** Two-finger pinch on `[data-testid="inspect-image-viewport"]`; `data-zoom-scale` > 1.05.
- **Zoomed blink-compare.** Long-press after pinch; `[data-showing-baseline="true"]` appears at the same `data-zoom-scale`.
- **No flicker during pinch.** Rapid 1↔2 finger sequences: blink-state toggle count is 0 and scale does not reset to 1.
- **No post-rotate offset.** On capture and results, after 390×844 ↔ 844×390 ↔ 932×430: `scrollX === 0`, `documentElement.scrollWidth <= innerWidth`.
- **Proof.** `inspect-scan-results-*.png`, `inspect-scan-*-zoom.png`, `inspect-scan-*-zoom-blink.png`, `inspect-scan-rotate-*.png`, `inspect-scan.aria.txt`, `first-capture-comparison.txt`.

Command:

```bash
node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive inspect-scan \
  --url http://127.0.0.1:4173 \
  --artifacts-dir /opt/cursor/artifacts/verify-shelfguard/<run-id>/inspect-scan
```

## Gotchas

- **Vite dev serves `/opencv/opencv.js` as HTML** — analysis fails with **Analisi non riuscita, riprova lo scatto**. Always verify on preview from `launch-verify-server.sh`
- Headless Chromium may log camera errors; gallery path does not require a working camera
- Matching baseline/capture aspect matters; use repo fixtures unless intentionally testing mismatch
- First scan after cold start may take longer while OpenCV initializes in the worker
- **Wait for IndexedDB hydration** before capturing. While the shelf loads, the baseline pill is blank and the shutter is locked (`Scansione in corso, attendere`). After hydration with an existing baseline, the **first** capture must open **Risultato dell'ispezione** (comparison), not rewrite the baseline (PR #6 / STAB-05)
