#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap: app deps + Mobile MCP package cache.
# Does not install an Android emulator, iOS Simulator, or device USB stack.
#
# REA (rea-agents@6.5.0, see .cursor/mcp.json) requires Node ^22.19.0 and the
# procps `ps` command on Linux. Node is pinned via nvm and symlinked into
# /usr/local/bin so a follow-on `npm install -g` in environment.json succeeds.
set -euo pipefail

# rea-agents@6.5.0 requires Node ^22.19.0 || ^24.11.0 || >=26
node_version_meets_rea_min() {
  local raw="${1#v}"
  local major minor
  major="$(echo "$raw" | cut -d. -f1)"
  minor="$(echo "$raw" | cut -d. -f2)"
  [[ "$major" -ge 26 ]] && return 0
  [[ "$major" -ge 24 && "$minor" -ge 11 ]] && return 0
  [[ "$major" -eq 22 && "$minor" -ge 19 ]] && return 0
  [[ "$major" -gt 22 ]] && return 0
  return 1
}

node_version_from_path() {
  local bin="$1"
  if [[ ! -x "$bin" ]]; then
    return 1
  fi
  "$bin" -v 2>/dev/null
}

resolve_nvm_node22_bin_dir() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    return 1
  fi
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install 22 >/dev/null 2>&1 || true
  nvm use 22 >/dev/null 2>&1 || true
  local node_path=""
  node_path="$(nvm which 22 2>/dev/null || true)"
  if [[ -z "$node_path" || ! -x "$node_path" ]]; then
    node_path="$(nvm which current 2>/dev/null || true)"
  fi
  if [[ -z "$node_path" || ! -x "$node_path" ]]; then
    return 1
  fi
  dirname "$node_path"
}

# Idempotent: skip when link already targets node_bin or points at Node >= 22.19.
# Never replace a regular (non-symlink) file that is already Node >= 22.19.
ensure_usr_local_bin_symlink() {
  local name="$1"
  local target="$2"
  local link="/usr/local/bin/$name"
  local target_node="${3:-}"

  if [[ -f "$link" && ! -L "$link" ]]; then
    if [[ "$name" == "node" ]]; then
      local ver
      ver="$(node_version_from_path "$link" || true)"
      if [[ -n "$ver" ]] && node_version_meets_rea_min "$ver"; then
        return 0
      fi
    elif [[ -n "$target_node" && -x "$target_node" ]]; then
      local ver
      ver="$(node_version_from_path "$target_node" || true)"
      if [[ -n "$ver" ]] && node_version_meets_rea_min "$ver"; then
        return 0
      fi
    fi
    return 0
  fi

  if [[ -L "$link" ]]; then
    local resolved=""
    resolved="$(readlink -f "$link" 2>/dev/null || readlink "$link" 2>/dev/null || true)"
    if [[ "$resolved" == "$target" ]]; then
      return 0
    fi
    local node_for_check=""
    if [[ "$name" == "node" && -n "$resolved" ]]; then
      node_for_check="$resolved"
    elif [[ -n "$resolved" ]]; then
      node_for_check="$(dirname "$resolved")/node"
    fi
    if [[ -n "$node_for_check" && -x "$node_for_check" ]]; then
      local ver
      ver="$(node_version_from_path "$node_for_check" || true)"
      if [[ -n "$ver" ]] && node_version_meets_rea_min "$ver"; then
        return 0
      fi
    fi
    sudo ln -sf "$target" "$link"
    return 0
  fi

  if [[ ! -e "$link" ]]; then
    sudo ln -sf "$target" "$link"
  fi
}

ensure_node_22_for_rea() {
  local node_bin=""
  node_bin="$(resolve_nvm_node22_bin_dir || true)"
  if [[ -n "$node_bin" && -x "$node_bin/node" ]]; then
    export PATH="$node_bin:$PATH"
    ensure_usr_local_bin_symlink node "$node_bin/node" "$node_bin/node"
    ensure_usr_local_bin_symlink npm "$node_bin/npm" "$node_bin/node"
    ensure_usr_local_bin_symlink npx "$node_bin/npx" "$node_bin/node"
  fi

  local major minor ver
  ver="$(node -v 2>/dev/null || true)"
  if [[ -z "$ver" ]]; then
    echo "error: Node 22+ required for rea-agents (node not found)" >&2
    exit 1
  fi
  major="$(echo "$ver" | sed 's/^v//' | cut -d. -f1)"
  minor="$(echo "$ver" | sed 's/^v//' | cut -d. -f2)"
  if [[ "$major" -lt 22 ]]; then
    echo "error: Node 22+ required for rea-agents (have $ver)" >&2
    exit 1
  fi
  if [[ "$major" -eq 22 && "$minor" -lt 19 ]]; then
    echo "error: rea-agents@6.5.0 requires Node ^22.19.0 (have $ver)" >&2
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
