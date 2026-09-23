# Technology Stack

**Analysis Date:** 2026-09-20

## Languages

**Primary:**
- TypeScript 7.0.2 — All application logic in `src/` (`.tsx` components, `.ts` hooks/lib/types)
- JSX/TSX — React 19 component layer (`src/App.tsx`, `src/components/*.tsx`)

**Secondary:**
- HTML — Shell document in `index.html` (PWA meta tags, font CDN links)
- CSS — Tailwind utility layer in `src/index.css` via `@import "tailwindcss"`
- JSON — PWA manifest (`public/manifest.json`), AI Studio metadata (`metadata.json`)

## Runtime

**Environment:**
- **Browser (production):** Client-only PWA; no server-side rendering. Entry at `src/main.tsx` mounts React to `#root`.
- **Node.js (development/build):** Vite dev server and production bundling. README lists Node.js as prerequisite; local environment has Node v23.10.0.

**Package Manager:**
- Bun 1.3.0 — Lockfile present at `bun.lock` (165KB, full dependency resolution)
- npm — Supported via `package.json` scripts; README documents `npm install` / `npm run dev`
- Lockfile: present (`bun.lock`); no `package-lock.json` or `pnpm-lock.yaml`

## Frameworks

**Core:**
- React 19.0.1 — SPA UI with hooks-based state machine in `src/App.tsx`
- Vite 8.3.0 — Dev server, HMR, and production build (`vite.config.ts`)
- Tailwind CSS 4.3.3 — Utility-first styling via `@tailwindcss/vite` plugin

**Testing:**
- Not detected — No Jest, Vitest, Playwright, or Cypress config. `npm run lint` runs `tsc --noEmit` only.

**Build/Dev:**
- `@vitejs/plugin-react` 6.1.1 — Fast Refresh and JSX transform
- `vite-plugin-pwa` 1.3.0 — Service worker registration with `registerType: 'autoUpdate'` (`vite.config.ts`)
- `tsx` 4.21.0 — TypeScript execution (dev dependency; no script wired in `package.json`)
- `esbuild` 0.25.0 — Bundler dependency (transitive via Vite)
- `autoprefixer` 10.4.21 — CSS vendor-prefixing (dev dependency)

## Key Dependencies

**Critical (actively used in `src/`):**
- `react` / `react-dom` ^19.0.1 — UI framework
- `idb-keyval` ^6.3.0 — IndexedDB key-value wrapper for baseline, audit history, settings (`src/lib/storage.ts`)
- `lucide-react` ^0.546.0 — Icon set across all `src/components/*.tsx`
- `canvas-confetti` ^1.9.4 — Celebration animation on audit completion (`src/components/ResultInspectView.tsx`)
- `@tailwindcss/vite` ^4.3.3 + `tailwindcss` ^4.3.3 — Styling pipeline

**Declared but not imported in application code:**
- `@google/genai` ^2.4.0 — Gemini SDK; listed in `package.json` and declared as AI Studio capability in `metadata.json`, but no imports under `src/`
- `express` ^4.21.2 — HTTP server framework; no `server.js` or Express entry point in repo
- `dotenv` ^17.2.3 — Env loading; no usage in `src/` (AI Studio injects secrets at deploy time)
- `motion` ^12.23.24 — Animation library; zero references in `src/`

**Infrastructure:**
- `vite` ^8.3.0 — Build toolchain and dev server
- `@vitejs/plugin-react` ^6.1.1 — React integration for Vite

## Configuration

**Environment:**
- `.env.example` documents required vars: `GEMINI_API_KEY`, `APP_URL`
- `.gitignore` excludes `.env*` except `.env.example`
- Vite does not define custom `envPrefix` or `define` blocks in `vite.config.ts`; no `import.meta.env` usage in `src/`
- AI Studio injects `GEMINI_API_KEY` and `APP_URL` at runtime per `.env.example` comments

**Build:**
- `vite.config.ts` — Plugins (React, Tailwind, PWA), path alias `@` → project root, HMR toggle via `DISABLE_HMR` env var
- `tsconfig.json` — ES2022 target, ESNext modules, `jsx: "react-jsx"`, path alias `@/*` → `./*`, `noEmit: true`
- `index.html` — Vite entry, PWA meta, Google Fonts preconnect
- `public/manifest.json` — Standalone PWA manifest (portrait, theme colors, icons)
- `metadata.json` — AI Studio app metadata: camera permission, `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`

**Scripts (`package.json`):**
```bash
npm run dev       # vite --port=3000 --host=0.0.0.0
npm run build     # vite build → dist/
npm run preview   # vite preview
npm run lint      # tsc --noEmit
npm run clean     # rm -rf dist server.js
```

## Platform Requirements

**Development:**
- Node.js (README prerequisite)
- Bun optional (lockfile present)
- Modern browser with camera API for live capture testing (`src/hooks/useCameraStream.ts`)
- `GEMINI_API_KEY` in `.env.local` for local AI Studio parity (not consumed by current mock vision pipeline)

**Production:**
- **Google AI Studio** — Primary deployment target per `README.md` (Cloud Run service URL via `APP_URL`)
- Static PWA build output in `dist/` suitable for any static host
- Portrait-oriented mobile web app (`public/manifest.json` `orientation: "portrait"`)
- Requires HTTPS for camera, device orientation, and PWA install APIs

---

*Stack analysis: 2026-09-20*
