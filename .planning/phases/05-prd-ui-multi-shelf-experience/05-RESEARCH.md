# Phase 5: PRD UI & Multi-Shelf Experience - Research

**Researched:** 2026-09-23
**Domain:** React 19 PWA UI — motion carousel, INITIAL_GUIDE FSM, Tailwind v4 design tokens, PRD camera chrome
**Confidence:** HIGH

## Summary

Phase 5 is a **brownfield UI polish phase** that activates PRD-fidelity chrome on top of Phase 2–4 data/FSM contracts. The codebase already has PRD-adjacent camera chrome (`CameraView.tsx`), a working shelf lifecycle (`handleShelfChange` → `loadShelfData`), and `INITIAL_GUIDE` in the `AppMode` union — but the mode is never assigned and shelf switching still uses segmented `ShelfSelector` buttons in the top bar.

Research confirms a **split gesture/animation architecture** is the correct pattern: detect horizontal swipes with lightweight pointer/touch handlers (50px threshold, axis-dominance check) and use **`motion`** only for shelf cross-fade/slide transitions on `activeShelfId` change. Using `motion` drag on the full viewport risks conflict with the vertical ghost-opacity slider (right edge) and ROI guides — pointer events on a dedicated gesture layer avoid this.

**Critical codebase gap:** CONTEXT.md references `motion` as "already in package.json" but **`motion` is not currently declared** in `package.json` (verified via workspace read). Phase 5 Wave 0 must add `motion@^13.4.2` before carousel work.

**Primary recommendation:** Extract `ShelfCarousel.tsx` (dots + swipe gesture layer) and `InitialGuideOverlay.tsx`; wire `resolveAppModeAfterShelfLoad(hasPersistedBaseline)` in `App.tsx`; centralize PRD colors in `src/index.css` `@theme`; refactor top bar to 3-zone PRD layout; extend existing Vitest patterns for carousel and INITIAL_GUIDE.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Horizontal shelf swipe + dot indicator | Browser / Client | — | Touch/pointer gestures and visual indicator live on camera viewport; no server involvement |
| Shelf cross-fade animation | Browser / Client | — | `motion`/`AnimatePresence` runs in React render tree on shelf key change |
| INITIAL_GUIDE overlay | Browser / Client | Application (App.tsx FSM) | Full-screen overlay in `CameraView` shell; mode entry/exit owned by `App.tsx` |
| PRD top bar (baseline pill / level / torch+lang) | Browser / Client | — | Presentational chrome in `CameraView`; state from App hooks |
| Minimalist Light design tokens | CDN / Static (CSS) | Client (optional `designTokens.ts`) | `@theme` in `index.css` generates Tailwind utilities project-wide |
| AppMode transitions (INITIAL_GUIDE ↔ CAMERA_IDLE) | Application Orchestration | Browser / Client | `App.tsx` decides mode after `loadShelfData`; components render per mode |
| I18N string coverage | Application (constants) | Browser / Client | `I18N` in `src/lib/constants.ts`; components consume via `lang` prop |
| Shutter breathing + scan line polish | Browser / Client | — | CSS keyframes in `CameraView` / `ScanningAnimationOverlay`; 800ms duration is STAB contract |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Shelf Swipe Carousel (SHLF-01)
- **D-01:** Replace top-bar segmented `ShelfSelector` buttons with a **horizontal swipe carousel** on the camera viewport — touch pan left/right (or pointer drag on desktop) switches shelves. Minimum horizontal delta **50px** with dominant horizontal axis; ignore vertical-dominant gestures to avoid conflict with ghost slider. — **Reversibility:** costly — `CameraView` layout and gesture layer become PRD contract.
- **D-02:** Swipe calls existing **`handleShelfChange(newShelfId)`** in `App.tsx` — same `saveActiveShelfId`, `loadShelfData`, and `objectUrlRegistry.revokeAll` path from Phase 2; no new storage API.
- **D-03:** **Active-shelf indicator:** centered **5-dot strip** below the PRD top bar (filled emerald `#10B981` active dot, outline inactive, `aria-current` on active). Optional shelf label chip: `柜架 N` / `Shelf N` from I18N. Remove `ShelfSelector` from top bar entirely.
- **D-04:** Use **`motion`** (already in `package.json`, currently unused) for shelf cross-fade / slide snap on change — spring with ~300ms duration. CSS scroll-snap acceptable as fallback for reduced-motion preference.
- **D-05:** Carousel works in **`CAMERA_IDLE` and `INITIAL_GUIDE`** only — disable swipe during `SCANNING_ANIM`, `PROCESSING`, `ROI_CONFIG`, `RESULT_INSPECT` to prevent mid-capture shelf bleed.
- **D-06:** Each shelf switch reloads ghost overlay and baseline state per Phase 3 rules (`hasPersistedBaseline`, live-only ghost) — extend Phase 3 integration tests for swipe path.

