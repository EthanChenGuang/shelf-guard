---
name: verify-shelfguard
description: Drive ShelfGuard (Online Market shelf inspection PWA) in a real browser — launch preview, set baselines, run gallery inspections, switch shelves. Use after UI, camera, vision, or IndexedDB changes when you need user-level proof, not just Vitest.
---

# Verify ShelfGuard

ShelfGuard is a **client-only React PWA** (`npm run dev` / Vite). Verification drives the **production preview** in Chromium via Playwright, using **file uploads** instead of a physical camera. Default UI language is **Italian** (`it`).

## Launch

From the repository root:

1. Install deps if needed: `npm install`
2. Install Playwright browsers once: `node node_modules/playwright/cli.js install chromium webkit`
3. Start the verification server (build + preview):

```bash
.cursor/skills/verify-shelfguard/bin/launch-verify-server.sh
```

This writes the preview PID to `/tmp/shelfguard-verify.pid` and serves **`http://127.0.0.1:4173`**.

Ready when `curl -sf http://127.0.0.1:4173/` succeeds **and** `/opencv/opencv.js` returns JavaScript (not the SPA HTML shell). The bundled OpenCV runtime is required for inspection scans.

**Do not** use `npm run dev` for scan verification: on Vite dev, `/opencv/opencv.js` is incorrectly served as `index.html`, so vision analysis always fails.

Only one verification preview should own port **4173**. Do not drive a preview instance you did not start for this run.

## Doctor

```bash
node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs doctor \
  --url http://127.0.0.1:4173 \
  --pid-file /tmp/shelfguard-verify.pid
```

Confirms HTTP 200, OpenCV script reachable, fixtures present, and (optional) preview PID alive. Run this before driving whenever anything looks wrong.

## Drive

Harness: **`control-shelfguard`** (Playwright). Each `browser drive` opens a **fresh** browser context (empty IndexedDB) so runs do not clobber each other.

```bash
RUN_ID="$(date +%s)"
ART="/opt/cursor/artifacts/verify-shelfguard/${RUN_ID}"

node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive establish-baseline \
  --url http://127.0.0.1:4173 \
  --artifacts-dir "${ART}/establish-baseline"

node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive inspect-scan \
  --url http://127.0.0.1:4173 \
  --artifacts-dir "${ART}/inspect-scan"

node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive multi-shelf \
  --url http://127.0.0.1:4173 \
  --artifacts-dir "${ART}/multi-shelf"

node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive inspect-scan-cross-platform \
  --url http://127.0.0.1:4173 \
  --artifacts-dir "${ART}/inspect-scan-cross-platform"
```

Read the feature map first: [features/README.md](./features/README.md). Prefer **`data-testid`** and **Italian `aria-label` strings** from `src/lib/constants.ts` (default locale `it`).

Ad-hoc snapshot:

```bash
node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser snapshot \
  --url http://127.0.0.1:4173 \
  --artifacts-dir "${ART}" \
  --name camera-idle
```

## Evidence

Save proof under **`/opt/cursor/artifacts/verify-shelfguard/<run-id>/`**:

