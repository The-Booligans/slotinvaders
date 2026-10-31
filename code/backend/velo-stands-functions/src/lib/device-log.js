"use strict";

// In-memory per-device log ring buffer, shared across the HTTP functions of
// one Function App instance. The ingest handler pushes one entry per reading
// (and one per warning or error), and the debug endpoint reads them out.
//
// This is per instance — restarts and scale-out lose the buffer. That is fine:
// the authoritative log lives in Application Insights, and these entries exist
// so the debug page can show "what happened recently to this device" without
// querying App Insights. The buffer is capped so a chatty device can't drift
// memory upwards.

const DEFAULT_MAX_PER_DEVICE = 200;

function createDeviceLog({ maxPerDevice = DEFAULT_MAX_PER_DEVICE, clock = () => new Date() } = {}) {
  const buffers = new Map(); // deviceId -> array of entries, newest last

  function push(deviceId, entry) {
    if (!deviceId) return;
    let buffer = buffers.get(deviceId);
    if (!buffer) {
      buffer = [];
      buffers.set(deviceId, buffer);
    }
    const at = entry.at ?? clock().toISOString();
    buffer.push({
      at,
      deviceId,
      level: entry.level ?? "info",
      source: entry.source ?? "api",
      message: entry.message ?? "",
      ...(entry.context ? { context: entry.context } : {}),
    });
    if (buffer.length > maxPerDevice) buffer.splice(0, buffer.length - maxPerDevice);
  }

  function entries(deviceId, limit = maxPerDevice) {
    const buffer = buffers.get(deviceId);
    if (!buffer) return [];
    const n = Math.max(1, Math.min(limit, maxPerDevice));
    return buffer.slice(-n);
  }

  function devices() {
    return [...buffers.keys()];
  }

  function clear() {
    buffers.clear();
  }

  return { push, entries, devices, clear };
}

// Default singleton used by the running Function App.
const deviceLog = createDeviceLog({
  maxPerDevice: Number(process.env.DEVICE_LOG_MAX || DEFAULT_MAX_PER_DEVICE),
});

module.exports = { createDeviceLog, deviceLog, DEFAULT_MAX_PER_DEVICE };
