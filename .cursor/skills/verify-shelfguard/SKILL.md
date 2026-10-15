---
name: verify-shelfguard
description: Drive ShelfGuard (Online Marketplace shelf inspection PWA) in a real browser — launch preview, set baselines, run gallery inspections, switch shelves. Use after UI, camera, vision, or IndexedDB changes when you need user-level proof, not just Vitest.
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

# WebKit on hosts Playwright 1.49 does not support (e.g. Debian 13): see features/inspect-scan-cross-platform.md
SHELFGUARD_WEBKIT_PLAYWRIGHT=/path/to/newer/node_modules/playwright \
node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive inspect-scan-cross-platform \
  --url http://127.0.0.1:4173 \
  --artifacts-dir "${ART}/inspect-scan-cross-platform"
```

`inspect-scan` and `inspect-scan-cross-platform` record every check as PASS/FAIL in their report and **exit 1 if any check fails** (the JSON on stdout lists `failures`).

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
| `inspect-scan/inspect-scan-360-portrait-header.png` | Camera header **Online Marketplace** on one line at 360×800 |
| `inspect-scan/inspect-scan-360-landscape-header.png` | Camera header on one line at 800×360 |
| `inspect-scan/inspect-scan-zoom-report.txt` | PASS/FAIL matrix for 390×844, 844×390, 932×430: `a-img`/`a-page` trusted touch swipe on / off the photo scrolls the window from the **natural** layout (scrollHeight vs innerHeight reported, nothing injected), `h-fight` zero programmatic scrolls while the viewport resizes mid-swipe (URL bar), (b) magnifier opens overlay, (c) pinch/pan, (d) X/Esc/Back exit + full style/scroll restore, `g-img`/`g-page` swipes scroll again after X, (e) hold → reference idle + zoom, (f) Italian hint below the photo; plus `c2` no-flicker and `rotate` |
| `inspect-scan/inspect-scan-<WxH>-hold-hints.png` / `-hold-frame-*.png` | Hint **Tocca 🔍 per ingrandire · Tieni premuto per il riferimento** on one line below the photo |
| `inspect-scan/inspect-scan-<WxH>-hold-status.png` / `-hold-geometry.txt` | **Stai vedendo la foto di riferimento** while holding; hint/status do not intersect the image |
| `inspect-scan/inspect-scan-<WxH>-zoom-enter.png` / `-zoom.png` / `-zoom-hold.png` | Overlay opened, pinched ~2.75× and panned, hold in zoom mode |
| `inspect-scan/inspect-scan-<WxH>-after-exit.png` | Results page after X — scroll position restored |
| `inspect-scan/inspect-scan-<WxH>-results.png` | Results with the photo centered and the magnifier on its corner |
| `inspect-scan/inspect-scan-rotate-offset.txt` / `-rotate-*.png` | After portrait↔landscape rotates, scrollX is 0 and document width matches the viewport |
| `establish-baseline/establish-baseline-rotate-offset.txt` | Same offset asserts on the capture screen |
| `inspect-scan/inspect-scan.aria.txt` | ARIA tree includes **Conferma e concludi l'ispezione** |
| `inspect-scan/first-capture-comparison.txt` | First capture with an existing baseline ran comparison (PR #6) |
| `multi-shelf/multi-shelf-2-empty-baseline.png` | Shelf 2 selected with no baseline yet |
| `inspect-scan-cross-platform/cross-platform-report.txt` | PASS/FAIL per device (iPhone 14 / 15 Pro Max on WebKit, Pixel 7 / Galaxy S9+ on Chromium) × orientation × check (`a-*`, `h-fight`, b–f, `g-*`); header states which input is trusted (CDP) vs synthetic/static (WebKit), and the `mouse.wheel` / `synthesizeScrollGesture` probe results. Command exits 1 on any FAIL |
| `inspect-scan-cross-platform/<device>/inspect-scan-<device>-<orientation>-*.png` | Per-device hint, hold status, zoom enter/pinch/hold and after-exit screenshots |

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
