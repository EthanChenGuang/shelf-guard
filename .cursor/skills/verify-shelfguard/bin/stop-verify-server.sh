#!/usr/bin/env bash
set -euo pipefail
PID_FILE="${SHELFGUARD_VERIFY_PID_FILE:-/tmp/shelfguard-verify.pid}"
if [[ ! -f "$PID_FILE" ]]; then
  echo "No pid file at $PID_FILE"
  exit 0
fi
pid="$(cat "$PID_FILE")"
if kill -0 "$pid" 2>/dev/null; then
  kill "$pid" || true
  echo "Stopped preview server pid $pid"
else
  echo "Pid $pid not running"
fi
rm -f "$PID_FILE"
