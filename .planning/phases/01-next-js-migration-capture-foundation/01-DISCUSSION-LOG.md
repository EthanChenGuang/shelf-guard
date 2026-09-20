# Phase 1: Capture Foundation & Vercel Deploy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 1-Capture Foundation & Vercel Deploy
**Areas discussed:** Vercel deploy strategy, PWA cache on Vercel, camera permission UX, demo mode behavior, OpenCV preload timing, FSM refactor depth, cleanup scope

---

## Stack Pivot (pre-gray-area)

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate to Next.js App Router | Original ROADMAP Phase 1 goal | |
| **Keep Vite + deploy Vercel** | Static SPA/PWA; simpler deploy | ✓ |

**User's choice:** 保留 Vite + Vercel（部署是主因，不需要改现有技术栈）
**Notes:** User asked whether existing stack deploys easily to Vercel; confirmed yes with vercel.json. Next.js migration removed from Phase 1 scope.

---

## 1. Vercel Deploy Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| **Git → Vercel auto-deploy** | main = production, PR = preview | ✓ |
| CLI-only deploys | Manual `vercel` without Git integration | |
| Other static host | Netlify, Cloudflare Pages, etc. | |

**User's choice:** Recommended default (全部 + 推荐默认)
**Notes:** Build `npm run build`, output `dist`, Vite auto-detected.

---

## 2. PWA Release Cache Headers

| Option | Description | Selected |
|--------|-------------|----------|
| **vercel.json PWA headers + autoUpdate** | no-store html/sw/manifest; immutable /assets/* | ✓ |
| Default Vercel caching only | Risk stale index.html after deploy | |
| prompt user for SW updates | registerType: 'prompt' | |

**User's choice:** Recommended default
**Notes:** Follows vite-pwa-org Vercel deployment guide to avoid MIME type errors post-release.

---

## 3. Camera Permission Failure UX

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen modal | Blocks entire camera view | |
| **Inline banner on CameraView** | Stays in context; can switch demo | ✓ |
| Toast only | Easy to miss | |

**User's choice:** Recommended default
**Notes:** Wire existing `cameraError` from `useCameraStream`; include iOS standalone PWA steps in I18N.

---

## 4. Demo Mode Default Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| **Default demo feed on first launch** | Lower permission friction | ✓ |
| Camera-first on launch | Immediate getUserMedia prompt | |
| Fix capture only | Keep default; fix frame source | ✓ (combined) |

**User's choice:** Recommended default
**Notes:** CAM-09 fix: capture displayed frame not CDN URL.

---

## 5. OpenCV in Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| Install @techstark/opencv-js + Worker stub | ~8MB WASM early | |
| **Defer to Phase 4** | Phase 1 stays lean | ✓ |

**User's choice:** Recommended default
**Notes:** User separately locked v1 vision to mandatory OpenCV (TECH-06 update) — applies Phase 4+, not Phase 1 install.

---

## 6. FSM Refactor Depth

| Option | Description | Selected |
|--------|-------------|----------|
| **Minimal bugfix patch** | PROCESSING, shutter lock, errors | ✓ |
| Extract useAuditFlow hook | Larger refactor | |

**User's choice:** Recommended default
**Notes:** Hook extraction deferred to Phase 2+.

---

## 7. Cleanup Scope

| Option | Description | Selected |
|--------|-------------|----------|
| **Remove dead deps + rename package + README** | @google/genai, express, dotenv, motion | ✓ |
| Full AI Studio metadata purge | metadata.json, etc. | |
| Deps only | Minimal | |

**User's choice:** Recommended default
**Notes:** metadata.json left to Claude discretion / defer.

---

## Cross-Phase Vision Lock

| Option | Description | Selected |
|--------|-------------|----------|
| pixelmatch / Canvas lightweight (research default) | Smaller bundle | |
| **@techstark/opencv-js mandatory for v1** | User explicit; TECH-06 to be updated | ✓ |

**User's choice:** User stated before gray-area selection: "v1 必须用 @techstark/opencv-js"
**Notes:** Overrides PROJECT.md and research SUMMARY pixelmatch-first recommendation for Phase 4 planning.

---

## Claude's Discretion

- vercel.json exact path patterns after build
- PWA dev SW enabled locally
- Default shelf image bundling to public/
- metadata.json cleanup timing

## Deferred Ideas

- Next.js migration (rejected v1)
- useAuditFlow hook extraction
- OpenCV install (Phase 4)
- INITIAL_GUIDE (Phase 5)
