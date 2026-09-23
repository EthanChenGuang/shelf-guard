---
phase: "5"
slug: "prd-ui-multi-shelf-experience"
status: draft
shadcn_initialized: false
preset: minimalist-light
created: "2026-09-23"
requirements: [DSGN-01, DSGN-02, DSGN-03, DSGN-04]
---

# Phase 5 — UI Design Contract (PRD Minimalist Light)

> Visual and interaction contract for the PRD UI & Multi-Shelf Experience phase. Generated per D-18 before implementation waves (05-02+).
>
> **Scope note:** Phase 5 owns **full PRD Minimalist Light polish** (DSGN-01–04, SHLF-01, SHLF-05, CAM-04–06, I18N-01–02). Phase 4 interaction contracts for first-baseline ROI path, worker timing, tolerance slider, blink compare, and tap-to-dismiss **remain unchanged** — Phase 5 polishes chrome and tokenizes colors only.

**Upstream reference:** `.planning/phases/04-real-inspection-pipeline/04-UI-SPEC.md`

**Brownfield approach (D-20):** Polish in place on existing components — `CameraView`, `RoiSetupView`, `ResultInspectView`, `ScanningAnimationOverlay` — rather than rewrite-from-scratch unless layout contract cannot be met.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Google Stitch (reference screenshots) |
| Preset | Minimalist Light |
| Component library | none (hand-built React 19 + Tailwind CSS 4) |
| Icon library | lucide-react ^0.546.0 |
| Font | System UI stack (default); `JetBrains Mono` via `.font-mono-numbers` for counts, coordinates, tolerance value |
| Animation library | `motion@^13.4.2` (Wave 0 install) — shelf cross-fade only; swipe detection via native Pointer Events |

**Token source (D-13):** Centralize PRD palette in `src/index.css` `@theme` block and mirror in `src/lib/designTokens.ts` for JS/canvas access.

---

## PRD Token Table

| Hex | Tailwind `@theme` name | Utility examples | Usage |
|-----|------------------------|------------------|-------|
| `#FFFFFF` | `--color-sg-white` | `bg-sg-white`, `text-sg-white` | Light view surfaces, sticky headers, drawer backgrounds |
| `#F8FAFC` | `--color-sg-surface` | `bg-sg-surface` | ROI setup and Result inspect page backgrounds (D-15) |
| `#0F172A` | `--color-sg-primary` / `--color-sg-camera` | `bg-sg-camera`, `text-sg-primary` | Camera shell dark background; primary typography |
| `#64748B` | `--color-sg-secondary` | `text-sg-secondary` | Secondary labels, hint copy, inactive text |
| `#E2E8F0` | `--color-sg-border` | `border-sg-border` | Borders, thumbnail outline, inactive carousel dots |
| `#10B981` | `--color-sg-success` | `bg-sg-success`, `text-sg-success` | Active shelf dot, baseline established pulse, level snap, primary CTAs |
| `#EF4444` | `--color-sg-danger` | `border-sg-danger`, `bg-sg-danger/15` | MISSING anomaly boxes and stat chips (DSGN-02) |
| `#F59E0B` | `--color-sg-warning` | `border-sg-warning`, `bg-sg-warning/15` | MOVED/Displaced anomaly boxes and stat chips (DSGN-02) |
| `#38BDF8` | `--color-sg-scan` | `from-sg-scan`, `text-sg-scan` | Scan beam gradient in `ScanningAnimationOverlay` (CAM-06) |

**Planned `@theme` block (implementation in 05-02+):**

```css
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
```

---

## Spacing Scale

Declared values (multiples of 4). PRD-specific measurements called out explicitly.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline badge padding |
| sm | 8px | Carousel dot gap (`gap-2`), compact control padding |
| md | 16px | Default horizontal padding (`px-4`), section gaps |
| lg | 24px | Top bar vertical padding, carousel row spacing |
| xl | 32px | Bottom safe-area padding (`pb-8`) |
| 2xl | 48px | Touch targets, utility pill height |
| **PRD shutter** | **76px** | Outer ring diameter — double-ring breathing shutter (CAM-05, D-25) |
| **PRD thumbnail** | **48×48px** | Last-inspection thumbnail — `rounded-xl`, border `#E2E8F0` (CAM-05, D-26) |
| **PRD magnifier** | **80px** | Circular lens diameter — reference from Phase 4 ROI magnifier (ROI-04) |
| **PRD swipe threshold** | **50px** | Minimum horizontal delta for shelf carousel swipe (SHLF-01, D-01) |
| **PRD scan duration** | **0.8s (800ms)** | Locked scan beam animation — STAB-01/03 contract (CAM-06, D-27) |