#### INITIAL_GUIDE Onboarding (SHLF-05)
- **D-07:** Wire **`INITIAL_GUIDE` AppMode** when active shelf has **`!hasPersistedBaseline`** on: app init landing, shelf switch to empty shelf, or return from audit on empty shelf. Per-shelf, not global first-run only. — **Reversibility:** costly — FSM entry conditions become UX contract with Phase 4 first-capture path.
- **D-08:** **Full-screen overlay** on camera shell (same `CameraView` container, not a new route) with **3 steps:** (1) welcome + shelf name, (2) alignment tips (ghost/level will apply after baseline exists), (3) primary CTA **「拍摄基准图」/ "Capture baseline"** → dismisses guide to `CAMERA_IDLE`.
- **D-09:** **No silent demo baseline** in INITIAL_GUIDE — do not render `DEFAULT_CALIBRATION` CDN image as the shelf feed. Show neutral dark placeholder with iconography + copy, or live camera if already enabled. Empty shelf demo feed must not masquerade as established baseline.
- **D-10:** Shutter on empty shelf after guide dismiss follows **Phase 4 first-baseline contract** — intercept to `ROI_CONFIG` with pending capture (no scan animation until baseline saved). INITIAL_GUIDE is pre-shutter education only; it does not replace ROI calibration.
- **D-11:** User can **skip guide** via secondary text button (`跳过` / `Skip`) — lands on `CAMERA_IDLE` with same empty-shelf rules. Skip preference **not persisted** (show guide again on next visit to that empty shelf until baseline exists).
- **D-12:** When shelf gains persisted baseline, **never show INITIAL_GUIDE** for that shelf again unless baseline cleared via reset flow.

#### Minimalist Light Design System (DSGN-01–DSGN-03)
- **D-13:** Centralize PRD tokens in **`src/index.css` `@theme` block** (Tailwind v4) and/or **`src/lib/designTokens.ts`** exporting named constants — single source for `#FFFFFF`, `#F8FAFC`, `#0F172A`, `#64748B`, `#E2E8F0`, `#10B981`, `#EF4444`, `#F59E0B`. Replace scattered arbitrary hex in touched components. — **Reversibility:** costly — token names become cross-view contract.
- **D-14:** **Glassmorphism control pattern** (DSGN-03) applied uniformly on floating UI: `rounded-2xl` or `rounded-full`, `backdrop-blur-md bg-white/75`, `shadow-sm`–`shadow-md`, `border border-[#E2E8F0]/60`. Audit all three views during implementation waves.
- **D-15:** **View background split:** Camera shell stays **dark** `#0F172A`; ROI setup and Result inspect use **light** `#F8FAFC` / `#FFFFFF` backgrounds per Minimalist Light PRD (align `RoiSetupView`, `ResultInspectView` wrappers).
- **D-16:** **Anomaly overlays (DSGN-02):** Missing = `#EF4444` **2px bold border** + **15% opacity red fill**; Displaced = `#F59E0B` **2px bold border** + **15% yellow fill**. Update `ResultInspectView` box styles; stat capsule dots match same hues.
- **D-17:** Typography: primary `#0F172A`, secondary `#64748B`; borders `#E2E8F0`. Success/ready accents `#10B981` (baseline pill, level snap, active shelf dot).

#### Stitch Visual Verification (DSGN-04)
- **D-18:** Planner produces **`05-UI-SPEC.md`** before implementation (via `/gsd-ui-phase 5` or plan-phase UI wave) documenting token table, component inventory, and PRD layout measurements (76px shutter, 80px magnifier, 0.8s scan).
- **D-19:** Store Stitch reference screenshots or export metadata under **`.planning/design/stitch/`** (create if missing) — three views: camera, ROI, result. Implementation acceptance = side-by-side screenshot checklist in phase UAT, not automated pixel diff in CI for v1.
- **D-20:** Use existing brownfield components as base — **polish in place** rather than rewrite-from-scratch unless layout contract cannot be met.

#### Camera Top Bar & Controls (CAM-04)
- **D-21:** PRD top bar layout: **Left** = baseline status pill (「基准图 · 已建立」/「未建立」with green pulse dot when established); **Center** = level micro-badge (`0.0°` mint when level, amber tilt otherwise — compact, non-interactive except existing simulate toggle on desktop); **Right** = torch (when supported + live camera) + language toggle (`中`/`EN`). — **Reversibility:** costly — top bar becomes visual signature.
- **D-22:** **Remove from top bar:** segmented shelf selector (→ carousel dots), Demo/Cam toggle (→ relocate), PWA install button (→ bottom-left utility chip or omit if install prompt handled by browser).
- **D-23:** **Demo/Cam toggle** moves to **bottom-left utility** small pill (below carousel dots) — retains CAM-01 demo path for QA without cluttering PRD chrome. Label via I18N (`t.useSampleFeed` / `t.useRealCamera`).
- **D-24:** Baseline pill tap opens existing **`ResetBaselineModal`** / recalibrate flow — no new modal type.

