# Establish baseline

Lets a user save the first **reference (baseline) photo** for the active shelf by choosing an image from the library when no baseline exists yet.

## Sub-features

- `baseline-upload` — hidden file input accepts a JPEG/PNG and persists to IndexedDB
- `baseline-pill` — status chip switches from **Nessun riferimento** to **Riferimento pronto**
- `baseline-hint` — footer hint tells the user the shutter opens the library picker

## How to get to it (user POV)

- Open the app with an empty shelf (fresh install or new shelf slot)
- On the camera screen, read **Nessun riferimento** in the baseline pill
- Tap the large shutter (**Scatta e analizza lo scaffale**) — on first run this opens the **photo library**, not the live camera
- Pick a baseline image from the library

## Driving it with control-shelfguard

Preconditions:

- Preview healthy at `http://127.0.0.1:4173`
- `doctor` passes
- New browser context (default for each `browser drive`)

- **Open camera idle.** Run `control-shelfguard browser drive establish-baseline --artifacts-dir <dir>`. `camera-view` is visible.
- **Upload baseline.** The harness sets `public/test-fixtures/baseline-aligned.jpg` on `[data-testid="baseline-photo-input"]` without clicking the shutter (equivalent to picking a file).
- **Confirm pill.** `[data-testid="baseline-status-pill"]` contains **Riferimento pronto**.
- **Proof.** Screenshot `establish-baseline-camera.png` and text dump `establish-baseline-pill.txt` under `<dir>`.

## Gotchas

- Shutter click is only required on real devices to satisfy user-gesture rules for file pickers; Playwright may set the hidden input directly
- Baseline from library gets id prefix `custom-baseline-`, which enables native/gallery capture paths later
- Vite **dev** (`:3000`) is fine for this feature only; scans still need preview (see inspect-scan Gotchas)