**Carousel dot strip:** Centered **5-dot strip** below PRD top bar; active dot `h-2.5 w-2.5` filled emerald; inactive `h-2 w-2` outline (D-03).

---

## Typography

| Role | Size | Weight | Color | Usage |
|------|------|--------|-------|-------|
| Body | 14px (`text-sm`) | 400 | `#0F172A` | Default copy on light views |
| Label | 12px (`text-xs`) | 600 | `#64748B` | Secondary labels, utility pills |
| Heading | 16px (`text-base`) | 600–700 | `#0F172A` | INITIAL_GUIDE step titles, modal headers |
| Display | 16px (`text-base`) | 600 | `#0F172A` | Stat counts via `font-mono-numbers` |
| Micro | 10–11px | 600 | `#64748B` | Level badge, baseline pill subtext |

**View background split (D-15):**
- **Camera shell:** dark `#0F172A` (`bg-sg-camera`) — all camera-mode chrome
- **ROI setup:** light `#F8FAFC` (`bg-sg-surface`)
- **Result inspect:** light `#F8FAFC` / `#FFFFFF` headers and drawers

---

## Color

### Dominant Palette (Minimalist Light — DSGN-01)

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#F8FAFC` / `#FFFFFF` | Light view backgrounds, glass panel fills |
| Secondary (30%) | `#E2E8F0`, `#64748B` | Borders, secondary text, inactive controls |
| Accent (10%) | `#10B981` | Success states, active shelf dot, baseline established, level snap |
| Camera shell | `#0F172A` | Full-screen camera viewport background |

### Anomaly State Colors (DSGN-02, D-16)

| Type | Border | Fill | Stat chip active |
|------|--------|------|------------------|
| MISSING | `#EF4444` **2px bold** | `#EF4444` at **15%** (`bg-sg-danger/15`) | `bg-sg-danger text-white` |
| MOVED / Displaced | `#F59E0B` **2px bold** | `#F59E0B` at **15%** (`bg-sg-warning/15`) | `bg-sg-warning text-white` |

Phase 4 already ships this pattern in `ResultInspectView` — Phase 5 **tokenizes** to `@theme` utilities without regressing colors or reimplementing slider/interaction logic.

### Scan Beam (CAM-06)

| Property | Value |
|----------|-------|
| Color | `#38BDF8` cyan gradient |
| Duration | **800ms** (locked — do not change) |
| Direction | Top → bottom sweep |
| Component | `ScanningAnimationOverlay` |

---

## Glassmorphism Pattern (DSGN-03, D-14)

Apply uniformly on all floating UI controls across three views:

| Property | Tailwind combo |
|----------|----------------|
| Border radius | `rounded-2xl` (panels) or `rounded-full` (pills, badges) |
| Background | `backdrop-blur-md bg-white/75` |
| Shadow | `shadow-sm` to `shadow-md` |
| Border | `border border-sg-border/60` |

**Planned utility (implementation in 05-02+):**

```css
@utility glass-panel {
  @apply rounded-2xl backdrop-blur-md bg-white/75 shadow-md border border-sg-border/60;
}
```

**Applies to:** baseline status pill, level micro-badge, torch/lang cluster, demo utility pill, carousel label chip, INITIAL_GUIDE step cards, ROI/Result floating controls.

---

## Component Inventory

| Component | Status | Description |
|-----------|--------|-------------|
| **ShelfCarousel** | NEW (`05-03+`) | 5-dot strip below top bar + horizontal swipe gesture layer (50px threshold, axis lock). Calls `handleShelfChange`. Enabled in `CAMERA_IDLE` and `INITIAL_GUIDE` only (D-05). |
| **InitialGuideOverlay** | NEW (`05-04+`) | Full-screen 3-step overlay on camera shell for shelves without persisted baseline (SHLF-05). Skip → `CAMERA_IDLE`; complete → `CAMERA_IDLE` then first-baseline shutter path. |
| **CameraView** | REFACTOR | PRD 3-zone top bar (baseline pill / level badge / torch+lang); embed ShelfCarousel; 76px double-ring breathing shutter; 48×48 last-inspection thumbnail; demo utility pill bottom-left; preserve `analysisError` banner (D-37). |
| **ScanningAnimationOverlay** | POLISH | 0.8s `#38BDF8` scan beam — enhance gradient/glow only; duration locked. |
| **RoiSetupView** | POLISH | Light `#F8FAFC` theme + glass controls; preserve `isFirstBaseline` prop and Phase 4 interaction contracts. |
| **ResultInspectView** | POLISH | Tokenize DSGN-02 anomaly colors; light theme chrome; preserve continuous tolerance slider 0–100 and Phase 4 interactions. |
| **ShelfSelector** | DEPRECATE | Remove from top bar; dot logic absorbed by ShelfCarousel. |