#### Shutter, Scan & Thumbnail (CAM-05, CAM-06)
- **D-25:** Shutter button **76px outer ring** with **double-ring** styling; **breathing glow** when ready (`CAMERA_IDLE`, `!isShutterLocked`, camera available) — CSS keyframe scale 0.98–1.02 + outer ring `animate-pulse` opacity. Disable breathing during scan/processing/locked.
- **D-26:** **Last inspection thumbnail** bottom-right: **48×48** `rounded-xl`, border `#E2E8F0`, tap opens history modal — align position relative to 76px shutter (existing bottom bar layout, PRD spacing).
- **D-27:** **Scan line (CAM-06):** Retain `ScanningAnimationOverlay` 0.8s cyan `#38BDF8` beam — polish gradient/glow to match PRD; optional `motion` enhancement only if CSS keyframe insufficient. Do not change 800ms duration (STAB-01/03 contract).
- **D-28:** Shutter flash overlay on tap (brief white fade) — add if missing for PRD capture feedback.

#### Internationalization (I18N-01, I18N-02)
- **D-29:** Audit **all user-visible strings** in `CameraView`, `RoiSetupView`, `ResultInspectView`, modals, INITIAL_GUIDE, carousel labels — extend **`I18N` in `src/lib/constants.ts`** with both `cn` and `en` entries. No new hardcoded UI strings in Phase 5 touched files.
- **D-30:** Add INITIAL_GUIDE step copy, baseline pill states (`established` / `not established`), shelf carousel labels, demo toggle, and any new top-bar strings.
- **D-31:** Language toggle persists via existing **`loadSavedLanguage` / `saveLanguage`** (IndexedDB `shelfguard_lang`) — verify new keys render immediately on toggle without reload.

#### Testing & Verification
- **D-32:** Component tests: carousel dot active state, INITIAL_GUIDE visibility when `!hasPersistedBaseline`, hidden when baseline exists, swipe disabled during non-idle modes.
- **D-33:** Integration test: swipe shelf B → shelf A isolation (extend Phase 2 pattern); switch to empty shelf → INITIAL_GUIDE shown.
- **D-34:** Manual UAT checklist: three-view Stitch screenshot comparison per DSGN-04.

### Claude's Discretion
- Exact `motion` spring parameters and reduced-motion fallbacks.
- INITIAL_GUIDE step indicator styling (dots vs progress bar).
- Whether to extract `ShelfCarousel.tsx` vs inline in `CameraView.tsx`.
- Demo toggle visibility rules on first launch vs returning user.
- Minor spacing tweaks within PRD measurements ±4px.

### Deferred Ideas (OUT OF SCOPE)
- **Homography / advanced alignment (VIS-07)** — v2.
- **Per-shelf language or tolerance** — not in requirements; remain global.
- **Delete-audit / storage management UI** — quota banner only; actionable clear deferred.
- **Persist INITIAL_GUIDE skip or ghost opacity** — optional v2.
- **Automated Stitch pixel-diff CI** — manual screenshot checklist sufficient for v1.
- **Next.js App Router migration** — v2+ per REQUIREMENTS Out of Scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DSGN-01 | Minimalist Light design tokens globally | `@theme` token table in Standard Stack; migrate touched components from arbitrary hex |
| DSGN-02 | State colors (success/missing/displaced) | Token names + ResultInspectView box pattern with 2px border + 15% fill |
| DSGN-03 | Glassmorphism control pattern | Reusable `glass-panel` utility class via `@utility` or documented Tailwind combo |
| DSGN-04 | Stitch visual alignment | Manual screenshot UAT; `05-UI-SPEC.md` wave before implementation |
| SHLF-01 | 5-shelf horizontal swipe + active indicator | `ShelfCarousel.tsx` + pointer swipe helper + motion cross-fade |
| SHLF-05 | INITIAL_GUIDE per empty shelf | `InitialGuideOverlay.tsx` + `resolveAppModeAfterShelfLoad` in App.tsx |
| CAM-04 | PRD top bar layout | 3-zone refactor in `CameraView.tsx`; remove ShelfSelector from top bar |
| CAM-05 | 76px breathing shutter + 48×48 thumbnail | CSS keyframes + size adjustment in bottom bar |
| CAM-06 | 0.8s scan line polish | Keep `ScanningAnimationOverlay` duration; enhance gradient/glow only |
| I18N-01 | Full three-view bilingual copy | Extend `I18N` keys; audit touched files for hardcoded strings |
| I18N-02 | Persisted language preference | Existing `saveLanguage`/`loadSavedLanguage`; re-render test on toggle |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` | **13.4.2** | Shelf cross-fade/slide on `activeShelfId` change | Official successor to Framer Motion; React 19 peer dep `^18 \|\| ^19`; `AnimatePresence` + `useReducedMotion` [CITED: motion.dev/docs/react-animate-presence] |
| React | **19.0.1** (installed) | UI + FSM | Brownfield stack; no migration [VERIFIED: package.json] |
| Tailwind CSS | **4.3.3** (installed) | PRD token utilities via `@theme` | v4 native `@theme` directive generates `bg-*`, `text-*` from `--color-*` [CITED: tailwindcss.com/docs/theme] |
| Vitest + Testing Library | **5.0.1** / **16.3.3** | Component + integration tests | Existing test infra; jsdom environment [VERIFIED: vitest.config.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native Pointer Events | — | Swipe detection (50px threshold) | Preferred over `motion` drag for viewport — avoids ghost slider conflict [CITED: motion.dev/docs/react-drag] |
| CSS `@keyframes` | — | Shutter breathing, scan beam (800ms) | STAB-01/03 locked duration; motion optional for scan only |
| `src/lib/designTokens.ts` | — (new) | JS/TS access to hex constants | When inline styles or canvas colors need tokens outside Tailwind |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pointer swipe + motion animate | Full `motion` drag on viewport | Drag conflicts with vertical ghost slider; motion drag default threshold is 3px not 50px |
| `@theme` tokens | `:root` CSS vars only | `:root` vars don't auto-generate Tailwind utilities [CITED: tailwindcss.com/docs/theme] |
| Extract `ShelfCarousel.tsx` | Inline in CameraView | Extraction recommended — gesture logic + a11y dots are testable in isolation |

**Installation (Wave 0 — motion missing from package.json):**

```bash
npm install motion@^13.4.2
```

**Version verification:**

```bash
npm view motion version          # 13.4.2 [VERIFIED: npm registry]
npm view motion peerDependencies # react ^18.0.0 || ^19.0.0 [VERIFIED: npm registry]
```

> **Research correction:** CONTEXT D-04 states motion is "already in package.json" — current `package.json` has **no `motion` dependency** [VERIFIED: package.json:14-23]. Planner must add install task in Wave 0.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `motion` | npm | published 2026-09-23 | ~15.4M/wk | github.com/motiondivision/motion | SUS | Flagged — official Motion library; `too-new` seam signal is publish-date artifact; planner adds `checkpoint:human-verify` before install |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `motion` — high-download official package; verify install resolves to `motiondivision/motion` repo before merge

## Architecture Patterns

### System Architecture Diagram

```text
                    ┌─────────────────────────────────────────┐
                    │              App.tsx (FSM)               │
                    │  appMode: INITIAL_GUIDE | CAMERA_IDLE | … │
                    │  handleShelfChange → loadShelfData        │
                    │  resolveAppModeAfterShelfLoad()           │
                    └───────────────┬─────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌──────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
