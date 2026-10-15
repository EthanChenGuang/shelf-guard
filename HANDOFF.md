# HANDOFF — results-page vertical scroll fix (PR #12, `feat/zoom-mode-magnifier`)

2026-10-15 · Nothing pushed, merged or deployed.

## Done

- **Root cause:** see `.planning/scroll-bug-rootcause.md`.
  - The main cause is `useLayoutViewportLock`. It called `window.scrollTo(0, scrollY)` and set html/body `scrollLeft` on every window `resize` and visualViewport `resize`/`scroll`, immediately, again in rAF, and again at +50/+250 ms.
  - Those events fire on every frame while a phone's URL bar or Safari toolbar collapses during a swipe. The result was 48 to 96 programmatic scrolls per gesture, which cancels momentum and snaps the page back.
  - Contributing: `overflow-x: hidden` on html, body, #root and both app wrappers forced `overflow-y: auto`, leaving 4 nested non-scrolling scroll containers, plus `overscroll-behavior: none` on body and #root.
  - Contributing: app-lifetime non-passive `touchstart`/`touchmove` capture listeners on `document`.
  - Scroll failed before zoom as well, and on the whole page, not just the photo.
  - The content really is taller than the viewport, by about 350 px on every device and orientation. Nothing was injected.
- **Fix:**
  - `src/index.css`: `html` keeps `overflow-x: hidden`, `overscroll-behavior: none` and `touch-action: pan-y`; `body` and `#root` use `overflow-x: clip`.
  - `index.html`: `overscroll-none` removed from body.
  - `App.tsx` and `ResultInspectView.tsx` root: `overflow-x-hidden` → `overflow-x-clip`. The results header and filter HUD go from `sticky` to `relative`, which keeps their pre-fix behaviour of scrolling away.
  - `useLayoutViewportLock.ts`: only acts on `orientationchange`, calls `scrollTo({ left: 0 })` only if `scrollX !== 0`, has no resize/visualViewport handlers and no document touch listeners. It still prevents `gesturestart`/`gesturechange`.
- **Tests:**
  - `useLayoutViewportLock.test.ts` rewritten: resize and visualViewport never scroll, orientationchange only fixes `scrollX`, no document touch listeners.
  - `ResultInspectView.zoom.test.tsx`: an idle swipe is never `defaultPrevented` and it cancels the hold.
  - `npm test`: 58 files, 293 tests pass. `npm run lint` is clean.
- **Harness** (`.cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs` and docs): no injected height, and every scroll row reports the natural `scrollHeight`/`innerHeight`/`room`. New checks:
  - `a-img`/`a-page`: scroll before zoom, swipe starting on the photo or off it.
  - `g-img`/`g-page`: the same after X exit.
  - `h-fight`: zero programmatic scrolls while the viewport resizes mid-scroll.
  - Chromium uses trusted CDP touch swipes and asserts on `window.scrollY`. WebKit uses a static proof with no `scrollBy`: pan-y chain, no nested user-scrollable box, no app non-passive touch listener (`addEventListener` instrumented at init, Playwright's injected listeners excluded by stack origin), no html/body lock.
  - `mouse.wheel` (refused on mobile WebKit) and `synthesizeScrollGesture` (a no-op in headless Chromium) are attempted and recorded in the report header.

## Pre-fix FAIL vs post-fix PASS (final harness)

Pre-fix = build of `0d95ae2`. Post-fix = working tree.

| device / orientation | pre-fix a-img, a-page, h-fight, g-img, g-page | post-fix (all checks) |
|---|---|---|
| iPhone 14 portrait / landscape (WebKit) | FAIL | PASS |
| iPhone 15 Pro Max portrait / landscape (WebKit) | FAIL | PASS |
| Pixel 7 portrait / landscape (Chromium) | FAIL | PASS |
| Galaxy S9+ portrait / landscape (Chromium) | FAIL | PASS |
| inspect-scan 390×844, 844×390, 932×430 | FAIL | PASS |

The other checks passed both pre- and post-fix: b (zoom enter), c (pinch), d-x/d-esc/d-back, e-idle/e-zoom (hold), f (Italian hint), center, c2 and rotate. Totals: pre-fix cross-platform 72 pass / 40 fail and inspect-scan 29/15, both exit 1. Post-fix 112/0 and 44/0, both exit 0. Doctor and establish-baseline pass, including the rotate offsets.

Artifacts:
- `/opt/cursor/artifacts/verify-shelfguard/1792048803/` — `post-fix/` holds doctor, establish-baseline, inspect-scan and inspect-scan-cross-platform; `pre-fix` links to `…/1792048325/pre-fix`.

## How to verify

```bash
npm run lint && npm test
.cursor/skills/verify-shelfguard/bin/launch-verify-server.sh
H=.cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs; ART=/opt/cursor/artifacts/verify-shelfguard/$(date +%s)
node $H doctor --url http://127.0.0.1:4173 --pid-file /tmp/shelfguard-verify.pid
node $H browser drive establish-baseline --url http://127.0.0.1:4173 --artifacts-dir $ART/establish-baseline
node $H browser drive inspect-scan --url http://127.0.0.1:4173 --artifacts-dir $ART/inspect-scan
SHELFGUARD_WEBKIT_PLAYWRIGHT=/tmp/pw/node_modules/playwright node $H browser drive inspect-scan-cross-platform --url http://127.0.0.1:4173 --artifacts-dir $ART/inspect-scan-cross-platform
.cursor/skills/verify-shelfguard/bin/stop-verify-server.sh
```

**Real device (required):** on an iPhone (Safari) and an Android phone (Chrome), open the results page and swipe up, starting on the photo and then below it. The page should scroll smoothly while the URL bar collapses, with momentum and no snap-back. Then open zoom with 🔍, pinch, close with X, and swipe again. Rotate the phone and check there is no white strip on the left.

## Next / open questions

- **Real-device confirmation is still needed.** Headless engines cannot reproduce the freeze: no toolbar, no trusted WebKit touch, and Chromium's main-thread scroll stays in sync. The harness proves the mechanisms are gone, not that Safari's compositor scrolls.
- Do we want the results header and filter HUD to be sticky? They never actually stuck before. Making them sticky now would cover about 110 px of a 340 px landscape screen, including the magnifier, so they are `relative` for now.
- `html { touch-action: pan-y }` (pre-existing) also blocks horizontal swipes on the overflowing filter-chip row. This is unchanged here.
- `overflow-x: clip` needs Safari 16+ and Chrome 90+. Older engines fall back to `visible`, and `html { overflow-x: hidden }` still catches horizontal overflow.
- While this work was in progress, the `wip:` commits `6c6dceb` and `ad0ba9c` appeared on the branch, made by something other than this session. A `vite preview` on :4174 from the main repo was also not started by this session. Squash or reword the commits before pushing as you see fit.
- Harness hygiene (pre-existing, not fixed): `stop-verify-server.sh` kills only the `npm` wrapper PID, so the `vite preview` child keeps running. When :4173 is busy, `launch-verify-server.sh` reports "ready" even though the new vite moved to :4174 or later. This session's orphans are killed. `vite preview` pid 309730 (from `/workspace/shelf-guard`, started before this session) is still on :4173 and was left alone. Suggested fix: `--strictPort` and kill the process group.
