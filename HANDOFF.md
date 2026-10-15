# HANDOFF — feat/larger-results-image

## Done
- Results photo (`inspect-image-viewport`) is now sized from the whole viewport. The page scrolls
  since PR #12, so the header/HUD no longer count against it:
  - `src/index.css`: `--inspect-frame-max = 100dvh - hint strip - (0.5rem + safe-area top/bottom)`
    (`100vh` fallback via `@supports`); new `--inspect-frame-gutter` = `max(1rem, safe-area-left/right)`
    each side; dropped `--inspect-chrome`.
  - `src/lib/frameBox.ts`: removed the 28rem cap; width = `min(100% - sideGutter, maxHeight * ratio)`
    (new optional `sideGutter` arg, default `0px`). `ResultInspectView` passes the gutter var.
  - `src/lib/frameBox.test.ts` updated.
- Harness (`.cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs`):
  - New check `i-image-size-no-hoverflow` (`size`): image WxH, viewport WxH, area %. FAIL if
    `scrollWidth > innerWidth` or the photo's right edge is past `innerWidth`. Also adds an
    "image size" table to the reports.
  - `f` (and the hold geometry check inside `e-idle`) now scroll the photo into view first:
    initial scroll if photo + hint fit, else photo top at the viewport top. They also require the
    hint to be directly below the photo (gap <= 32px). The old "hint in viewport at scrollY 0" rule
    can't hold once the photo is taller than the first screen.
- Size table: `.planning/larger-results-image.md`.
- Commits are local only. Nothing pushed, merged or deployed.

## Verify
- `npm run lint`, `npm test` (58 files / 294 tests) pass.
- Artifacts: `/opt/cursor/artifacts/verify-shelfguard/larger-results-image-20261015-104545/`
  - `before/` (main build): cross-platform 120/120 PASS, inspect-scan 47/47 PASS.
  - `after/`: doctor OK, establish-baseline "Riferimento pronto", inspect-scan 47/47 PASS,
    cross-platform 120/120 PASS.
  - `after-attempt1-0.5rem-gutter/`: the rejected first attempt (4 page-swipe FAILs).
- Re-run: preview on a free port (4173 belonged to another workspace's preview), e.g.
  `SHELFGUARD_VERIFY_PORT=4183 SHELFGUARD_VERIFY_PID_FILE=/tmp/x.pid launch-verify-server.sh`, then
  drive with `--url http://127.0.0.1:4183` (WebKit: `SHELFGUARD_WEBKIT_PLAYWRIGHT=/tmp/pw/node_modules/playwright`).

## Next
- Check on real devices (iOS Safari with toolbars, Android Chrome URL bar). `100dvh` changes as the
  URL bar collapses, so the photo grows slightly while scrolling.
- Optional: mention the `size` check in `.cursor/skills/verify-shelfguard/SKILL.md` evidence table.

## Open questions
- `dvh` (as requested) vs `svh`: `svh` keeps the photo size fixed while the toolbar collapses, at
  the cost of ~50–80px less height. Is the resize during scroll acceptable?
- Should there be an upper width cap on desktop/tablet for landscape photos? Height still bounds the
  photo, so on a wide desktop a 16:9 photo could reach ~1000px tall × 1780px wide.
- The `5734b4f wip:` commit on this branch wasn't made by the agent. It holds the 0.5rem-gutter
  version; the follow-up commit switches to 1rem. Squash before opening a PR if you like.
