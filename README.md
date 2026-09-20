# ShelfGuard

Pure-client PWA for retail shelf inspection — capture a fixture photo, compare against a per-shelf baseline, and see what's missing or displaced.

## Local Development

**Prerequisites:** Node.js 20+ or [Bun](https://bun.sh)

1. Install dependencies:
   ```bash
   bun install
   # or: npm install
   ```
2. Start the dev server:
   ```bash
   bun run dev
   # or: npm run dev
   ```
3. Open http://localhost:3000

Camera access requires HTTPS in production or `localhost` in development.

## Build

```bash
bun run build
# or: npm run build
```

Output directory: `dist/`

## Deploy to Vercel

1. Push this repository to GitHub (or GitLab/Bitbucket).
2. In [Vercel Dashboard](https://vercel.com/new), import the repository.
3. Framework preset: **Vite** (auto-detected).
4. Build command: `bun run build` (or `npm run build`).
5. Output directory: `dist`.
6. Production branch: `main`. Enable preview deployments on pull requests.

Root `vercel.json` configures SPA routing and PWA-safe cache headers for Service Worker updates.

## Test

```bash
bun run test
bun run lint
```