│  CameraView      │   │ InitialGuideOverlay  │   │ ScanningAnimation   │
│  ├─ PRD top bar  │   │ (when INITIAL_GUIDE) │   │ Overlay (800ms)     │
│  ├─ ShelfCarousel│   │ 3-step wizard        │   └─────────────────────┘
│  │   swipe layer │   │ skip → CAMERA_IDLE   │
│  │   5-dot strip │   └──────────────────────┘
│  ├─ feed+ghost   │
│  └─ shutter bar  │
└──────────────────┘
          │
          │ swipe enabled iff appMode ∈ {CAMERA_IDLE, INITIAL_GUIDE}
          ▼
   handleShelfChange(nextId)  ──→  IndexedDB per-shelf load
```

### Recommended Project Structure

```
src/
├── App.tsx                          # + INITIAL_GUIDE branch, resolveAppModeAfterShelfLoad
├── index.css                        # + @theme PRD tokens, glass utility, breathing keyframes
├── lib/
│   ├── designTokens.ts              # NEW: named hex exports mirroring @theme
│   ├── shelfSwipe.ts                # NEW: pointer swipe helper (50px, axis lock)
│   └── constants.ts                 # + I18N keys for guide, carousel, baseline states
├── components/
│   ├── CameraView.tsx               # REFACTOR: 3-zone top bar, embed carousel, hide demo in top bar
│   ├── ShelfCarousel.tsx            # NEW: dots + swipe gesture layer + motion wrapper
│   ├── InitialGuideOverlay.tsx      # NEW: 3-step SHLF-05 overlay
│   ├── ShelfSelector.tsx            # DEPRECATE top-bar usage; dots logic moves to ShelfCarousel
│   ├── ScanningAnimationOverlay.tsx # POLISH: glow only, keep 0.8s
│   ├── RoiSetupView.tsx             # LIGHT theme wrapper + glass controls
│   └── ResultInspectView.tsx        # DSGN-02 anomaly colors + light theme
└── types.ts                         # AppMode unchanged (INITIAL_GUIDE already present)
```

### Pattern 1: Split Swipe Detection + Motion Cross-Fade

**What:** Pointer/touch handlers detect horizontal shelf intent; `motion` animates feed transition when `activeShelfId` changes.

**When to use:** Every shelf switch in `CAMERA_IDLE` or `INITIAL_GUIDE`.

**Why not motion drag alone:** Vertical ghost slider and future ROI interactions share the viewport; `motion` drag defaults to 3px activation threshold [CITED: motion.dev/docs/react-use-drag-controls] — too sensitive and axis-unlocked.

**Example:**

```typescript
// Source: motion.dev/docs/react-animate-presence + motion.dev/docs/react-accessibility
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

function ShelfFeed({ shelfId, children }: { shelfId: number; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={shelfId}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 40 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -40 }}
        transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
        className="absolute inset-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

### Pattern 2: Pointer Swipe Helper (50px, Axis Lock)

**What:** Standalone helper in `src/lib/shelfSwipe.ts` attached to gesture layer `div`.

