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

## Mobile UI verification (Mobile MCP)

This repo wires [mobile-mcp](https://github.com/mobile-next/mobile-mcp) so Cursor agents can drive a real iOS/Android simulator, emulator, or device — not just a desktop Chromium viewport.

Project config lives in [`.cursor/mcp.json`](.cursor/mcp.json) (`npx -y @mobilenext/mobile-mcp@latest`). Cloud Agent VMs cache that package (and install `adb` when apt is available) during [`.cursor/cloud-agent-install.sh`](.cursor/cloud-agent-install.sh) (see [`.cursor/environment.json`](.cursor/environment.json)). After merge, enable the same stdio server in the Cloud Agents MCP dropdown at [cursor.com/agents](https://cursor.com/agents) if it does not appear automatically. No API keys are required for local/emulator use.

On some Cursor Cloud VMs the first `npx` on `PATH` is `/exec-daemon/npx` (npm 11), which crashes before spawning the server. The install script uses a working nvm `npx` to warm the cache. If the MCP process fails to start in the cloud, run the same command with a working Node 20+ `npx` (for example `$NVM_DIR/versions/node/*/bin/npx`).

### Prerequisites (a device must exist)

Mobile MCP starts without a device, but every useful tool call needs one of:

| Target | What must be present |
| --- | --- |
| Android emulator | Android SDK, `ANDROID_HOME`, a **booted** AVD, `adb devices` shows it |
| Android real device | `adb`, USB debugging authorized (or `adb connect`) |
| iOS Simulator | macOS + Xcode, a **booted** simulator (`xcrun simctl`) |
| iOS real device | macOS, trusted device, extra go-ios / WebDriverAgent setup |

Cursor Cloud Linux VMs do **not** ship a booted emulator or USB device. `/dev/kvm` may exist but is typically not usable by the `ubuntu` user, so nesting an AVD inside the agent VM is not supported. Use a local machine (or a self-hosted worker) that already has a device, then point the agent at a Vercel preview URL.

Playwright device profiles in `scripts/mobile-simulator-uat.mjs` are a desktop-Chromium stand-in. They do not replace Mobile MCP.

### Agent flow for this app

1. Confirm a device with `mobile_list_available_devices`. If the list is empty, stop and record that mobile checks were skipped.
2. Open the **Vercel preview** (or production) URL in the device browser with `mobile_open_url` (Chrome/Safari on the device — not the Cloud Agent desktop browser).
3. `mobile_set_orientation` to **landscape** (this PWA is camera/shelf-inspection first; landscape is the layout to verify).
4. `mobile_take_screenshot` / `mobile_save_screenshot`, then tap/swipe via the screen tools as needed.
5. Save proof under `/opt/cursor/artifacts/` (cloud) or the PR artifacts directory.

The **verify-shelfguard** skill (unmerged [PR #7](https://github.com/EthanChenGuang/shelf-guard/pull/7)) drives desktop Chromium via Playwright. When that skill lands, it should use Mobile MCP for **mobile** checks (preview URL on a real device/emulator, landscape, screenshots) in addition to the existing Playwright gallery-upload flows. If no device is available, skip those mobile steps and say so.
