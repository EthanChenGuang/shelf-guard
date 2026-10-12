---
phase: quick-261012-ozp
plan: 1
type: execute
wave: 1
depends_on: []
autonomous: true
requirements:
  - QUICK-261012-ozp
files_modified:
  - src/hooks/usePinchPanZoom.ts
  - src/hooks/usePinchPanZoom.test.ts
  - src/hooks/useBlinkCompareHold.ts
  - src/hooks/useLayoutViewportLock.ts
  - src/hooks/useLayoutViewportLock.test.ts
  - src/components/ResultInspectView.tsx
  - src/components/ResultInspectView.zoom.test.tsx
  - src/App.tsx
  - src/index.css
  - index.html
  - .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs
  - .cursor/skills/verify-shelfguard/SKILL.md
  - .cursor/skills/verify-shelfguard/features/inspect-scan.md
  - .cursor/cloud-agent-install.sh
  - .cursor/environment.json
  - .cursor/android-emulator.md
estimate:
  tokens: 28000
  raw_tokens: 28000
  tasks: 3
  confidence: high
must_haves:
  truths:
    - "Pinch on results does not toggle blink-compare (no src flicker) while 2+ fingers are down or when one of two fingers lifts"
    - "usePinchPanZoom onTouchEnd is remaining-touch aware; preventDefault works via non-passive listeners so the PAGE does not pinch-zoom"
    - "After portrait/landscape rotation on capture AND results, scrollX is 0 and document width equals viewport width (no left white strip)"
    - "Stay on cursor/inspect-fullscreen-image-c203 (PR #8); do not merge"
  artifacts:
    - "src/hooks/usePinchPanZoom.ts — remaining-touch + native non-passive preventDefault"
    - "src/hooks/useLayoutViewportLock.ts — scrollTo(0,0) + overflow-x lock on orientationchange"
    - ".cursor/android-emulator.md — what actually worked for AVD + mobile-mcp"
  key_links:
    - "ResultInspectView hold.end only when touches.length === 0"
    - "App mounts useLayoutViewportLock for every screen"
---

<objective>
Stop results pinch-zoom flicker (blink-compare vs multi-touch / page-zoom fighting the image transform) and the post-rotation left white strip / content shift on capture and results. Prefer a real Android emulator + mobile-mcp; fall back to verify-shelfguard with flicker counters and orientation asserts. Stay on PR #8; do not merge.
</objective>

<context>
User confirmed on iPhone Edge that fullscreen is gone and inline pinch works. Two new bugs:
1. Pinch-zooming the results image sometimes flickers continuously — first finger starts blink hold, second finger cancels, onTouchEnd always idles/ends hold even with remaining fingers, and React touch handlers are passive so preventDefault cannot stop Safari page-zoom. Page zoom + image transform fighting = flicker; leftover page pan after rotate = white strip.
2. After landscape → portrait → landscape, a white strip appears on the left and content is shifted right (screenshot is the camera screen in portrait). Check ALL screens.

Stay on git branch cursor/inspect-fullscreen-image-c203. CameraView Fullscreen API toggle stays.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Stop pinch flicker and lock layout after rotate</name>
  <files>src/hooks/usePinchPanZoom.ts, src/hooks/usePinchPanZoom.test.ts, src/hooks/useLayoutViewportLock.ts, src/hooks/useLayoutViewportLock.test.ts, src/components/ResultInspectView.tsx, src/components/ResultInspectView.zoom.test.tsx, src/App.tsx, src/index.css, index.html</files>
  <behavior>
    - Two-finger pinch never sets isBlinking; lifting one of two fingers does not toggle blink
    - Pinch continues (or re-anchors) when a remaining finger is down; scale does not reset to 1 on partial touchend
    - Native non-passive touchmove preventDefault on the results viewport
    - After simulated orientationchange, window.scrollX === 0 and documentElement.scrollWidth &lt;= innerWidth
  </behavior>
  <action>
    Make usePinchPanZoom: remaining-touch-aware onTouchEnd; rAF-coalesce setTransform; optional element ref with {passive:false} listeners that preventDefault on 2+ touches. ResultInspectView: hold.begin only for a single finger while not pinching; hold.end/cancel only when touches.length === 0 (2+ always cancel). Add useLayoutViewportLock in App: on orientationchange/resize/visualViewport scroll, scrollTo(0,0) and overflow-x hidden on html/body/#root. CSS: html,body,#root overflow-x hidden, width 100%, touch-action pan-y (viewport keeps touch-none). GREEN tests then one commit.
  </action>
  <verify>
    <automated>npm --prefix /workspace test -- src/hooks/usePinchPanZoom.test.ts src/hooks/useLayoutViewportLock.test.ts src/components/ResultInspectView.zoom.test.tsx src/hooks/useBlinkCompareHold.test.ts</automated>
  </verify>
  <done>Pinch + partial touchend does not blink; layout lock test passes; tsc/lint clean.</done>
</task>

<task type="auto">
  <name>verify-shelfguard flicker + orientation asserts; emulator bootstrap docs</name>
  <files>.cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs, .cursor/skills/verify-shelfguard/SKILL.md, .cursor/skills/verify-shelfguard/features/inspect-scan.md, .cursor/cloud-agent-install.sh, .cursor/environment.json, .cursor/android-emulator.md</files>
  <action>
    inspect-scan: during pinch, count data-showing-baseline / image src toggles (must be 0) and transform resets to scale 1 (must be 0); rapid 1↔2 finger sequences. After setViewportSize portrait↔landscape↔portrait on camera AND results, assert scrollX === 0, documentElement.clientWidth === innerWidth (no horizontal gap). Screenshots. Document emulator setup; extend cloud-agent-install.sh only with what actually worked. Stay on this branch, push PR #8, do not merge.
  </action>
  <verify>
    <automated>npm --prefix /workspace test && /workspace/.cursor/skills/verify-shelfguard/bin/launch-verify-server.sh && node /workspace/.cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs doctor --url http://127.0.0.1:4173 --pid-file /tmp/shelfguard-verify.pid</automated>
  </verify>
  <done>Harness asserts no-flicker and no-offset; emulator notes record what actually ran.</done>
</task>

</tasks>
