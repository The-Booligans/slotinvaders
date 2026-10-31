"use strict";

// In-memory per-device latest JPEG, shared across HTTP functions of one
// Function App instance. The debug image upload handler writes to it and the
// debug image fetch handler reads from it. Per instance, like device-log: on
// restart or scale-out the frames are gone, which is fine for a debug view.
//
// Only the latest frame per device is kept, so one chatty camera cannot drift
// memory upwards. Oversized bodies are refused upstream.

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB, well above a 800×600 JPEG

function createImageStore({ maxBytes = DEFAULT_MAX_BYTES, clock = () => new Date() } = {}) {
  const latest = new Map(); // deviceId -> { buffer, mimeType, seq, receivedAt, width, height }

  function put(deviceId, { buffer, mimeType = "image/jpeg", seq, width, height } = {}) {
    if (!deviceId) throw new Error("deviceId is required");
    if (!Buffer.isBuffer(buffer)) throw new Error("buffer must be a Buffer");
    if (buffer.length === 0) throw new Error("buffer is empty");
    if (buffer.length > maxBytes) throw new Error(`buffer exceeds ${maxBytes} bytes`);
    const previous = latest.get(deviceId);
    const nextSeq = Number.isFinite(seq) ? seq : (previous?.seq ?? 0) + 1;
    const entry = {
      buffer,
      mimeType,
      seq: nextSeq,
      receivedAt: clock().toISOString(),
      ...(Number.isFinite(width) ? { width } : {}),
      ...(Number.isFinite(height) ? { height } : {}),
    };
    latest.set(deviceId, entry);
    return entry;
  }

  function get(deviceId) {
    return latest.get(deviceId) ?? null;
  }

  function devices() {
    return [...latest.keys()];
  }

  function clear() {
    latest.clear();
  }

  return { put, get, devices, clear, maxBytes };
}

const imageStore = createImageStore({
  maxBytes: Number(process.env.DEBUG_IMAGE_MAX_BYTES || DEFAULT_MAX_BYTES),
});

module.exports = { createImageStore, imageStore, DEFAULT_MAX_BYTES };