---

## Layout Measurements (PRD Authority)

| Element | Measurement | Reference |
|---------|-------------|-----------|
| Shutter outer ring | **76px** diameter, double-ring | CAM-05, D-25 |
| Shutter breathing | scale 0.98–1.02 keyframe + outer ring `animate-pulse` | Active when `CAMERA_IDLE`, `!isShutterLocked`, camera available |
| Last-inspection thumbnail | **48×48px**, `rounded-xl`, border `#E2E8F0` | CAM-05, D-26; bottom-right relative to shutter |
| Magnifier lens | **80px** circle, 2× zoom | Phase 4 ROI-04 — reference only in Phase 5 |
| Magnifier offset | ~94px above active divider | Phase 4 ROI-04 — unchanged |
| Swipe threshold | **50px** horizontal, axis-dominant | SHLF-01, D-01 |
| Carousel dots | 5 dots, centered below top bar | SHLF-01, D-03 |
| Scan animation | **0.8s (800ms)** | STAB-01/03, CAM-06, D-27 |
| Top bar | 3-zone: Left baseline pill / Center level badge / Right torch+lang | CAM-04, D-21 |
| Demo toggle | Bottom-left utility pill below carousel dots | CAM-04, D-23 |

---

## Copywriting Contract

| Element | Copy (CN / EN) | I18N key (planned) |
|---------|----------------|---------------------|
| Baseline established | 基准图 · 已建立 / Baseline · Established | `baselineEstablished` |
| Baseline not set | 基准图 · 未建立 / Baseline · Not set | `baselineNotSet` |
| Shelf carousel label | 柜架选择 / Shelf selection | `shelfCarouselLabel` |
| Shelf N label | 柜架 {n} / Shelf {n} | `shelfLabel(n)` |
| INITIAL_GUIDE step 1 | Welcome + shelf name | `guideWelcome` |
| INITIAL_GUIDE step 2 | Alignment tips (no ghost yet) | `guideAlignment` |
| INITIAL_GUIDE step 3 CTA | 拍摄基准图 / Capture baseline | `captureBaseline` |
| Skip guide | 跳过 / Skip | `skipGuide` |
| Demo toggle (sample) | 使用样例 / Use sample feed | `useSampleFeed` |
| Demo toggle (live) | 使用相机 / Use real camera | `useRealCamera` |
| Analysis failed | 分析失败，请重试拍摄 / Analysis failed — tap shutter to retry | `analysisFailed` (existing) |

All new strings follow `I18N[lang]` pattern in `src/lib/constants.ts` — no hardcoded UI strings in Phase 5 touched files (I18N-01, D-29).

---

## Interaction Contracts

### Phase 5 New Interactions

#### 1. Shelf Swipe Carousel (SHLF-01, D-01–D-06)

| Trigger | Behavior | Visual |
|---------|----------|--------|
| Swipe left ≥50px (horizontal-dominant) | `handleShelfChange(nextShelfId)` | Cross-fade via `motion` ~300ms spring; active dot updates |
| Swipe right ≥50px | Previous shelf | Same animation |
| Tap carousel dot | Direct shelf select | Active dot fills `#10B981`; `aria-current="true"` |
| Vertical-dominant gesture | Ignored | No shelf change — avoids ghost slider conflict |
| `appMode` ∉ {`CAMERA_IDLE`, `INITIAL_GUIDE`} | Swipe disabled | Dots visible but non-interactive (D-05) |
| Shelf switch | `loadShelfData`, `objectUrlRegistry.revokeAll`, clear `pendingBaselineImageUrl` | Ghost/baseline reload per Phase 3 rules |

#### 2. INITIAL_GUIDE Onboarding (SHLF-05, D-07–D-12)

