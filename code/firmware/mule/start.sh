#!/usr/bin/env bash
# mule — compile, upload, then open the serial monitor.
#
# Usage: ./start.sh [PORT]
# PORT defaults to /dev/cu.usbmodem1101 or $MULE_PORT if set.
#
# To only compile (e.g. when another device is still on the USB port), run:
#   ./start.sh --compile-only

set -euo pipefail

# Same board as hydra: AtomS3R has an ESP32-S3 with 8 MB OPI PSRAM. We need
# the huge-app partition so the camera + Wi-Fi + Edge Impulse model fit.
FQBN="esp32:esp32:esp32s3:PSRAM=opi,FlashSize=8M,CDCOnBoot=cdc,PartitionScheme=huge_app"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

if [ ! -f secrets.h ]; then
  echo "[mule] secrets.h is missing — copy secrets.example.h to secrets.h and fill it in." >&2
  exit 1
fi

if [ "${1:-}" = "--compile-only" ] || [ "${1:-}" = "-c" ]; then
  echo "[mule] compile-only  fqbn=$FQBN"
  exec arduino-cli compile --fqbn "$FQBN" .
fi

PORT="${1:-${MULE_PORT:-/dev/cu.usbmodem1101}}"

echo "[mule] compile   fqbn=$FQBN"
arduino-cli compile --fqbn "$FQBN" .

echo "[mule] upload    port=$PORT"
arduino-cli upload --fqbn "$FQBN" -p "$PORT" .

echo "[mule] monitor   port=$PORT  (Ctrl-C to quit)"
exec arduino-cli monitor -p "$PORT" -c baudrate=115200
