# Phase 1: Capture Foundation & Vercel Deploy - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship a production-ready **Vite + React 19 pure-client PWA** on **Vercel**, with reliable shelf photo capture and known FSM/camera bugs fixed. **No Next.js migration** in v1 — existing brownfield stack is retained.

In scope: Vercel deployment config, PWA cache headers, dead dependency removal, camera error UX, demo-mode capture fix, shutter race guard, PROCESSING state, torch UI honesty, baseline upload dimensions, offline indicator verification.

Out of scope for this phase: Next.js / App Router, `@serwist/next`, real vision diff (Phase 4), multi-shelf IndexedDB (Phase 2), OpenCV.js install (Phase 4), INITIAL_GUIDE onboarding (Phase 5), monolithic App.tsx hook extraction.

**Note:** Phase directory slug (`next-js-migration-capture-foundation`) is legacy from an earlier roadmap draft; execution follows Vite + Vercel per decisions below. ROADMAP.md / TECH-01 / TECH-07 should be updated before or during planning to match.
</domain>

<decisions>
## Implementation Decisions

### Stack & Deployment (pivot from Next.js)
- **D-01:** **Retain Vite 8 + React 19 + Tailwind 4 + `vite-plugin-pwa`** — do not migrate to Next.js App Router for v1. Rationale: pure-client PWA deploys trivially to Vercel static hosting; migration adds risk with no SSR/SEO benefit. — **Reversibility:** costly — a later Next.js migration would re-touch every file and PWA config.
- **D-02:** **Deploy to Vercel** as a static SPA: build command `npm run build` (or `bun run build`), output directory `dist`, framework preset Vite (auto-detected).