| Trigger | Behavior | Visual |
|---------|----------|--------|
| App init / shelf switch / reset when `!hasPersistedBaseline` | `appMode = INITIAL_GUIDE` via `resolveAppModeAfterShelfLoad` | Full-screen overlay on camera shell |
| Step 1 | Welcome + shelf name | Dark `#0F172A` overlay at 95% opacity |
| Step 2 | Alignment tips | No ghost overlay (baseline not yet established) |
| Step 3 primary CTA | Dismiss → `CAMERA_IDLE` | Glass panel button |
| Skip button | Dismiss → `CAMERA_IDLE` | Secondary text; not persisted (D-11) |
| Empty shelf feed | No `DEFAULT_CALIBRATION` CDN image as feed | Neutral dark placeholder or live camera (D-09) |
| Shutter after guide | Phase 4 first-baseline path → `ROI_CONFIG` | **No** scan animation until baseline saved (D-10, D-35) |

#### 3. PRD Camera Top Bar (CAM-04, D-21–D-24)

| Zone | Content | Interaction |
|------|---------|-------------|
| Left | Baseline status pill | Green pulse dot when established; tap → `ResetBaselineModal` |
| Center | Level micro-badge | `0.0°` mint when level; amber when tilted |
| Right | Torch (if supported) + language toggle | `中` / `EN` persists via IndexedDB |

**Removed from top bar:** segmented ShelfSelector, Demo/Cam toggle, PWA install button (D-22).

#### 4. Shutter & Thumbnail (CAM-05, D-25–D-28)

| Element | Contract |
|---------|----------|
| Shutter | 76px outer double-ring; breathing glow when ready |
| Shutter flash | Brief white fade overlay on tap (add if missing) |
| Thumbnail | 48×48 bottom-right; tap opens history modal |
| Scan line | 0.8s `#38BDF8` beam — polish glow only |

### Phase 4 Contracts — Unchanged (Reference Only)

Phase 5 **does not modify** these Phase 4 interaction contracts. See `04-UI-SPEC.md` for full detail:

| Contract | Phase 4 Section | Phase 5 Action |
|----------|-----------------|----------------|
| First-baseline shutter → ROI_CONFIG | §1 First-Baseline Capture Flow | Preserve; INITIAL_GUIDE sits before this path |
| ROI divider + 80px magnifier | §2 ROI Divider + Magnifier | Light theme polish only |
| Scan 800ms + worker concurrent | §3 Inspection Scan + Worker | Glow polish only; duration locked |
| Anomaly overlay boxes | §4 Result Inspect | Tokenize colors to `@theme` |
| Long-press blink compare | §5 | No change |
| Tap-to-dismiss | §6 | No change |
| Stat capsule filter | §7 | No change |
| Continuous tolerance slider 0–100, 150ms debounce | §8 | Visual polish only (D-39) |
| Complete inspection flow | §9 | No change |
| Worker rejection → analysisFailed banner | Copywriting + D-37 | Top bar refactor must keep banner |
| prewarmVisionWorker | D-38 | Only when `CAMERA_IDLE && hasPersistedBaseline` |

---

## UI Considerations

| Category | Element | Status | Resolution |
|----------|---------|--------|------------|
| empty | shelf-without-baseline | ✅ covered | INITIAL_GUIDE overlay; no demo CDN masquerading as baseline (D-09) |
| empty | carousel-all-shelves | ✅ covered | 5 dots always visible; swipe between empty and established shelves |
| loading | scan-overlay | ✅ covered | 800ms beam locked; PROCESSING overlay for worker cold-start |
| loading | shelf-cross-fade | ✅ covered | `motion` spring ~300ms; opacity-only fallback via `useReducedMotion` |
| error | analysis-failed banner | ✅ covered | Preserve Phase 4 `showAnalysisError` on CameraView (D-37) |
| populated | 5-shelf carousel | ✅ covered | Dot strip + swipe; data isolation per Phase 2 |
| overflow | top-bar-3-zone | ✅ covered | Fixed grid; baseline pill truncates at 320px |
| gesture | vertical-vs-horizontal | ✅ covered | 50px threshold + axis lock prevents ghost slider conflict |
| accessibility | carousel dots | ✅ covered | `role="tablist"`, `aria-current` on active dot |
| i18n | bilingual toggle | ✅ covered | All new strings in I18N cn/en pairs; immediate re-render (D-31) |

---

## Stitch Visual Verification (DSGN-04, D-19)

Manual screenshot comparison per `.planning/design/stitch/UAT-CHECKLIST.md` — **no CI pixel diff in v1**.

Reference screenshots (when available):
- `camera.png` — Camera view with PRD chrome
- `roi.png` — ROI setup light theme
- `result.png` — Result inspect with anomaly boxes

**Measurement authority:** This document (`05-UI-SPEC.md`).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| — | — | not applicable — planning artifact only |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending — implementation waves 05-02+ cite this document as authority