**When to use:** `ShelfCarousel` or `CameraView` viewport overlay.

**Example:**

```typescript
// src/lib/shelfSwipe.ts — threshold/axis per D-01
const SWIPE_THRESHOLD_PX = 50;

export function attachShelfSwipe(
  el: HTMLElement,
  opts: { enabled: boolean; onSwipeLeft: () => void; onSwipeRight: () => void },
) {
  let startX = 0;
  let startY = 0;

  const onPointerDown = (e: PointerEvent) => {
    if (!opts.enabled) return;
    startX = e.clientX;
    startY = e.clientY;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!opts.enabled) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > Math.abs(dx)) return; // vertical-dominant → ignore
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) opts.onSwipeLeft();
    else opts.onSwipeRight();
  };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointerup', onPointerUp);
  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointerup', onPointerUp);
  };
}
```

### Pattern 3: INITIAL_GUIDE Mode Resolution

**What:** Central function called after every shelf load and on app init.

**When to use:** `loadShelfData` completion, `handleCompleteAudit` return, `handleResetToDefault`.

```typescript
// App.tsx — mode resolution per D-07, D-12
function resolveAppModeAfterShelfLoad(hasBaseline: boolean, currentMode: AppMode): AppMode {
  if (!hasBaseline) return 'INITIAL_GUIDE';
  if (currentMode === 'INITIAL_GUIDE') return 'CAMERA_IDLE';
  return currentMode === 'CAMERA_IDLE' || currentMode === 'INITIAL_GUIDE'
    ? 'CAMERA_IDLE'
    : currentMode;
}
```

**App.tsx render change:**

```typescript
// Extend existing CAMERA_IDLE branch — both modes share CameraView shell
{(appMode === 'CAMERA_IDLE' || appMode === 'INITIAL_GUIDE') && (
  <CameraView
    /* existing props */
    showInitialGuide={appMode === 'INITIAL_GUIDE'}
    onDismissInitialGuide={() => setAppMode('CAMERA_IDLE')}
    carouselEnabled={appMode === 'CAMERA_IDLE' || appMode === 'INITIAL_GUIDE'}
  />
)}
```

### Pattern 4: Tailwind v4 `@theme` Token Centralization

**What:** Define PRD palette once in `src/index.css`.

```css
/* Source: tailwindcss.com/docs/theme */
@import "tailwindcss";

@theme {
  --color-sg-white: #ffffff;
  --color-sg-surface: #f8fafc;
  --color-sg-primary: #0f172a;
  --color-sg-secondary: #64748b;
  --color-sg-border: #e2e8f0;
  --color-sg-success: #10b981;
  --color-sg-danger: #ef4444;
  --color-sg-warning: #f59e0b;
  --color-sg-camera: #0f172a;
  --color-sg-scan: #38bdf8;
}

@utility glass-panel {
  @apply rounded-2xl backdrop-blur-md bg-white/75 shadow-md border border-sg-border/60;
}
```

Usage: `bg-sg-camera`, `text-sg-primary`, `border-sg-success`, `bg-sg-danger/15`.

### Pattern 5: PRD Top Bar 3-Zone Layout

**What:** Refactor `CameraView.tsx` lines 273–346 from 2-cluster layout to fixed 3-zone grid.

| Zone | Content | Behavior |
|------|---------|----------|
| Left | Baseline pill | `hasPersistedBaseline ? t.baselineEstablished : t.baselineNotSet`; pulse dot only when established; tap → `onResetBaselinePrompt` |
| Center | Level micro-badge | Move from crosshair overlay; show `0.0°` / tilt; desktop simulate toggle preserved |
| Right | Torch + Lang | Remove shelf selector, demo toggle, PWA from this cluster |

**Shelf dots:** New row below top bar (`ShelfCarousel`), centered, `aria-current="true"` on active dot [VERIFIED: 05-CONTEXT.md D-03].

**Demo toggle:** Bottom-left utility pill below dots [D-23].

### Anti-Patterns to Avoid

- **`motion` drag on full viewport:** Conflicts with ghost vertical slider (right edge `input[type=range]`) and produces 3px activation vs 50px PRD threshold.
- **Rendering `DEFAULT_CALIBRATION` image for empty shelves:** Violates SHLF-05/D-09; use dark placeholder or live camera only.
- **Global INITIAL_GUIDE flag:** Must be per-shelf via `hasPersistedBaseline`, not `localStorage` "seen guide".
- **Changing scan animation duration:** 800ms is STAB-01/03 contract — polish glow only.
- **Keeping segmented ShelfSelector in top bar:** Explicitly removed by D-22.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shelf transition animation | Custom RAF opacity loops | `motion` `AnimatePresence` | Exit animations, reduced-motion, spring physics [CITED: motion.dev] |
| Swipe threshold math | Complex gesture library | `attachShelfSwipe` (~30 LOC) | PRD needs only axis lock + 50px — no pinch/velocity |
| Design token CSS utilities | Manual `:root` without `@theme` | Tailwind v4 `@theme --color-*` | Auto-generates utility classes project-wide |
| INITIAL_GUIDE multi-step state | New routing library | Local `useState(step)` in overlay | 3 steps, no URL sync needed |
| Reduced motion detection | `matchMedia` wrapper | `useReducedMotion()` from motion | Pairs with AnimatePresence fallback [CITED: motion.dev/docs/react-accessibility] |

