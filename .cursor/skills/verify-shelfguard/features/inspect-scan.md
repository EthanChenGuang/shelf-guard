# Inspect scan (gallery)

Compares a new shelf photo against the saved baseline using the in-browser OpenCV worker and shows the **inspection result** screen with compliance stats and anomaly overlays.

## Sub-features

- `gallery-capture` — **Scegli la foto dell'ispezione dalla galleria** uploads the inspection photo
- `scan-progress` — scanning / processing overlays while the worker runs
- `result-inspect` — **Risultato dell'ispezione** with **Conferma e concludi l'ispezione**
- `page-scroll` — the window (`document.scrollingElement`) is the only vertical scroller: `html { overflow-x: hidden }`, `body`/`#root`/app wrappers `overflow-x: clip` (never `hidden`, which forces `overflow-y: auto` and nests a scroller), no resize/visualViewport `scrollTo`, no app-lifetime non-passive document touch listeners. See `.planning/scroll-bug-rootcause.md`.
- `result-inspect-zoom` — **explicit zoom mode**. Idle, `[data-testid="inspect-image-viewport"]` is `touch-action: pan-y` with no pinch handlers, so a vertical swipe that starts on the photo scrolls the page. The magnifier `[data-testid="inspect-zoom-enter"]` (**Ingrandisci immagine**, photo top-right corner) opens `[data-testid="inspect-zoom-overlay"]`: a `role="dialog"` portal on `<body>`, `position: fixed; inset: 0`, with `[data-testid="inspect-zoom-stage"]` (`touch-action: none`, `data-zoom-scale`) and `[data-testid="inspect-zoom-layer"]` (CSS transform). Pinch zooms 1–5×, one finger pans when zoomed. While open the page is scroll-locked (`html[data-inspect-zoom-mode="true"]`, body `position: fixed; top: -scrollY`). Exit with X `[data-testid="inspect-zoom-exit"]` (**Chiudi ingrandimento**), **Escape**, or browser **Back** (history entry `sgInspectZoom`); exit restores `<html>`/`<body>` inline styles verbatim and `scrollY`.
- `result-inspect-hold` — press-and-hold (450 ms) shows the baseline both idle and in zoom mode (zoom keeps scale/pan). Movement > 12 px cancels, so swipes/pinches never blink. Pressing the magnifier or X never starts a hold.
- `result-inspect-hints` — `[data-testid="inspect-hold-hint"]` in `[data-testid="inspect-hold-strip"]` **below** the frame: **Tocca 🔍 per ingrandire · Tieni premuto per il riferimento** on one line (`white-space: nowrap`, ellipsis fallback), `pointer-events: none`; while holding **Stai vedendo la foto di riferimento**. In zoom mode `[data-testid="inspect-zoom-hint"]` (`role="status"`) shows **Pizzica per ingrandire · Tieni premuto per il riferimento** / the same reference status. Must not intersect the image and must stay in the viewport. `prefers-reduced-motion` disables hold motion.
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
- **Per viewport** 390×844 (portrait), 844×390 and 932×430 (landscape) the harness runs checks (a)–(f) and records PASS/FAIL rows in `inspect-scan-zoom-report.txt` (exit code 1 on any FAIL):
  - `center` — photo frame is `mx-auto`, left/right gaps equal.
  - **(f)** Italian hint present, one line, below and not intersecting the image, inside the viewport.
  - **(e-idle)** trusted CDP touch hold on a free point of the photo (clear of AR boxes/buttons — browsers retarget touches to nearby tappable boxes) shows **Stai vedendo la foto di riferimento**.
  - **(a-img / a-page)** from `scrollY` 0 on the natural layout (no injected height; `scrollHeight`/`innerHeight`/`room` reported), a trusted CDP vertical swipe starting on the photo / on the page off the photo moves `window.scrollY` ≥ 20 px with zero app-issued programmatic scrolls, and the scroll topology is clean (pan-y chain to `<html>`, no nested user-scrollable box, no non-passive document/ancestor touch listener, no html/body lock).
  - **(h-fight)** the viewport grows 4×14 px mid-swipe (URL bar collapse → `resize` + visualViewport events): zero `scrollTo`/`scrollTop`/`scrollLeft` writes by the app.
  - **(b)** `locator.tap()` on the magnifier opens a full-viewport portal dialog, body is `position: fixed`, focus is on X.
  - **(c)** CDP two-finger pinch 80→220 px gives `data-zoom-scale` ≈ 2.75; one-finger drag changes the layer `translate()`.
  - **(e-zoom)** hold inside the overlay shows the reference at the same scale.
  - **(d-x / d-esc / d-back)** X tap, `Escape`, and `page.goBack()` each remove the overlay and restore `html`/`body` `style.cssText`, computed overflow/position/touch-action, and the pre-zoom `scrollY` (36 px).
  - **(g-img / g-page)** after X, the same swipes as (a) scroll the page again.
  - Plus `c2` (rapid 1↔2 finger sequence in zoom mode: no blink toggles / scale resets) and `rotate` (after portrait↔landscape rotations `scrollX === 0`, document width equals the viewport).
- **Proof.** `inspect-scan-zoom-report.txt`, `inspect-scan-<WxH>-results.png`, `-hold-hints.png`, `-hold-frame-*.png`, `-hold-status.png`, `-hold-geometry.txt`, `-zoom-enter.png`, `-zoom.png`, `-zoom-hold.png`, `-after-exit.png`, `inspect-scan-rotate-*.png`, `inspect-scan.aria.txt`, `first-capture-comparison.txt`.

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
- On very small landscape photos the press point for holds must keep clearance from AR boxes: Chrome's touch adjustment retargets a finger near a tappable box onto it (boxes stop touch propagation so they can be tapped to dismiss)
- **Wait for IndexedDB hydration** before capturing. While the shelf loads, the baseline pill is blank and the shutter is locked (`Scansione in corso, attendere`). After hydration with an existing baseline, the **first** capture must open **Risultato dell'ispezione** (comparison), not rewrite the baseline (PR #6 / STAB-05)
