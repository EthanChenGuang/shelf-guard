---
name: verify-shelfguard
description: Drive ShelfGuard (Online Market shelf inspection PWA) in a real browser — launch preview, set baselines, run gallery inspections, switch shelves. Use after UI, camera, vision, or IndexedDB changes when you need user-level proof, not just Vitest.
---

# Verify ShelfGuard

ShelfGuard is a **client-only React PWA** (`npm run dev` / Vite). Verification drives the **production preview** in Chromium via Playwright, using **file uploads** instead of a physical camera. Default UI language is **Italian** (`it`).

## Launch

From the repository root:

1. Install deps if needed: `npm install`
2. Install Playwright Chromium once: `node node_modules/playwright/cli.js install chromium`
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
| `inspect-scan/inspect-scan-results.png` | Full inspection result screen |
| `inspect-scan/inspect-scan-fullscreen.png` | Comparison analysis fullscreen overlay with annotations |
| `inspect-scan/inspect-scan.aria.txt` | ARIA tree includes **Conferma e concludi l'ispezione** and fullscreen dialog |
| `multi-shelf/multi-shelf-2-empty-baseline.png` | Shelf 2 selected with no baseline yet |

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
