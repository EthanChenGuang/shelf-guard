# Android emulator + Mobile MCP (Cloud Agent)

What actually worked in the 2026-10-12 Cloud Agent VM for PR #8.

## What worked

1. **`/dev/kvm` exists** and `sudo chmod 666 /dev/kvm` succeeds. `emulator -accel-check` reports KVM usable.
2. **Nested KVM does not run a guest.** This VM is itself KVM (`kvm-guest` in dmesg). Booting the Android emulator with `-accel on` starts qemu with `-enable-kvm`, then the host kernel hits `kvm_spurious_fault` (`kernel BUG at arch/x86/kvm/x86.c`). qemu stays at ~0.3% CPU and `adb` stays `offline`.
3. **TCG software emulation works.** Same AVD with `-accel off -gpu swiftshader_indirect -no-window` comes online:

   ```
   emulator-5554  device  product:sdk_gphone64_x86_64  model:sdk_gphone64_x86_64
   sys.boot_completed=1
   Physical size: 1080x2400
   ```

   First boot took ~8 minutes on 4 vCPU. `mobile_list_available_devices` (Mobile MCP 1.0.10) returned:

   ```json
   {"devices":[{"id":"shelfguard_api34","name":"shelfguard api34","platform":"android","type":"emulator","version":"14","state":"online","model":"sdk_gphone64_x86_64"}]}
   ```

4. **Chrome is on the `google_apis` x86_64 API 34 image** (`com.android.chrome`). Opening `http://127.0.0.1:4173/` via `adb reverse tcp:4173 tcp:4173` + `am start -a android.intent.action.VIEW` reached Chrome’s “Welcome to Chrome” first-run screen (screenshot captured).
5. **Vercel preview protection bypass returned 403** from this agent’s Vercel connection, so emulator testing used the local preview, not the `*.vercel.app` URL.
6. **TCG is fragile.** After Chrome first-run, `input` / window focus dropped (`mCurrentFocus=null`), then the guest showed “Pixel is starting…”. Headless SwiftShader + TCG is enough to prove the device is online for Mobile MCP, not enough for a reliable tap-every-control session.

## What did not work

- Nested KVM (`-accel on`)
- Saving Mobile MCP screenshots under `/opt/cursor/artifacts` (server only allows cwd + `/tmp`)
- `get_access_to_vercel_url` for this project (403)

## Reproduce

```bash
# SDK + AVD + boot (KVM, then TCG fallback)
bash .cursor/install-android-emulator.sh

export ANDROID_SDK_ROOT="$HOME/android-sdk" ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"

adb devices -l
# Mobile MCP (stdio) or the CLI it wraps:
npx -y @mobilenext/mobile-mcp@latest --help
# CLI used by the MCP server:
# ~/.npm/_npx/.../mobilecli-linux-amd64 devices
```

Boot flags that reached `device`:

```
emulator -avd shelfguard_api34 \
  -no-window -no-audio -no-boot-anim \
  -gpu swiftshader_indirect -accel off \
  -netdelay none -netspeed full -no-snapshot
```

Opt-in SDK install during Cloud Agent bootstrap (does **not** boot the AVD — first boot is too slow for every agent):

```bash
INSTALL_ANDROID_EMULATOR=1 bash .cursor/cloud-agent-install.sh
```

## Bug verification for this PR

Pinch flicker and post-rotate white-strip asserts ran in **verify-shelfguard** (Playwright, `hasTouch`, 390×844 / 844×390 / 932×430): blink-toggle count 0 during rapid 1↔2 finger pinch; after orientationchange, `scrollX === 0` and `documentElement.scrollWidth === innerWidth` on capture and results. The emulator proved Mobile MCP device discovery; it did not complete an in-Chrome PWA session.
