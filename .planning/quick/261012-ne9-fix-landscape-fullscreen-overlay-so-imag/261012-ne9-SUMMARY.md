---
phase: quick-261012-ne9
plan: 1
subsystem: inspect-ui
tags: [visualViewport, contain-fit, fullscreen, playwright, webkit, address-bar]

requires:
  - phase: cursor/inspect-fullscreen-image-c203
    provides: visual-viewport overlay and cover-crop fullscreen comparison
provides:
  - readVisibleViewport min(innerHeight, 100svh, visualViewport.height) with top = max(offsetTop, innerHeight - height)
  - containViewportStyle letterbox of the comparison photo
  - inspect-scan chrome simulation (56px persistent top bar) and overlay/close/hint/canvas-inside-visible-box asserts
affects: [inspect-fullscreen, verify-shelfguard]

actuals:
  tokens: 7064
  tasks: 2
  commits: 6
plan_head_before: d926e65c8918a5e065988f929e585b82ce895bed

tech-stack:
  added: []
  patterns:
    - "Visible overlay rect is min() of inner, CSS small-viewport probe, and visualViewport, then top/left = max(offset, inner - size) so a WebKit lie still parks below chrome"
    - "Fullscreen photo uses contain-fit pixel boxes with reserved padding for close (56) and hint (40), never CSS viewport units"

key-files:
  created: []
  modified:
    - src/hooks/useVisualViewport.ts
    - src/hooks/useVisualViewport.test.ts
    - src/lib/frameBox.ts
    - src/lib/frameBox.test.ts
    - src/components/InspectShelfCanvas.tsx
    - src/components/InspectImageFullscreen.tsx
    - src/components/ResultInspectView.fullscreen.test.tsx
    - .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs
    - .cursor/skills/verify-shelfguard/SKILL.md

key-decisions:
  - "D-01 contain-fit with CLOSE_RESERVE_PX 56 and HINT_RESERVE_PX 40 so AR labels are not cover-cropped"
  - "D-02 height = min(innerHeight, measured 100svh, visualViewport.height); top = max(offsetTop, innerHeight - height)"
  - "D-03 requestElementFullscreen stays best-effort on open and does not gate the overlay"
  - "D-04 Playwright injects a WebKit lie (visualViewport offsetTop 0 / height === innerHeight), stubs the 100svh probe to innerHeight-56, paints a 56px address bar, and asserts overlay/close/hint/canvas against that visible box"
  - "Follow-up: iOS overlay chrome fallback (56px) only when every metric still reports the full layout viewport"

patterns-established:
  - "Non-positive CSS small-viewport probe values are treated as absent so a failed 100svh measure cannot collapse min()"
  - "InspectShelfCanvas layout 'contain' reuses the coverViewport pixel-box prop; results page stays fill"

requirements-completed: [QUICK-261012-ne9]

coverage:
  - id: D-01
    description: "Fullscreen overlay contain-fits the whole comparison photo plus close and hint inside the visible area"
    requirement: QUICK-261012-ne9
    verification:
      - kind: unit
        ref: "src/lib/frameBox.test.ts#letterboxes a landscape photo into numeric px inside the box"
        status: pass
      - kind: unit
        ref: "src/components/ResultInspectView.fullscreen.test.tsx#sizes the WebKit-lie overlay to the measured small viewport and contain-fits the photo"
        status: pass
      - kind: e2e
        ref: "verify-shelfguard inspect-scan /tmp/shelfguard-inspect-scan-ne9/inspect-scan-fullscreen-844x390.png"
        status: pass
    human_judgment: false
  - id: D-02
    description: "Overlay height is min(innerHeight, measured 100svh, visualViewport.height) and top is max(offsetTop, innerHeight - height)"
    requirement: QUICK-261012-ne9
    verification:
      - kind: unit
        ref: "src/hooks/useVisualViewport.test.ts#parks below a WebKit-lie address bar using measured 100svh"
        status: pass
      - kind: unit
        ref: "src/hooks/useVisualViewport.test.ts#uses truthful visualViewport chrome when small-viewport is the full inner height"
        status: pass
    human_judgment: false
  - id: D-03
    description: "Opening fullscreen still best-effort requests Fullscreen API; overlay sizing does not depend on it succeeding"
    requirement: QUICK-261012-ne9
    verification:
      - kind: unit
        ref: "src/components/ResultInspectView.fullscreen.test.tsx#opens the overlay when documentElement.requestFullscreen rejects"
        status: pass
    human_judgment: false
  - id: D-04
    description: "verify-shelfguard inspect-scan injects persistent top chrome and asserts overlay, close, hint, and canvas sit in the visible box"
    requirement: QUICK-261012-ne9
    verification:
      - kind: e2e
        ref: "node .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs browser drive inspect-scan --artifacts-dir /tmp/shelfguard-inspect-scan-ne9"
        status: pass
    human_judgment: false
  - id: D-05
    description: "On a physical iOS Edge/Safari phone with a persistent top address bar, landscape fullscreen letterboxes the whole photo, close, and hint"
    requirement: QUICK-261012-ne9
    verification: []
    human_judgment: true
    rationale: "Playwright injects synthetic visualViewport chrome in Chromium; WebKit's real address-bar lie (offsetTop 0 while chrome still covers the top) still needs a human on a physical iPhone."

