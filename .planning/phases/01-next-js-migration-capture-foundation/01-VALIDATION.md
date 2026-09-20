---
phase: "01"
slug: "next-js-migration-capture-foundation"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-20"
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x + jsdom (Wave 0 install) |
| **Config file** | none — Wave 0 installs `vitest.config.ts` |
| **Quick run command** | `npx vitest run --passWithNoTests` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run lint` (tsc --noEmit)
- **After every plan wave:** Run `bun run build` + inspect `dist/sw.js` precache entries
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | TECH-01/07 | — | Build produces SW + manifest | smoke | `bun run build && test -f dist/sw.js` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | STAB-01 | — | Shutter ignores second tap during capture lock | unit | `npx vitest run src/App.capture.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | STAB-02 | — | Torch hidden when capability absent | unit | `npx vitest run src/hooks/useCameraStream.torch.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | STAB-03 | — | PROCESSING shown when analysis slow | unit | `npx vitest run src/App.processing.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | STAB-04 | — | Upload sets imageDimensions | unit | `npx vitest run src/App.baseline.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | CAM-08 | T-01-01 | cameraError renders banner text | component | `npx vitest run src/components/CameraView.error.test.tsx` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 1 | CAM-09 | — | Demo capture uses baseline URL not CDN constant | unit | `npx vitest run src/hooks/useCameraStream.capture.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 1 | PWA-03 | — | OfflineIndicator shows when offline | component | `npx vitest run src/components/OfflineIndicator.test.tsx` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 1 | TECH-03 | T-01-05 | No server imports in src | static | `rg '@google/genai|express|dotenv' src/` | ✅ | ⬜ pending |
| 01-04-03 | 04 | 1 | PWA-02 | T-01-01 | SW precache excludes user image patterns | smoke | Manual: inspect `dist/sw.js` precache list post-build | ✅ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add Vitest + jsdom + `@testing-library/react` devDependencies
- [ ] `vitest.config.ts` with `@/` alias matching vite.config.ts
- [ ] Unit tests for captureFrame demo branch, torch capability, shutter lock ref
- [ ] Planner task: update REQUIREMENTS.md TECH-01/TECH-07 + ROADMAP Phase 1 naming
- [ ] Framework install: `bun add -d vitest jsdom @testing-library/react @testing-library/jest-dom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PWA install + offline shell on Vercel preview | PWA-01, PWA-02 | Requires real browser + Vercel deploy | Install PWA from preview URL; go offline; verify app shell loads; confirm no user photos in SW precache |
| iOS standalone camera permission flow | CAM-08 | Requires iOS device | Open as PWA; deny camera; verify banner shows iOS Safari guidance |
| Camera permission denied UX | CAM-08 | Browser permission API | Deny camera; verify inline banner (not console-only) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
