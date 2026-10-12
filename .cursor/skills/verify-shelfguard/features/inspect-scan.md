# Inspect scan (gallery)

Compares a new shelf photo against the saved baseline using the in-browser OpenCV worker and shows the **inspection result** screen with compliance stats and anomaly overlays.

## Sub-features

- `gallery-capture` — **Scegli la foto dell'ispezione dalla galleria** uploads the inspection photo
- `scan-progress` — scanning / processing overlays while the worker runs
- `result-inspect` — **Risultato dell'ispezione** with **Conferma e concludi l'ispezione**

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

- **Ensure baseline.** Pill shows **Riferimento pronto**.
- **Upload inspection photo.** Click gallery button by Italian `aria-label`, set `public/test-fixtures/capture-displaced.jpg` on `[data-testid="gallery-input"]`.
- **Wait for results.** Button **Conferma e concludi l'ispezione** becomes visible (timeout up to 120s for worker init).
- **Proof.** `inspect-scan-results.png` and `inspect-scan.aria.txt` under artifacts dir.

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