| Artifact | Proves |
|----------|--------|
| `establish-baseline/establish-baseline-camera.png` | Baseline saved; pill shows **Riferimento pronto** |
| `establish-baseline/establish-baseline-pill.txt` | Exact baseline status text |
| `inspect-scan/inspect-scan-390x844-pinch-hints.png` | Portrait pinch overlay (Italian, sequenced before hold) |
| `inspect-scan/inspect-scan-390x844-pinch-frame-*.png` | Pinch animation frames at 0 / 400 / 800ms |
| `inspect-scan/inspect-scan-390x844-hold-hints.png` | Portrait hold caption **Puoi ingrandire · Tieni premuto…** on one line **below** the photo (before press) |
| `inspect-scan/inspect-scan-390x844-hold-status.png` | Portrait **Stai vedendo la foto di riferimento** below the photo while pressing |
| `inspect-scan/inspect-scan-390x844-hold-frame-*.png` | Hold animation frames at 0 / 400 / 800ms |
| `inspect-scan/inspect-scan-390x844-hold-geometry.txt` | Hold/status rects do not intersect the image and sit in the viewport |
| `inspect-scan/inspect-scan-844x390-pinch-hints.png` | Landscape pinch overlay before it sequences to hold |
| `inspect-scan/inspect-scan-844x390-hold-hints.png` | Landscape hold caption on one line below the photo |
| `inspect-scan/inspect-scan-844x390-hold-status.png` | Landscape viewing-reference badge below the photo |
| `inspect-scan/inspect-scan-results-390x844.png` | Portrait results; comparison image centered; no fullscreen control |
| `inspect-scan/inspect-scan-results-844x390.png` | Landscape phone results; image centered (not left-aligned) |
| `inspect-scan/inspect-scan-results-932x430.png` | Larger landscape phone results; image centered |
| `inspect-scan/inspect-scan-center.txt` | Left/right gaps per viewport |
| `inspect-scan/inspect-scan-zoom-overflow.txt` | At scale ~2.75: layer extends beyond the frame, no ancestor overflow hidden/clip, short viewport axis covered |
| `inspect-scan/inspect-scan-844x390-zoom.png` | Inline pinch on landscape 844×390 |
| `inspect-scan/inspect-scan-932x430-zoom.png` | Inline pinch on 932×430 |
| `inspect-scan/inspect-scan-390x844-zoom-blink.png` | After pinch, long-press shows the baseline at the same zoom (portrait) |
| `inspect-scan/inspect-scan-844x390-zoom-blink.png` | Zoomed blink-compare at 844×390 |
| `inspect-scan/inspect-scan-932x430-zoom-blink.png` | Zoomed blink-compare at 932×430 |
| `inspect-scan/inspect-scan-rotate-offset.txt` | After portrait↔landscape rotates, scrollX is 0 and document width matches the viewport |
| `inspect-scan/inspect-scan-rotate-*.png` | Results screen after each orientation change (no left white strip) |
| `establish-baseline/establish-baseline-rotate-offset.txt` | Same offset asserts on the capture screen |
| `inspect-scan/inspect-scan.aria.txt` | ARIA tree includes **Conferma e concludi l'ispezione** |
| `inspect-scan/first-capture-comparison.txt` | First capture with an existing baseline ran comparison (PR #6) |
| `multi-shelf/multi-shelf-2-empty-baseline.png` | Shelf 2 selected with no baseline yet |
| `inspect-scan-cross-platform/cross-platform-report.txt` | Per-device pinch overflow: iPhone 14/15 Pro Max (WebKit) + Pixel 7/Galaxy S9+ (Chromium), portrait + landscape |
| `inspect-scan-cross-platform/<device>/inspect-scan-*-pinch-frame-*.png` | Per-device pinch animation frames |
| `inspect-scan-cross-platform/<device>/inspect-scan-*-hold-frame-*.png` | Per-device hold press/ring animation frames |
| `inspect-scan-cross-platform/<device>/inspect-scan-*-hold-status.png` | Per-device viewing-reference badge below the photo |
| `inspect-scan-cross-platform/<device>/inspect-scan-*-hold-geometry.txt` | Per-device hold/status vs image intersection asserts |
| `inspect-scan-cross-platform/<device>/inspect-scan-*-zoom.png` | Zoomed comparison image on that device profile |

Standards:

- Use the **gallery upload path** for scans (same as choosing a photo from the library), not mocked React state.
- Capture **action + outcome** (upload → results view), not only the idle camera.
- Record which **feature id** and **entry point** you drove in commit/PR notes.

Fixtures (repo-bundled): `public/test-fixtures/baseline-aligned.jpg`, `public/test-fixtures/capture-displaced.jpg`.

## Cleanup

Stop only the preview **you** started:

```bash
.cursor/skills/verify-shelfguard/bin/stop-verify-server.sh
```

Do **not** kill processes by name. Evidence under `/opt/cursor/artifacts/verify-shelfguard/` is kept after cleanup.

## Helpers

| Script | Purpose |
|--------|---------|
| [bin/launch-verify-server.sh](./bin/launch-verify-server.sh) | `npm run build` + preview on `:4173`, PID file |
| [bin/stop-verify-server.sh](./bin/stop-verify-server.sh) | Stop preview from PID file |
| [bin/control-shelfguard.mjs](./bin/control-shelfguard.mjs) | `doctor`, `browser drive <feature>`, `browser snapshot` |

Keep the map current with **`/maintain-verification-skill`** when flows or selectors change.
