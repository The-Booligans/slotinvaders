#!/usr/bin/env bash
# hydra — compile, upload, then open the serial monitor.
#
# Usage: ./start.sh [PORT]
# PORT defaults to /dev/cu.usbmodem1101 or $HYDRA_PORT if set.

set -euo pipefail

# ESP32-S3 with 8 MB OPI PSRAM (as on the AtomS3R) + huge-app partition so the
# camera + Wi-Fi sketch fits. CDC on boot gives us a USB serial console.
FQBN="esp32:esp32:esp32s3:PSRAM=opi,FlashSize=8M,CDCOnBoot=cdc,PartitionScheme=huge_app"
PORT="${1:-${HYDRA_PORT:-/dev/cu.usbmodem1101}}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$HERE"

if [ ! -f secrets.h ]; then
  echo "[hydra] secrets.h is missing — copy secrets.example.h to secrets.h and fill it in." >&2
  exit 1
fi

echo "[hydra] compile   fqbn=$FQBN"
arduino-cli compile --fqbn "$FQBN" .

echo "[hydra] upload    port=$PORT"
arduino-cli upload --fqbn "$FQBN" -p "$PORT" .

echo "[hydra] monitor   port=$PORT  (Ctrl-C to quit)"
exec arduino-cli monitor -p "$PORT" -c baudrate=115200
