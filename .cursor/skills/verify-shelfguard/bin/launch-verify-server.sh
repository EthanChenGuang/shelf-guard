#!/usr/bin/env bash
# Start a production preview server for ShelfGuard verification (OpenCV is not served correctly on Vite dev — see features/inspect-scan.md Gotchas).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../../" && pwd)"
cd "$ROOT"
PORT="${SHELFGUARD_VERIFY_PORT:-4173}"
HOST="${SHELFGUARD_VERIFY_HOST:-127.0.0.1}"
PID_FILE="${SHELFGUARD_VERIFY_PID_FILE:-/tmp/shelfguard-verify.pid}"
URL="http://${HOST}:${PORT}"

if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE")"
  if kill -0 "$old_pid" 2>/dev/null; then
    echo "Preview already running (pid $old_pid) at $URL"
    exit 0
  fi
fi

npm run build
nohup npm run preview -- --host "$HOST" --port "$PORT" > /tmp/shelfguard-verify.log 2>&1 &
echo $! > "$PID_FILE"

for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "$URL/"; then
    echo "ShelfGuard preview ready at $URL (pid $(cat "$PID_FILE"))"
    exit 0
  fi
  sleep 1
done

echo "Preview failed to start; see /tmp/shelfguard-verify.log" >&2
exit 1
