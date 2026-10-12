---
phase: quick-261012-hld
plan: 1
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  - src/index.css
  - src/components/ResultInspectView.tsx
  - src/components/ResultInspectView.zoom.test.tsx
  - .cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs
  - .cursor/skills/verify-shelfguard/SKILL.md
  - .cursor/skills/verify-shelfguard/features/inspect-scan.md
estimate:
  tokens: 12000
  tasks: 2
  confidence: high
must_haves:
  truths:
    - "Hold hint (animation + Tieni premuto) and viewing-reference badge sit below the comparison frame and never intersect the image rect"
    - "Both are fully inside the viewport in portrait and landscape; landscape shrinks the image so the strip fits without overflow"
    - "Pinch overlay stays on the image; pinch zoom, blink-compare, centering, rotation lock, flicker fix, reduced-motion still hold"
---

<objective>
Move the hold-to-reference hint and the "Stai vedendo la foto di riferimento" status below the comparison image so they never cover the photo, in portrait and landscape.
</objective>

<tasks>
<task type="auto" tdd="true">
  <name>Hold caption below the image frame</name>
  <files>src/index.css, src/components/ResultInspectView.tsx, src/components/ResultInspectView.zoom.test.tsx</files>
  <action>
    Lift inspect-hold-hint out of the image viewport into a reserved strip below the frame (pointer-events none, animated finger/ring + pill). Same strip shows goldenBaseline while blinking. Pinch overlay stays on the photo. Shrink frame max-height (CSS --inspect-frame-max) so image + strip fit in the viewport, especially landscape. Tests: hold is not a descendant of the viewport; Italian copy; viewing-reference text while holding; zoom/blink/reduced-motion still pass.
  </action>
  <verify>
    <automated>./node_modules/.bin/vitest run src/components/ResultInspectView.zoom.test.tsx && ./node_modules/.bin/tsc --noEmit</automated>
  </verify>
  <done>Hold hint and viewing-reference badge are below the photo; pinch overlay unchanged.</done>
</task>
<task type="auto">
  <name>verify-shelfguard geometry on iOS and Android</name>
  <files>.cursor/skills/verify-shelfguard/bin/control-shelfguard.mjs, .cursor/skills/verify-shelfguard/SKILL.md, .cursor/skills/verify-shelfguard/features/inspect-scan.md</files>
  <action>
    Assert hold/status bounding rects do not intersect the image rect and are fully inside the viewport. Screenshots before press and while pressing, portrait and landscape. Drive inspect-scan and inspect-scan-cross-platform (iPhone 14, 15 Pro Max WebKit; Pixel 7, Galaxy S9+ Chromium). Full tests + tsc. Push PR #8, do not merge.
  </action>
</task>
</tasks>