**Key insight:** Phase 5 polish is mostly **composition and token centralization** — the hard contracts (shelf storage, capture FSM, ghost rules) already exist in Phase 2–4.

## Common Pitfalls

### Pitfall 1: Swipe Enabled During Scan/ROI/Result

**What goes wrong:** User swipes mid-capture; baseline/ghost from shelf B appears while shelf A capture is in flight.

**Why it happens:** `handleShelfChange` is always callable; no `appMode` guard.

**How to avoid:** Pass `carouselEnabled={appMode === 'CAMERA_IDLE' || appMode === 'INITIAL_GUIDE'}`; early-return in swipe handler when false [VERIFIED: 05-CONTEXT.md D-05].

**Warning signs:** Integration test can trigger shelf change during mocked `SCANNING_ANIM`.

### Pitfall 2: Demo Feed Masquerading as Baseline in INITIAL_GUIDE

**What goes wrong:** Empty shelf shows `/demo-shelf.jpg` via `DEFAULT_CALIBRATION`, violating SHLF-05.

**Why it happens:** `loadShelfData` sets `baseline = DEFAULT_CALIBRATION` when `persisted === null`; `CameraView` renders demo image when `isUsingDemoFeed`.

**How to avoid:** In INITIAL_GUIDE + `!hasPersistedBaseline`, force placeholder UI (no `baseline.imageDataUrl` as feed); optionally auto-prompt live camera without showing demo shelf as "baseline" [D-09].

**Warning signs:** Ghost overlay or demo image visible on fresh shelf with no persisted baseline.

### Pitfall 3: Integration Tests Break After ShelfSelector Removal

**What goes wrong:** `App.shelfIsolation.integration.test.tsx` clicks `Shelf 2` button — removed with carousel.

**Why it happens:** Tests target `aria-label="Shelf 2"` on segmented buttons [VERIFIED: src/App.shelfIsolation.integration.test.tsx:166].

**How to avoid:** Update tests to swipe simulation or click carousel dots (`data-shelf-index`); add `fireEvent` pointer helpers.

**Warning signs:** 4 failing tests in shelf isolation suite after carousel merge.

### Pitfall 4: Arbitrary Hex Drift After Token Migration

**What goes wrong:** Some components use `#10B981`, others `emerald-500`, breaking Stitch comparison.

**How to avoid:** Wave 1 token migration before visual polish; grep for `#0F172A|#10B981|#EF4444` in touched files.

### Pitfall 5: INITIAL_GUIDE Not Re-shown After Reset

**What goes wrong:** `handleResetToDefault` clears baseline but leaves `appMode` as `CAMERA_IDLE`.

**How to avoid:** Call `setAppMode('INITIAL_GUIDE')` after successful `clearBaseline` when `!hasPersistedBaseline` [D-12 inverse].

## Code Examples

### Carousel Dot Strip (Accessible)

```tsx
// src/components/ShelfCarousel.tsx
const SHELF_COUNT = 5;

export function ShelfCarousel({ activeShelfId, onShelfChange, lang, enabled }: Props) {
  const t = I18N[lang];
  return (
    <div
      role="tablist"
      aria-label={t.shelfCarouselLabel}
      className="flex items-center justify-center gap-2 py-2"
      data-testid="shelf-carousel"
    >
      {Array.from({ length: SHELF_COUNT }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-current={activeShelfId === i ? 'true' : undefined}
          aria-label={t.shelfLabel(i + 1)}
          data-shelf-index={i}
          onClick={() => enabled && onShelfChange(i)}
          className={activeShelfId === i
            ? 'h-2.5 w-2.5 rounded-full bg-sg-success'
            : 'h-2 w-2 rounded-full border border-sg-border bg-transparent'}
        />
      ))}
    </div>
  );
}
```

### INITIAL_GUIDE Overlay Shell

```tsx
// src/components/InitialGuideOverlay.tsx
export function InitialGuideOverlay({ lang, shelfIndex, onComplete, onSkip }: Props) {
  const t = I18N[lang];
  const [step, setStep] = useState(0);
  return (
    <div className="absolute inset-0 z-40 bg-sg-camera/95 flex flex-col items-center justify-center p-6" data-testid="initial-guide">
      {step === 0 && (/* welcome + shelf name */)}
      {step === 1 && (/* alignment tips — no ghost yet */)}
      {step === 2 && (
        <>
          <button className="glass-panel px-6 py-3" onClick={onComplete}>{t.captureBaseline}</button>
          <button className="mt-4 text-sg-secondary text-sm" onClick={onSkip}>{t.skipGuide}</button>
        </>
      )}
      {/* step navigation for 0→1→2 */}
    </div>
  );
}
```

### Swipe Guard Helper

