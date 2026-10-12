#!/usr/bin/env bash
# Boot a headless Android emulator for Mobile MCP in this Cloud Agent VM.
set -euo pipefail
exec > >(tee -a /tmp/android-emulator-install.log) 2>&1

export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/android-sdk}"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
AVD_NAME="${AVD_NAME:-shelfguard_api34}"
CMDLINE_ZIP_URL="${CMDLINE_ZIP_URL:-https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip}"
SYS_IMAGE="${SYS_IMAGE:-system-images;android-34;google_apis;x86_64}"

echo "=== $(date -Is) android emulator bootstrap ==="
echo "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
echo "user=$(id)"
echo "kvm=$(ls -l /dev/kvm 2>/dev/null || true)"

if [[ -e /dev/kvm ]]; then
  sudo chmod 666 /dev/kvm || true
  if getent group kvm >/dev/null 2>&1; then
    sudo usermod -aG kvm "$(id -un)" || true
  fi
else
  echo "WARN: /dev/kvm missing — will try software accel"
fi

sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  unzip wget ca-certificates \
  libpulse0 libnss3 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
  libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxtst6 \
  libglu1-mesa libgl1 mesa-utils libdrm2 libgbm1 \
  adb || true

mkdir -p "$ANDROID_SDK_ROOT"
if [[ ! -x "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "=== downloading cmdline-tools ==="
  TMPZIP="$(mktemp /tmp/cmdline-tools-XXXX.zip)"
  if ! wget -q --show-progress -O "$TMPZIP" "$CMDLINE_ZIP_URL"; then
    echo "primary zip failed, trying 11076708"
    wget -q --show-progress -O "$TMPZIP" \
      "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  fi
  STAGE="$(mktemp -d)"
  unzip -q "$TMPZIP" -d "$STAGE"
  mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
  rm -rf "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  if [[ -d "$STAGE/cmdline-tools" ]]; then
    mv "$STAGE/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  else
    mv "$STAGE"/* "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  fi
  rm -rf "$STAGE" "$TMPZIP"
fi

yes | sdkmanager --sdk_root="$ANDROID_SDK_ROOT" --licenses >/dev/null || true
echo "=== installing SDK packages ==="
sdkmanager --sdk_root="$ANDROID_SDK_ROOT" --install \
  "platform-tools" \
  "emulator" \
  "platforms;android-34" \
  "$SYS_IMAGE"

echo "=== creating AVD $AVD_NAME ==="
echo "no" | avdmanager create avd \
  --force \
  --name "$AVD_NAME" \
  --package "$SYS_IMAGE" \
  --device "pixel_6" || true

AVD_DIR="${ANDROID_AVD_HOME:-$HOME/.android/avd}/${AVD_NAME}.avd"
if [[ -f "$AVD_DIR/config.ini" ]]; then
  python3 - <<PY
from pathlib import Path
p = Path("$AVD_DIR") / "config.ini"
text = p.read_text()
updates = {
    "hw.keyboard": "yes",
    "hw.ramSize": "2048",
    "hw.gpu.enabled": "yes",
    "hw.gpu.mode": "swiftshader_indirect",
    "hw.lcd.density": "420",
    "disk.dataPartition.size": "4096M",
    "showDeviceFrame": "no",
}
lines = []
seen = set()
for line in text.splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k = line.split("=", 1)[0].strip()
        if k in updates:
            lines.append(f"{k}={updates[k]}")
            seen.add(k)
            continue
    lines.append(line)
for k, v in updates.items():
    if k not in seen:
        lines.append(f"{k}={v}")
p.write_text("\n".join(lines) + "\n")
print(f"updated {p}")
PY
fi

echo "=== emulator -list-avds ==="
emulator -list-avds || true

if [[ -f /tmp/android-emulator.pid ]]; then
  oldpid=$(cat /tmp/android-emulator.pid || true)
  if [[ -n "${oldpid}" ]] && kill -0 "$oldpid" 2>/dev/null; then
    echo "stopping leftover emulator pid $oldpid"
    kill "$oldpid" || true
    sleep 2
  fi
fi

ACCEL_ARGS=(-accel on)
if [[ ! -r /dev/kvm ]]; then
  echo "KVM unreadable — falling back to software accel"
  ACCEL_ARGS=(-accel off)
fi

echo "=== booting emulator (headless) ==="
nohup emulator -avd "$AVD_NAME" \
  -no-window \
  -no-audio \
  -no-boot-anim \
  -gpu swiftshader_indirect \
  "${ACCEL_ARGS[@]}" \
  -netdelay none \
  -netspeed full \
  -no-snapshot \
  -wipe-data \
  -verbose \
  > /tmp/android-emulator-run.log 2>&1 &
echo $! > /tmp/android-emulator.pid
echo "emulator pid $(cat /tmp/android-emulator.pid)"

export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"
wait_for_adb_device() {
  local tries="${1:-90}"
  for i in $(seq 1 "$tries"); do
    if adb devices | grep -E 'emulator-[0-9]+\s+device' >/dev/null; then
      echo "adb device listed at try $i"
      return 0
    fi
    sleep 2
  done
  return 1
}

echo "waiting for adb device..."
if ! wait_for_adb_device 45; then
  if [[ "${ACCEL_ARGS[*]}" == *"-accel on"* ]]; then
    echo "KVM boot hung (nested KVM often hits kvm_spurious_fault). Restarting with TCG -accel off."
    emupid=$(cat /tmp/android-emulator.pid || true)
    if [[ -n "${emupid}" ]] && kill -0 "$emupid" 2>/dev/null; then
      kill "$emupid" || true
      sleep 3
      kill -0 "$emupid" 2>/dev/null && kill -9 "$emupid" || true
    fi
    adb kill-server || true
    ACCEL_ARGS=(-accel off)
    nohup emulator -avd "$AVD_NAME" \
      -no-window \
      -no-audio \
      -no-boot-anim \
      -gpu swiftshader_indirect \
      "${ACCEL_ARGS[@]}" \
      -netdelay none \
      -netspeed full \
      -no-snapshot \
      -verbose \
      > /tmp/android-emulator-run.log 2>&1 &
    echo $! > /tmp/android-emulator.pid
    echo "TCG emulator pid $(cat /tmp/android-emulator.pid)"
    wait_for_adb_device 90 || true
  fi
fi
adb devices -l || true

echo "waiting for boot_completed..."
for i in $(seq 1 120); do
  boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
  if [[ "$boot" == "1" ]]; then
    echo "boot_completed=1 at try $i"
    break
  fi
  sleep 3
done
adb shell getprop sys.boot_completed || true
adb shell getprop ro.product.model || true
adb shell wm size || true
echo "=== DONE $(date -Is) ==="
