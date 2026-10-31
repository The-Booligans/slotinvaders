#!/usr/bin/env bash
# thor — compile, upload, then open the serial monitor.
#
# Usage: ./start.sh [PORT]
# PORT defaults to /dev/cu.usbmodem1101 or $THOR_PORT if set.

set -euo pipefail

FQBN="esp32:esp32:m5stack_atoms3"
PORT="${1:-${THOR_PORT:-/dev/cu.usbmodem1101}}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$HERE"

echo "[thor] compile   fqbn=$FQBN"
arduino-cli compile --fqbn "$FQBN" .

echo "[thor] upload    port=$PORT"
arduino-cli upload --fqbn "$FQBN" -p "$PORT" .

echo "[thor] monitor   port=$PORT  (Ctrl-C to quit)"
exec arduino-cli monitor -p "$PORT" -c baudrate=115200
