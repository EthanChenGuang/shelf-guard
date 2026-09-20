# Walking Skeleton — ShelfGuard

**Phase:** 1
**Generated:** 2026-09-20

## Capability Proven End-to-End

A retail field rep opens the deployed Vite PWA on Vercel, sees the demo shelf feed, taps the shutter, and completes one mock inspection cycle — with the captured frame matching what was displayed, the app shell cached offline, and planning docs aligned to the Vite stack (not Next.js).

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Vite 8 + React 19 + TypeScript + Tailwind 4 | Locked D-01 — pure-client PWA needs no SSR; brownfield stack already works |
| PWA / Service Worker | `vite-plugin-pwa` with `registerType: 'autoUpdate'` | Locked D-05/D-06 — replaces @serwist/next; Vercel cache headers prevent stale shell |
| Data layer | `idb-keyval` (existing `src/lib/storage.ts`) | TECH-04 unchanged Phase 1; App.tsx already reads/writes baseline + history |
| Auth | None (local device PWA) | v1 single-device constraint |
| Deployment target | Vercel static SPA (`dist/`, SPA rewrite) | Locked D-02/D-03 — Git-connected deploys; preview on PRs |
| Directory layout | Brownfield flat `src/` — FSM in `App.tsx`, hooks in `src/hooks/`, components in `src/components/` | Minimal blast radius D-14; no hook extraction until Phase 2+ |
| Vision | Mock analysis in `src/lib/vision.ts` (main thread) | OpenCV + Worker deferred to Phase 4 per D-12 |

## Stack Touched in Phase 1

- [x] Project scaffold (Vite build, TypeScript lint, Vitest Wave 0)
- [x] Routing — SPA single entry (`index.html` → `App.tsx` FSM modes)
- [x] Database — IndexedDB read on init (`loadBaseline`, `loadAuditHistory`) + write on audit complete (`saveAuditRecord`)
- [x] UI — Shutter tap wired through FSM → mock vision → result view
- [x] Deployment — `vercel.json` + production build producing `dist/sw.js` and `dist/manifest.json`

## Out of Scope (Deferred to Later Slices)

- Next.js App Router migration (explicitly rejected D-01)
- `@techstark/opencv-js` install + Web Worker vision pipeline (Phase 4, D-12)
- Multi-shelf IndexedDB namespacing (Phase 2)
- Ghost overlay, level gauge, iOS orientation permission (Phase 3)
- `useAuditFlow` hook extraction from `App.tsx` (Phase 2+, D-14)
- INITIAL_GUIDE first-run onboarding (Phase 5)
- Minimalist Light design system polish (Phase 5)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2:** Multi-shelf IndexedDB isolation + legacy migration
- **Phase 3:** Guided capture quality (ghost overlay, level gauge, iOS orientation)
- **Phase 4:** Real OpenCV pixel diff in Web Worker replacing mock vision
- **Phase 5:** PRD UI fidelity, 5-shelf carousel, bilingual polish
