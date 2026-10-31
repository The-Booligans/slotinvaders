#!/usr/bin/env bash
# mule — build, flash and monitor on an M5Stack AtomS3R-CAM-M12 (ESP32-S3).
#
# Usage: ./start.sh [PORT]
# PORT defaults to /dev/cu.usbmodem1101 or $MULE_PORT if set.
#
# Needs ESP-IDF 5.3+ on PATH. Source $IDF_PATH/export.sh in the shell first,
# or let this script try the usual Homebrew install location.

set -euo pipefail

PORT="${1:-${MULE_PORT:-/dev/cu.usbmodem1101}}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v idf.py >/dev/null 2>&1; then
  for guess in "$HOME/esp/esp-idf/export.sh" "/opt/esp-idf/export.sh"; do
    if [ -f "$guess" ]; then
      # shellcheck disable=SC1090
      . "$guess"
      break
    fi
  done
fi

if ! command -v idf.py >/dev/null 2>&1; then
  echo "[mule] idf.py not on PATH — source \$IDF_PATH/export.sh first" >&2
  exit 1
fi

cd "$HERE"

idf.py set-target esp32s3 >/dev/null
echo "[mule] build"
idf.py build
echo "[mule] flash + monitor   port=$PORT  (Ctrl-] to quit)"
exec idf.py -p "$PORT" flash monitor
