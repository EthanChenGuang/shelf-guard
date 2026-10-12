# Inspect scan (gallery)

Compares a new shelf photo against the saved baseline using the in-browser OpenCV worker and shows the **inspection result** screen with compliance stats and anomaly overlays.

## Sub-features

- `gallery-capture` — **Scegli la foto dell'ispezione dalla galleria** uploads the inspection photo
- `scan-progress` — scanning / processing overlays while the worker runs
- `result-inspect` — **Risultato dell'ispezione** with **Conferma e concludi l'ispezione**
- `result-inspect-fullscreen` — tap or **Schermo intero** opens an opaque **Analisi comparativa** overlay sized to the **visual viewport** (Fullscreen API when the browser allows it; iOS falls back to visualViewport). Pinch-zoom; long-press still blink-compares the baseline at the same zoom/pan; **Esci da schermo intero** (✕) closes; AR boxes remain visible. Overlay must stay inside the visible area in landscape (no 100dvh overflow under the address bar).

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
- **Confirm centering.** `[data-testid="inspect-image-viewport"]` is `mx-auto` on the sized frame. Left/right gaps match in portrait **and** landscape (`inspect-scan-center.txt`).
- **Open fullscreen under WebKit-lie chrome.** Click `[data-testid="inspect-image-fullscreen-open"]` after `simulatePersistentTopChrome`: visualViewport reports offsetTop 0 / height === innerHeight, the 100svh probe reports innerHeight−56, and a 56px address bar is painted. Overlay.y must be ≥ 56; close, hint, and canvas stay inside that box (contain-fit, not cover-crop).
- **Viewports.** Assert 390×844, 844×390, 932×430, then rotate 844×390 → 390×844 **while fullscreen is open**.
- **Zoomed blink-compare.** Pinch `[data-testid="inspect-image-fullscreen-stage"]`, then long-press; `[data-showing-baseline="true"]` appears.
- **Proof.** `inspect-scan-results-*.png`, `inspect-scan-fullscreen-*.png`, `inspect-scan-fullscreen-blink-zoomed.png`, `inspect-scan-fullscreen-rotate-390x844.png`, `inspect-scan.aria.txt`, `first-capture-comparison.txt`.

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
