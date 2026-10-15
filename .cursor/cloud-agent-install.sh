#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap: app deps + Mobile MCP package cache.
# Does not install an Android emulator, iOS Simulator, or device USB stack.
#
# REA (rea-agents@6.5.0, see .cursor/mcp.json) requires Node ^22.19.0 and the
# procps `ps` command on Linux. Node is pinned via nvm and symlinked into
# /usr/local/bin so a follow-on `npm install -g` in environment.json succeeds.
set -euo pipefail

ensure_node_22_for_rea() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    nvm install 22 >/dev/null 2>&1 || true
    nvm use 22 >/dev/null 2>&1 || true
    local ver node_bin
    ver="$(node -v | tr -d v)"
    node_bin="$NVM_DIR/versions/node/$ver/bin"
    if [[ -x "$node_bin/node" ]]; then
      sudo ln -sf "$node_bin/node" /usr/local/bin/node
      sudo ln -sf "$node_bin/npm" /usr/local/bin/npm
      sudo ln -sf "$node_bin/npx" /usr/local/bin/npx
      export PATH="$node_bin:$PATH"
    fi
  fi
  local major minor
  major="$(node -v | sed 's/^v//' | cut -d. -f1)"
  minor="$(node -v | sed 's/^v//' | cut -d. -f2)"
  if [[ "$major" -lt 22 ]]; then
    echo "error: Node 22+ required for rea-agents (have $(node -v))" >&2
    exit 1
  fi
  if [[ "$major" -eq 22 && "$minor" -lt 19 ]]; then
    echo "error: rea-agents@6.5.0 requires Node ^22.19.0 (have $(node -v))" >&2
    exit 1
  fi
}

ensure_procps_ps() {
  if command -v ps >/dev/null 2>&1; then
    return 0
  fi
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq procps
  fi
  if ! command -v ps >/dev/null 2>&1; then
    echo "error: procps (ps) is required for rea-agents on Linux" >&2
    exit 1
  fi
}

ensure_node_22_for_rea
ensure_procps_ps

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
