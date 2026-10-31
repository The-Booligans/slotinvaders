"use strict";

// GET /api/v1/config
// GET /api/v1/debug/devices
// GET /api/v1/debug/devices/{deviceId}/logs?limit=N
//
// All three are anonymous and read-only. The config endpoint builds the public
// shape the front ends expect (no keyHash). The debug endpoints add the latest
// state of each device (lastSeenAt + stale) and the recent log entries from
// the in-memory ring buffer. There is no image endpoint yet, so lastImage is
// always null — the field exists so the client's shape stays stable.

const { reply } = require("./http");
const { deviceLog: defaultDeviceLog } = require("./device-log");

function logError(context, tag, err) {
  context.error(`${tag} ${err?.stack ?? err?.message ?? err}`);
}

function toPublicConfig(catalog) {
  const siteDoc = catalog.site ?? {};
  const site = {
    id: siteDoc.siteId ?? "unknown",
    name: siteDoc.name ?? siteDoc.siteId ?? "unknown",
    timezone: siteDoc.timezone ?? "Europe/Zurich",
  };

  const areas = [...catalog.areas.values()].map((a) => ({
    id: a.areaId,
    name: a.name ?? a.areaId,
    kind: a.kind,
  }));

  const stands = [...catalog.stands.values()]
    .filter((s) => !s.retiredAt)
    .map((s) => ({
      id: s.standId,
      area: s.areaId,
      ...(s.name && s.name !== s.standId ? { name: s.name } : {}),
      slots: s.slots,
    }));

  const devices = catalog.devices
    .filter((d) => d.status !== "retired")
    .map((d) => {
      const assignment = catalog.openAssignmentByDevice.get(d.deviceId);
      return {
        id: d.deviceId,
        stand: assignment?.standId ?? "",
        hardware: d.hardware ?? "unknown",
        mode: d.mode,
      };
    });

  return { version: 1, site, areas, stands, devices };
}

/**
 * GET /api/v1/config
 * The public config: site, areas, stands and devices. keyHash is never shipped.
 */
function createConfigHandler({ catalogCache }) {
  return async function handleConfig(_request, context) {
    try {
      const { catalog } = await catalogCache.get();
      return reply(200, toPublicConfig(catalog));
    } catch (err) {
      logError(context, "[config]", err);
      return reply(503, { error: "catalog unavailable, try again" }, { "Retry-After": "30" });
    }
  };
}

function parsePositiveInt(value, fallback, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return max ? Math.min(n, max) : n;
}

function deviceLatest(catalog, areaStatesByDevice, deviceId, nowMs) {
  const latest = areaStatesByDevice.get(deviceId);
  if (!latest) return { lastSeenAt: null, stale: true };
  const ageSeconds = (nowMs - Date.parse(latest.at)) / 1000;
  const stale = ageSeconds > (catalog.settings?.staleAfterSeconds ?? 300);
  return { lastSeenAt: latest.at, stale };
}

async function readAreaStates(stateContainer) {
  const { resources } = await stateContainer.items.query("SELECT * FROM c").fetchAll();
  const byDevice = new Map();
  for (const area of resources) {
    for (const [deviceId, entry] of Object.entries(area?.devices ?? {})) {
      byDevice.set(deviceId, entry);
    }
  }
  return byDevice;
}

/**
 * GET /api/v1/debug/devices
 * One summary per device: its public info, lastSeenAt from state and whether
 * it is stale. lastImage is always null until /v1/images is in place.
 */
function createDebugDevicesHandler({ catalogCache, containers, now = () => new Date() }) {
  return async function handleDebugDevices(_request, context) {
    const nowDate = now();
    let catalog;
    try {
      ({ catalog } = await catalogCache.get());
    } catch (err) {
      logError(context, "[debug/devices]", err);
      return reply(503, { error: "catalog unavailable, try again" }, { "Retry-After": "30" });
    }

    let areaStatesByDevice;
    try {
      areaStatesByDevice = await readAreaStates(containers().state);
    } catch (err) {
      logError(context, "[debug/devices]", err);
      // The catalog is already fine, so fall back to "we have no live state yet".
      areaStatesByDevice = new Map();
    }

    const devices = catalog.devices
      .filter((d) => d.status !== "retired")
      .map((d) => {
        const assignment = catalog.openAssignmentByDevice.get(d.deviceId);
        const { lastSeenAt, stale } = deviceLatest(catalog, areaStatesByDevice, d.deviceId, nowDate.getTime());
        return {
          device: {
            id: d.deviceId,
            stand: assignment?.standId ?? "",
            hardware: d.hardware ?? "unknown",
            mode: d.mode,
          },
          lastImage: null,
          lastSeenAt,
          stale: lastSeenAt === null ? true : stale,
        };
      });

    return reply(200, { at: nowDate.toISOString(), devices });
  };
}

/**
 * GET /api/v1/debug/devices/{deviceId}/logs?limit=N
 * The ring buffer for one device. Limit is capped at the buffer size.
 */
function createDebugLogsHandler({ catalogCache, deviceLog = defaultDeviceLog, maxLimit = 500 }) {
  return async function handleDebugLogs(request, context) {
    const deviceId = request.params?.deviceId;
    if (!deviceId) return reply(400, { error: "deviceId is required" });

    const url = new URL(request.url);
    const limit = parsePositiveInt(url.searchParams.get("limit"), 200, maxLimit);

    try {
      const { catalog } = await catalogCache.get();
      const known = catalog.devices.some((d) => d.deviceId === deviceId);
      if (!known) return reply(404, { error: `unknown device "${deviceId}"` });
    } catch (err) {
      // If the catalog is down, still try to return whatever we have cached in
      // the ring buffer rather than blocking the UI entirely.
      logError(context, "[debug/logs]", err);
    }

    return reply(200, { deviceId, entries: deviceLog.entries(deviceId, limit) });
  };
}

module.exports = {
  toPublicConfig,
  createConfigHandler,
  createDebugDevicesHandler,
  createDebugLogsHandler,
};
