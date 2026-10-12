# ShelfGuard verification map

Maintained recipes for user-visible behavior. Read this index before driving the app, then open the feature file for exact steps.

## Baseline preconditions

- Preview at `http://127.0.0.1:4173` started via `.cursor/skills/verify-shelfguard/bin/launch-verify-server.sh`
- Playwright Chromium installed (`node node_modules/playwright/cli.js install chromium`)
- `control-shelfguard doctor` passes for that URL and `/tmp/shelfguard-verify.pid`
- Each drive uses a **new** browser context (empty IndexedDB)
- Do not drive a preview instance started outside this verification run

## Driving conventions

- Default UI locale is **Italian**; use `aria-label` strings from `I18N.it` unless testing language toggle
- Prefer `data-testid` (`camera-view`, `baseline-photo-input`, `gallery-input`, `baseline-status-pill`, `shelf-selector`) and stable ARIA names over CSS
- File uploads stand in for camera capture (headless-friendly, matches “pick from library” UX)
- Block service workers in Playwright (`serviceWorkers: 'block'`) to avoid stale SW during verification
- After mutations, rely on the next fresh context for isolation; do not delete proof artifacts during cleanup

## Proof and skip reporting

- UI proof: screenshot **and** ARIA snapshot where the harness provides them
- Record **feature id**, **URL** (`:4173` preview), and **entry point** (gallery vs shutter) with artifacts
- If OpenCV is unreachable, report doctor failure and the `/opencv/opencv.js` response — do not mark `inspect-scan` as passed
- Do not substitute a different entry point and claim another listed path was verified

## Feature entry contract

Each feature file: H1 title, one intro paragraph, then H2 sections **`Sub-features`**, **`How to get to it (user POV)`**, **`Driving it with control-shelfguard`**, **`Gotchas`** (in that order).

## Features

- [Establish baseline](./establish-baseline.md) — first reference photo per shelf via library upload
- [Inspect scan (gallery)](./inspect-scan.md) — compare a capture against baseline through OpenCV worker
- [Multi-shelf switch](./multi-shelf.md) — five shelf slots with independent baselines
- [Language toggle](./language-toggle.md) — cycle IT / EN / CN from the camera header