### Vercel Project Setup
- **D-03:** Connect Git repository to Vercel; **production deploys from `main`**, preview deployments on pull requests.
- **D-04:** Add root **`vercel.json`** with: (a) SPA rewrite `/(.*) → /index.html`; (b) PWA-safe cache headers per [vite-pwa Vercel deployment guide](https://vite-pwa-org.netlify.app/deployment/vercel).

### PWA Update Strategy on Vercel
- **D-05:** Keep **`registerType: 'autoUpdate'`** in `vite-plugin-pwa` (existing `vite.config.ts` setting).
- **D-06:** **`vercel.json` headers:** `Cache-Control: no-store` for `*.html`, `/sw.js`, and web manifest paths; `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`. Prevents post-deploy MIME errors where stale `index.html` references removed JS chunks.

### Camera Permission & Error UX (CAM-08)
- **D-07:** Show camera failures as an **inline banner on `CameraView`** (not a full-screen modal or separate route) — user stays in camera context and can switch to demo mode.
- **D-08:** Banner copy must include **iOS standalone PWA fallback guidance**: open in Safari → Settings → [app] → allow Camera, or reinstall from Safari Add to Home Screen. Extend existing `I18N` keys in `src/lib/constants.ts` rather than hardcoded strings.
- **D-09:** **Wire `useCameraStream.cameraError`** (already exported, currently unused) into `CameraView` UI. Do not leave errors console-only.

### Demo Mode Behavior (CAM-09)
- **D-10:** **Keep demo feed as default on first launch** — avoids immediate camera permission friction; user can opt into live camera via existing toggle.
- **D-11:** **Fix demo capture:** `captureFrame()` must snapshot the **currently displayed frame** (including user-uploaded `baseline.imageDataUrl` shown in demo overlay), **not** the hardcoded `DEFAULT_SHELF_IMAGE_URL` CDN constant.

### Vision Library (cross-phase, affects Phase 4 planning)
- **D-12:** **Do not install `@techstark/opencv-js` in Phase 1** — no Worker scaffold, no WASM bundle in this phase. Vision pipeline lands in Phase 4.
- **D-13:** **v1 vision path is locked to `@techstark/opencv-js` only** (user updating TECH-06 to mandatory OpenCV). **pixelmatch / Canvas lightweight diff is excluded from v1.** Phase 4 planner must not offer pixelmatch as an alternative.

### FSM & Stability Fixes (minimal scope)
- **D-14:** **Minimal FSM patch in Phase 1** — fix known bugs in existing `App.tsx` state machine; **do not extract `useAuditFlow` / hook decomposition** (defer until multi-shelf complexity in Phase 2+).
- **D-15:** **Wire `PROCESSING` AppMode** (`src/types.ts` already defines it): when mock/real analysis exceeds the 800ms `SCANNING_ANIM` duration, transition to visible PROCESSING UI instead of appearing frozen (STAB-03).
- **D-16:** **Shutter double-tap guard (STAB-01):** ignore second shutter tap while `appMode === 'SCANNING_ANIM'`; optionally disable shutter button visually during lock.
- **D-17:** **Torch UI honesty (STAB-02):** if `track.getCapabilities().torch` is absent or constraint fails, do not toggle `isTorchOn` UI state — hide torch button or show disabled state.
- **D-18:** **Baseline upload dimensions (STAB-04):** when user uploads custom baseline via `handleUploadCustomBaseline`, update `imageDimensions` from loaded image natural width/height.

### Dependency & Project Hygiene
- **D-19:** **Remove unused server/AI deps** from `package.json`: `@google/genai`, `express`, `dotenv`, and unused `motion`. Aligns with pure-client constraint (TECH-03).
- **D-20:** **Rename package** from `react-example` to `shelfguard`; **update README.md** with ShelfGuard-specific local dev + Vercel deploy instructions (remove AI Studio/Gemini setup as primary path).
- **D-21:** **`metadata.json` AI Studio boilerplate** — leave unchanged in Phase 1 unless zero-cost; not blocking Vercel deploy.

### Claude's Discretion
- Exact `vercel.json` header path patterns (match generated SW filename from vite-plugin-pwa build output).
- Whether to disable PWA dev SW (`devOptions.enabled`) in production config only vs also locally.
- Minor banner styling (Tailwind classes) within existing design tokens.
- Bundling default shelf image into `public/` for offline default baseline (CONCERNS.md recommendation) — implement if trivial during Phase 1, else defer to Phase 2.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (requires sync after stack pivot)
- `.planning/REQUIREMENTS.md` — TECH-01/03/05/07, STAB-*, CAM-08/09, PWA-* (TECH-01/07 wording must be updated from Next.js to Vite before planning)
- `.planning/ROADMAP.md` — Phase 1 goal/success criteria (currently says Next.js; override with this CONTEXT.md until ROADMAP is edited)
- `.planning/PROJECT.md` — Core value, constraints, Key Decisions table (vision libs row pending TECH-06 OpenCV lock)

### Codebase Maps (brownfield)
- `.planning/codebase/STACK.md` — Current Vite/React/idb-keyval/vite-plugin-pwa stack
- `.planning/codebase/ARCHITECTURE.md` — AppMode FSM, capture flow, component responsibilities
- `.planning/codebase/CONCERNS.md` — Known bugs (demo capture, torch, shutter race, cameraError unwired)

### Deployment
- `https://vite-pwa-org.netlify.app/deployment/vercel` — PWA cache header patterns for Vercel
- `https://vercel.com/docs/frameworks/frontend/vite` — Vite SPA deploy + SPA rewrite

### Source of Truth (implementation targets)
- `vite.config.ts` — PWA plugin config
- `src/App.tsx` — FSM, shutter handler, baseline upload
- `src/hooks/useCameraStream.ts` — captureFrame, cameraError, torch
- `src/components/CameraView.tsx` — camera UI, error display target
- `src/types.ts` — AppMode including PROCESSING
- `src/lib/constants.ts` — I18N strings including cameraPermissionDenied

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/components/CameraView.tsx`** — Primary surface for error banner + shutter; already receives demo/camera props.
- **`src/hooks/useCameraStream.ts`** — Has `cameraError`, `captureFrame`, `toggleTorch`; needs UI wiring and capture fix only.
- **`src/components/OfflineIndicator.tsx`** — Offline banner exists; verify PWA-03 behavior after Vercel deploy.
- **`src/components/ScanningAnimationOverlay.tsx`** — 800ms scan animation; PROCESSING state follows this.
- **`vite-plugin-pwa`** — Already configured; only needs Vercel headers + deploy pipeline.

### Established Patterns
- **Central FSM in `App.tsx`** — All mode transitions via `AppMode` string union; Phase 1 patches in place, no hook extraction.
- **I18N via `I18N[lang]` in constants** — Extend for iOS PWA camera guidance, don't add parallel string tables.
- **IndexedDB via `idb-keyval`** — Unchanged in Phase 1; storage schema migration is Phase 2.

### Integration Points
- **Vercel build output `dist/`** — Must include generated `sw.js`, `manifest.webmanifest`, hashed `/assets/*`.
- **Camera permission flow** — `getUserMedia` in `useCameraStream.startCamera`; errors currently fall back to demo silently — change to surfaced error + explicit fallback.

</code_context>

<specifics>
## Specific Ideas

- User explicitly chose **Vite + Vercel over Next.js** because deployment simplicity was the driver — not a feature requirement for SSR/API routes.
- User locked **v1 vision to `@techstark/opencv-js` mandatory** (TECH-06 update pending) — overrides PROJECT.md "Canvas lightweight first" and `.planning/research/SUMMARY.md` pixelmatch recommendation for Phase 4 only; Phase 1 does not preload OpenCV.
- All seven gray areas discussed with **recommended defaults** (user: "全部 + 推荐默认") — no per-area custom overrides.

</specifics>

<deferred>
## Deferred Ideas

- **Next.js App Router migration** — Explicitly rejected for v1; revisit only if SSR, API routes, or team mandate emerges.
- **`useAuditFlow` / App.tsx hook decomposition** — Phase 2+ when multi-shelf state grows.
- **`@techstark/opencv-js` install + Web Worker scaffold** — Phase 4 (Real Inspection Pipeline).
- **`INITIAL_GUIDE` first-run onboarding** — Phase 5 (SHLF-05).
- **Bundle default shelf image to `public/`** — Nice-to-have; Claude discretion in Phase 1 or Phase 2.
- **Update `metadata.json` AI Studio fields** — Low priority cleanup.

</deferred>

---

*Phase: 1-Capture Foundation & Vercel Deploy*
*Context gathered: 2026-09-20*