```typescript
// src/lib/carouselEnabled.ts
import { AppMode } from '../types';

export function isCarouselEnabled(appMode: AppMode): boolean {
  return appMode === 'CAMERA_IDLE' || appMode === 'INITIAL_GUIDE';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Segmented `ShelfSelector` in top bar | Swipe + 5-dot strip below top bar | Phase 5 D-01 | Tests and top bar layout must update |
| `INITIAL_GUIDE` type unused | Per-shelf mode on `!hasPersistedBaseline` | Phase 5 D-07 | App init + shelf switch + reset flows |
| Scattered arbitrary hex | `@theme --color-sg-*` utilities | Phase 5 D-13 | Touch only Phase 5 files; avoid whole-repo churn |
| Framer Motion package name | `motion` package (`motion/react`) | 2024–2025 | Import from `motion/react`, not `framer-motion` [CITED: motion.dev] |

**Deprecated/outdated:**
- `framer-motion` import path — use `motion/react`
- Top-bar Demo/Cam toggle — relocated per D-23

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `motion@13.4.2` is correct package (not `framer-motion`) | Standard Stack | Wrong import path / API mismatch |
| A2 | Pointer events work in jsdom tests with manual `fireEvent` | Testing | May need `@testing-library/user-event` pointer API polyfill |
| A3 | Phase 4 first-baseline shutter → ROI_CONFIG path exists before Phase 5 | INITIAL_GUIDE | Shutter behavior may need Phase 4 coordination |
| A4 | `@utility glass-panel` compositing works with Tailwind 4.3.3 | Design tokens | Fallback to documented class string combo |

## Open Questions

1. **Phase 4 shutter intercept for empty shelf**
   - What we know: D-10 requires ROI_CONFIG path after guide dismiss
   - What's unclear: Whether Phase 4 already implements first-capture intercept in `handleShutterClick`
   - Recommendation: Planner verifies Phase 4 completion; if not, add minimal guard in Phase 5 Wave 1

2. **PWA install button relocation**
   - What we know: D-22 removes from top bar; optional bottom utility
   - Recommendation: Omit if `usePWAInstall` rarely fires; keep offline indicator unchanged

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Vite build | ✓ | v23.10.0 | — |
| npm | Package install (motion) | ✓ | 11.4.2 | — |
| Vitest + jsdom | Component/integration tests | ✓ | vitest 5.0.1 | — |
| motion | Carousel cross-fade | ✗ (not installed) | — | Install Wave 0; CSS opacity-only fallback via `useReducedMotion` |

**Missing dependencies with no fallback:**
- `motion` — must install before carousel animation tasks

**Missing dependencies with fallback:**
- None after motion install

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 + @testing-library/react 16.3.3 |
| Config file | `vitest.config.ts` (jsdom, `./vitest.setup.ts`) |
| Quick run command | `npm test -- src/components/ShelfCarousel.test.tsx src/components/InitialGuideOverlay.test.tsx -x` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHLF-01 | Active dot reflects `activeShelfId` | unit | `npm test -- src/components/ShelfCarousel.test.tsx -x` | ❌ Wave 0 |
| SHLF-01 | Swipe ≥50px triggers `onShelfChange` | unit | `npm test -- src/lib/shelfSwipe.test.ts -x` | ❌ Wave 0 |
| SHLF-01 | Swipe disabled when `enabled=false` | unit | `npm test -- src/lib/shelfSwipe.test.ts -x` | ❌ Wave 0 |
| SHLF-01 | Shelf B data isolated from shelf A via swipe | integration | `npm test -- src/App.shelfIsolation.integration.test.tsx -x` | ✅ (update selectors) |
| SHLF-05 | INITIAL_GUIDE shown when `!hasPersistedBaseline` | integration | `npm test -- src/App.initialGuide.integration.test.tsx -x` | ❌ Wave 0 |
| SHLF-05 | INITIAL_GUIDE hidden when baseline exists | unit | `npm test -- src/components/InitialGuideOverlay.test.tsx -x` | ❌ Wave 0 |
| SHLF-05 | Skip lands on CAMERA_IDLE | unit | `npm test -- src/components/InitialGuideOverlay.test.tsx -x` | ❌ Wave 0 |
| DSGN-01 | Token utilities applied (spot check) | unit | `npm test -- src/components/CameraView.tokens.test.tsx -x` | ❌ Wave 0 |
| I18N-01 | New keys render in both langs | unit | `npm test -- src/components/InitialGuideOverlay.test.tsx -x` | ❌ Wave 0 |
| CAM-04 | Baseline pill shows established vs empty | unit | `npm test -- src/components/CameraView.topBar.test.tsx -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- <new-test-file> -x`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test && npm run lint` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `npm install motion@^13.4.2` — dependency missing from package.json
- [ ] `src/lib/shelfSwipe.ts` + `src/lib/shelfSwipe.test.ts` — swipe threshold helper
- [ ] `src/lib/carouselEnabled.ts` — appMode guard (optional inline)
- [ ] `src/components/ShelfCarousel.tsx` + test — dots + gesture layer
- [ ] `src/components/InitialGuideOverlay.tsx` + test — 3-step overlay
- [ ] `src/App.initialGuide.integration.test.tsx` — empty shelf → INITIAL_GUIDE
- [ ] Update `src/App.shelfIsolation.integration.test.tsx` — carousel dot/swipe selectors replace ShelfSelector buttons
- [ ] `src/index.css` `@theme` block — PRD tokens
- [ ] `src/lib/designTokens.ts` — JS mirror of tokens
- [ ] I18N keys: `shelfCarouselLabel`, `shelfLabel`, `captureBaseline`, `skipGuide`, guide step copy

