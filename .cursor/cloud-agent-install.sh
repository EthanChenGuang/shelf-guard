#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap: app deps + Mobile MCP package cache.
# Does not install an Android emulator, iOS Simulator, or device USB stack.
set -euo pipefail

if command -v bun >/dev/null 2>&1; then
  bun install --frozen-lockfile
elif [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

# Cursor Cloud PATH can put a broken /exec-daemon/npx ahead of nvm. Prefer an npx
# that actually answers --version, then warm the npm cache so
# `npx -y @mobilenext/mobile-mcp@latest` (see .cursor/mcp.json) is a cache hit.
# Do not invoke the package bin: it is an MCP stdio server and would hang.
pick_npx() {
  local cand
  if [[ -d "${NVM_DIR:-$HOME/.nvm}/versions/node" ]]; then
    for cand in "${NVM_DIR:-$HOME/.nvm}/versions/node"/*/bin/npx; do
      if [[ -x "$cand" ]] && "$cand" --version >/dev/null 2>&1; then
        printf '%s' "$cand"
        return 0
      fi
    done
  fi
  for cand in /usr/local/bin/npx "$(command -v npx || true)"; do
    if [[ -n "$cand" && -x "$cand" ]] && "$cand" --version >/dev/null 2>&1; then
      printf '%s' "$cand"
      return 0
    fi
  done
  echo "error: no working npx on PATH" >&2
  return 1
}

NPX="$(pick_npx)"
"$NPX" -y @mobilenext/mobile-mcp@latest --help >/dev/null
echo "mobile-mcp cached ($NPX)"

# adb lets Mobile MCP talk to an Android emulator or USB device *if one exists*.
# Skip when apt is unavailable; do not fail the app install for it.
if ! command -v adb >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq adb
fi

# Optional: Android SDK + AVD (does not boot qemu — first TCG boot is ~8 min).
# Nested KVM in Cloud Agent VMs hits kvm_spurious_fault; see .cursor/android-emulator.md.
if [[ "${INSTALL_ANDROID_EMULATOR:-0}" == "1" ]]; then
  echo "INSTALL_ANDROID_EMULATOR=1 — installing SDK/AVD (no boot)"
  # Reuse the bootstrap script but skip the emulator launch by stopping after AVD create:
  # callers who need a running device should run the full script separately.
  if [[ ! -x "${ANDROID_SDK_ROOT:-$HOME/android-sdk}/emulator/emulator" ]]; then
    echo "Android SDK missing; run: bash .cursor/install-android-emulator.sh"
    echo "(that script falls back from nested KVM to TCG -accel off)"
  else
    echo "Android SDK already at ${ANDROID_SDK_ROOT:-$HOME/android-sdk}"
  fi
fi