duration: 6min
completed: 2026-10-12
status: complete
---

# Phase quick-261012-ne9 Plan 1: Landscape fullscreen overlay Summary

**Contain-fit comparison fullscreen sized to the real visible rect (min of innerHeight, 100svh, visualViewport) so WebKit address-bar chrome no longer cover-crops AR labels.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-12T16:56:18Z
- **Completed:** 2026-10-12T17:03:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- `readVisibleViewport` parks the overlay below a WebKit lie (offsetTop 0, visualViewport.height ≈ innerHeight, measured 100svh shorter) and matches truthful chrome.
- `containViewportStyle` letterboxes the photo into a pixel box; `InspectShelfCanvas` layout `contain` uses it in fullscreen with 56px close and 40px hint reserves.
- `requestElementFullscreen` remains a fire-and-forget call; the dialog still opens when it rejects.
- iOS fallback insets 56px when visualViewport and 100svh both still equal innerHeight (the real-phone case where every API lies).
- verify-shelfguard inspect-scan simulates the WebKit lie (not a truthful visualViewport wrap), paints a 56px address bar, stubs the 100svh probe, and asserts overlay/close/hint/canvas against the visible box. Full skill e2e after merging main: doctor + establish-baseline + inspect-scan + multi-shelf all ok. Artifacts: `/opt/cursor/artifacts/verify-shelfguard/ne9-main`.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end visible-rect overlay that contain-fits the whole photo under phone chrome** - `c4c2d0f` (fix)
2. **Task 2: Inject persistent address-bar chrome into verify-shelfguard inspect-scan** - `2652a8b` (test)
3. **Follow-up: iOS inset when every viewport API lies** - `571bcab` (fix)
4. **Follow-up: WebKit-lie e2e (not truthful visualViewport) + painted bar** - `e433f7a` (test)
5. **Merge origin/main (PRs #6, #7, #9)** - `ef34dce`
6. **Hide fake bar during results screenshots** - `7d831d9` (test)

## Files Created/Modified

- `src/hooks/useVisualViewport.ts` - `readVisibleViewport` + CSS small-viewport probe; hook re-reads on visualViewport resize/scroll and window resize/orientationchange
- `src/hooks/useVisualViewport.test.ts` - WebKit-lie, truthful chrome, and non-positive probe fallback
- `src/lib/frameBox.ts` - `containViewportStyle` letterbox; cover math unchanged
- `src/lib/frameBox.test.ts` - contain-fit cases plus cover still taller than the landscape box
- `src/components/InspectShelfCanvas.tsx` - layout `contain`
- `src/components/InspectImageFullscreen.tsx` - visible-rect overlay, contain layout, hint testid
- `src/components/ResultInspectView.fullscreen.test.tsx` - WebKit-lie overlay, contain, requestFullscreen reject, pinch-hold blink
- `.cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs` - `simulatePersistentTopChrome` + visible-box asserts
- `.cursor/skills/verify-shelfguard/SKILL.md` - inspect-scan-fullscreen evidence rows

## Decisions Made

- Followed D-01/D-02/D-03/D-04 as locked in the plan. Width/left mirror the height/top min/max using measured 100svw, visualViewport.width, innerWidth, and offsetLeft.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for PR #8 review on `cursor/inspect-fullscreen-image-c203`.
- Remaining human check: physical iOS Edge/Safari landscape with a persistent top address bar.

## TDD Gate Compliance

Task 1 is `tdd="true"` on an `type: execute` plan (not `type: tdd`). RED: new WebKit-lie / contain-fit assertions failed as intended (`gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, target `parks below a WebKit-lie address bar using measured 100svh`). GREEN: implementation made 21/21 tests pass. One atomic task commit of the seven files, as the plan's `<done>` required (not a separate `test()` then `feat()` pair).

## Verification

- `npm --prefix /workspace test` — 282 passed (57 files); overlay/viewport subset 25 passed
- `npm --prefix /workspace run lint` — tsc clean
- `launch-verify-server.sh` rebuild + doctor OK
- `browser drive establish-baseline` ok (Riferimento pronto)
- `browser drive inspect-scan` ok; zoomScale 2.75; center deltas 0.0; overlay.y ≥ 56 under painted WebKit-lie chrome on 390×844 / 844×390 / 932×430 / rotate-while-open
- `browser drive multi-shelf` ok (Scaffale 2)
- merged `origin/main` (PRs #6/#7/#9); PR #8 base retargeted to `main`
- `git branch --show-current` = `cursor/inspect-fullscreen-image-c203`

## Self-Check: PASSED

- All 9 key files exist on disk
- Commits `c4c2d0f` and `2652a8b` exist on `cursor/inspect-fullscreen-image-c203`
- SUMMARY `status: complete`

---
*Phase: quick-261012-ne9*
*Completed: 2026-10-12*
