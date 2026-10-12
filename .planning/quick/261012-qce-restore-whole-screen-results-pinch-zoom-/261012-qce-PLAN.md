---
phase: quick-261012-qce
plan: 1
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  - src/components/ResultInspectView.tsx
  - src/components/ResultInspectView.zoom.test.tsx
  - src/hooks/useLayoutViewportLock.ts
  - src/index.css
  - .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs
  - .cursor/skills/verify-shelfguard/SKILL.md
  - .cursor/skills/verify-shelfguard/features/inspect-scan.md
estimate:
  tokens: 18000
  tasks: 2
  confidence: high
must_haves:
  truths:
    - "At rest the comparison image stays mx-auto in its frame; no fullscreen overlay"
    - "While pinch scale > 1 the zoomed photo paints over the phone (not clipped to the frame); z-index above header/chips; overflow restores at scale 1"
    - "AR overlays, blink-compare, no flicker, no rotate white strip, no page scroll still hold"
---

<objective>
Restore whole-screen results pinch-zoom: the zoomed comparison image must overflow its frame and cover the viewport, not clip to overflow-hidden. Keep no fullscreen overlay, rest centering, AR+blink, no flicker, no rotate white strip.
</objective>

<tasks>
<task type="auto" tdd="true">
  <name>Unclip zoomed results image over the viewport</name>
  <files>src/components/ResultInspectView.tsx, src/components/ResultInspectView.zoom.test.tsx, src/hooks/useLayoutViewportLock.ts, src/index.css</files>
  <action>
    At rest keep overflow-hidden on the frame. When scale &gt; 1: overflow-visible + z-[60] on the viewport/zoom layer; set data-inspect-zoomed on documentElement; lift html/body/#root/App overflow-x clipping so the CSS transform can paint over header and chips. Reset when scale returns to 1. useLayoutViewportLock must not re-apply overflow-x hidden while zoomed. Tests: after pinch, zoom layer bounding rect extends beyond the frame and overflow of ancestors is visible.
  </action>
  <verify>
    <automated>npm --prefix /workspace test -- src/components/ResultInspectView.zoom.test.tsx src/hooks/useLayoutViewportLock.test.ts src/hooks/usePinchPanZoom.test.ts</automated>
  </verify>
  <done>Zoomed image is not clipped to the frame; at scale 1 clip/centering return.</done>
</task>
<task type="auto">
  <name>verify-shelfguard: zoom covers viewport, not clipped</name>
  <files>.cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs, .cursor/skills/verify-shelfguard/SKILL.md, .cursor/skills/verify-shelfguard/features/inspect-scan.md</files>
  <action>
    After pinch to ~2.75, assert zoom-layer getBoundingClientRect extends beyond the frame, covers the viewport (large intersection), and no ancestor overflow is hidden/clip. Screenshots portrait and landscape. Keep prior flicker, blink, centering, rotate offset asserts. Full tests + doctor + three drives. Push PR #8, do not merge.
  </action>
</task>
</tasks>