### Test Helpers (Recommended)

```typescript
// test/helpers/swipe.ts
import { fireEvent } from '@testing-library/react';

export function swipeHorizontal(el: Element, dx: number) {
  fireEvent.pointerDown(el, { clientX: 100, clientY: 200, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: 100 + dx, clientY: 200, pointerId: 1 });
}
```

### Verification Commands (Phase Gate)

```bash
npm install motion@^13.4.2
npm run lint                    # tsc --noEmit
npm test                        # full Vitest suite
npm run build                   # ensure motion tree-shakes in production bundle
```

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — local PWA |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | Swipe handler ignores vertical-dominant gestures; no user text input in carousel |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via `dangerouslySetInnerHTML` in guide copy | Tampering | Use `I18N` plain strings only; no HTML injection in overlay |
| Gesture event passive listener warnings | Denial of Service | Use `{ passive: true }` on touch listeners where not calling `preventDefault` |

## File-Level Implementation Guidance

| File | Action | Key Changes |
|------|--------|-------------|
| `package.json` | MODIFY | Add `motion@^13.4.2` |
| `src/index.css` | MODIFY | `@theme` PRD tokens; `@utility glass-panel`; shutter breathing `@keyframes` |
| `src/lib/designTokens.ts` | CREATE | Export `SG_COLORS` mirroring `@theme` |
| `src/lib/shelfSwipe.ts` | CREATE | 50px threshold, axis lock, enable guard |
| `src/lib/constants.ts` | MODIFY | I18N keys for guide, carousel, baseline not-set copy |
| `src/components/ShelfCarousel.tsx` | CREATE | Dots, swipe layer, optional label chip |
| `src/components/InitialGuideOverlay.tsx` | CREATE | 3-step wizard, skip/complete callbacks |
| `src/components/CameraView.tsx` | REFACTOR | 3-zone top bar; embed carousel; move demo toggle; 48×48 thumb; conditional breathing |
| `src/components/ShelfSelector.tsx` | DEPRECATE | Remove from top bar; logic absorbed by ShelfCarousel |
| `src/components/ScanningAnimationOverlay.tsx` | POLISH | Stronger cyan glow; keep `0.8s` keyframes |
| `src/components/RoiSetupView.tsx` | POLISH | Light `#F8FAFC` background, glass controls |
| `src/components/ResultInspectView.tsx` | POLISH | DSGN-02 box styles with token colors |
| `src/App.tsx` | MODIFY | INITIAL_GUIDE branch; `resolveAppModeAfterShelfLoad`; pass `carouselEnabled` |
| `src/types.ts` | NO CHANGE | `INITIAL_GUIDE` already in union [VERIFIED: src/types.ts:1-7] |
| `src/App.shelfIsolation.integration.test.tsx` | MODIFY | Carousel selectors + swipe helper |
| `src/App.initialGuide.integration.test.tsx` | CREATE | Empty shelf guide flow |

## Sources

### Primary (HIGH confidence)
- [motion.dev AnimatePresence](https://motion.dev/docs/react-animate-presence) — slideshow key pattern, exit animations
- [motion.dev Accessibility / useReducedMotion](https://motion.dev/docs/react-accessibility) — opacity fallback
- [motion.dev Drag](https://motion.dev/docs/react-drag) — why not to use drag for shelf swipe
- [Tailwind CSS v4 Theme](https://tailwindcss.com/docs/theme) — `@theme`, `--color-*` namespaces
- [VERIFIED: package.json] — current dependencies (motion absent)
- [VERIFIED: src/types.ts:1-7] — `AppMode` includes `'INITIAL_GUIDE'`
- [VERIFIED: src/App.tsx:181-190] — `handleShelfChange` contract
- [VERIFIED: src/lib/captureLock.ts:4-9] — lock modes (does not yet include INITIAL_GUIDE)

### Secondary (MEDIUM confidence)
- `.planning/phases/05-prd-ui-multi-shelf-experience/05-CONTEXT.md` — locked decisions
- `.planning/research/STACK.md` — motion recommendation (version drift vs live npm)

### Tertiary (LOW confidence)
- `.planning/research/ARCHITECTURE.md` — hook decomposition suggestions (defer to v2; not Phase 5 scope)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm verified motion 13.4.2 + React 19 peers; Tailwind @theme from official docs
- Architecture: HIGH — brownfield files read; FSM integration points identified
- Pitfalls: HIGH — existing tests document ShelfSelector coupling; ghost rules from Phase 3 tests

**Research date:** 2026-09-23
**Valid until:** 2026-10-23 (30 days — stable UI stack)
