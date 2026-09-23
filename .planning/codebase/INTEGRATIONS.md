# External Integrations

**Analysis Date:** 2026-09-20

## APIs & External Services

**AI / Vision (planned, not wired):**
- Google Gemini API — Declared for server-side shelf comparison via AI Studio
  - SDK/Client: `@google/genai` ^2.4.0 in `package.json` (no imports in `src/`)
  - Auth: `GEMINI_API_KEY` env var (documented in `.env.example`)
  - Capability flag: `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` in `metadata.json`
  - Current behavior: `src/lib/vision.ts` returns mock anomalies from `INITIAL_MOCK_ANOMALIES` in `src/lib/constants.ts`; no network calls

**CDN / Static Assets:**
- Google Fonts — Typography loaded from CDN in `index.html`
  - URLs: `fonts.googleapis.com`, `fonts.gstatic.com`
  - Families: Inter (400–700), JetBrains Mono (400–600)
- Google-hosted demo shelf image — Default baseline/camera fallback in `src/lib/constants.ts`
  - URL: `lh3.googleusercontent.com/aida-public/...` (`DEFAULT_SHELF_IMAGE_URL`)
  - Used when demo feed is active or camera capture fails (`src/hooks/useCameraStream.ts`)

**Hosting Platform:**
- Google AI Studio — App origin and deployment path
  - App link: `https://ai.studio/apps/b976b15f-e113-4283-abfc-5f730ac9d968` (`README.md`)
  - `APP_URL` env var: Cloud Run service URL injected at deploy time (`.env.example`)

## Data Storage

**Databases:**
- IndexedDB (browser) — Client-side persistence via `idb-keyval`
  - Connection: Browser `indexedDB` API (no server connection string)
  - Client: `idb-keyval` wrapper in `src/lib/storage.ts`
  - Keys:
    - `shelfguard_baseline` — Shelf calibration (`ShelfCalibration`)
    - `shelfguard_audit_history` — Last 50 audit records (`AuditRecord[]`)
    - `shelfguard_lang` — UI language (`cn` | `en`)
    - `shelfguard_tolerance` — Tolerance level (`strict` | `normal` | `loose`)

**File Storage:**
- Local filesystem only — User-uploaded baseline images read via `FileReader.readAsDataURL()` in `src/App.tsx` (`handleUploadCustomBaseline`); stored as data URLs in IndexedDB
- Captured frames stored as JPEG data URLs in audit records (`thumbnailUrl` field in `AuditRecord`)

**Caching:**
- Service worker — PWA auto-update via `vite-plugin-pwa` (`vite.config.ts`, `registerType: 'autoUpdate'`)
- No Redis, CDN cache config, or external object storage

## Authentication & Identity

**Auth Provider:**
- None — No login, OAuth, JWT, or session management in `src/`
- All data is device-local in IndexedDB; no user accounts or multi-device sync

## Monitoring & Observability

**Error Tracking:**
- None — No Sentry, Datadog, or similar SDK

**Logs:**
- Browser `console.warn` / `console.error` in `src/lib/storage.ts` and `src/hooks/useCameraStream.ts` for IndexedDB and camera failures
- No structured logging or log shipping

## CI/CD & Deployment

**Hosting:**
- Google AI Studio / Cloud Run — Documented deployment target (`README.md`, `.env.example` `APP_URL`)
- Static `dist/` output from `vite build` — No Dockerfile, `vercel.json`, or `.github/workflows/` detected

**CI Pipeline:**
- None — No GitHub Actions, CircleCI, or other CI config in repo root

## Environment Configuration

**Required env vars:**
- `GEMINI_API_KEY` — Gemini API authentication (AI Studio Secrets panel / `.env.local` locally)
- `APP_URL` — Hosted applet URL for self-referential links and OAuth callbacks (AI Studio injects Cloud Run URL)

**Optional env vars:**
- `DISABLE_HMR=true` — Disables Vite HMR and file watching (`vite.config.ts`; used in AI Studio agent editing)

**Secrets location:**
- Local: `.env.local` (gitignored per `.gitignore`)
- Production: AI Studio Secrets panel (auto-injected at runtime per `.env.example`)

## Webhooks & Callbacks

**Incoming:**
- None — No Express routes, API endpoints, or webhook handlers in repo (`express` is a dependency but unused)

**Outgoing:**
- None — No `fetch()`, `XMLHttpRequest`, or WebSocket usage in `src/`

## Browser & Device APIs (runtime integrations)

These are not third-party services but are critical external interfaces the app depends on:

| API | Purpose | Implementation |
|-----|---------|----------------|
| `navigator.mediaDevices.getUserMedia` | Live camera capture | `src/hooks/useCameraStream.ts` |
| `MediaStreamTrack.applyConstraints` (torch) | Flashlight toggle | `src/hooks/useCameraStream.ts` |
| `DeviceOrientationEvent` | Shelf level/plumb alignment | `src/hooks/useDeviceOrientation.ts` |
| `navigator.vibrate` | Haptic feedback on level/capture | `src/App.tsx`, `src/hooks/useDeviceOrientation.ts` |
| `CanvasRenderingContext2D` | Frame capture to JPEG data URL | `src/hooks/useCameraStream.ts`, `src/lib/vision.ts` |
| `beforeinstallprompt` / `appinstalled` | PWA install prompt | `src/hooks/usePWAInstall.ts` |
| `navigator.onLine` + `online`/`offline` events | Offline indicator | `src/components/OfflineIndicator.tsx` |
| `FileReader` | Custom baseline image upload | `src/App.tsx` |
| `navigator.share` | Not detected — Share icon present in `ResultInspectView.tsx` UI but no Web Share API call found |

## Integration Gaps (current vs. intended)

| Integration | Status | Notes |
|-------------|--------|-------|
| Gemini vision analysis | Dependency only | Replace mock logic in `src/lib/vision.ts` with `@google/genai` calls |
| Express server | Dependency only | `package.json` `clean` script references `server.js`; file absent |
| Real image diff | Not implemented | Comments in `vision.ts` describe pixel diffing; code uses static mock anomalies |
| Backend sync | Not implemented | Audit records stay local in IndexedDB; no API upload |

---

*Integration audit: 2026-09-20*
