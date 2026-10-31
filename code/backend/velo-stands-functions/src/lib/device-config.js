"use strict";

// GET /api/v1/device/config
//
// A device fetches its own config at boot (and when it reconnects). The
// X-Api-Key identifies the device, so each device only ever sees its own knobs
// — like /v1/readings, the key is the whole authentication.
//
// Response:
//   { device, stand, slots, config }
//
// `config` is the free-form object from stands.yaml (thresholds, how many slot
// bays the device covers, report interval, …). The backend treats it as opaque
// — only the firmware knows which keys it understands — and devices without a
// `config:` block get `{}` so a fresh fetch always has the same shape.

const { hashKey } = require("./catalog");
const { reply } = require("./http");

function logError(context, tag, err) {
  context.error(`${tag} ${err?.stack ?? err?.message ?? err}`);
}

/**
 * @param {object} deps
 * @param {{ get: (opts?: {force?: boolean}) => Promise<{catalog: any}> }} deps.catalogCache
 */
function createDeviceConfigHandler({ catalogCache }) {
  return async function handleDeviceConfig(request, context) {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) return reply(401, { error: "missing X-Api-Key header" });
    const keyHash = hashKey(apiKey.trim());

    let catalog;
    try {
      ({ catalog } = await catalogCache.get());
      if (!catalog.findDeviceByKeyHash(keyHash)) {
        // Maybe the device was added since the catalog was loaded.
        const fresh = await catalogCache.get({ force: true });
        if (fresh.reloaded) catalog = fresh.catalog;
      }
    } catch (err) {
      logError(context, "[device/config]", err);
      return reply(503, { error: "catalog unavailable, try again" }, { "Retry-After": "30" });
    }

    const device = catalog.findDeviceByKeyHash(keyHash);
    if (!device || device.status === "retired") {
      return reply(401, { error: "unknown or revoked API key" });
    }

    const assignment = catalog.openAssignmentByDevice.get(device.deviceId);
    const stand = assignment && catalog.stands.get(assignment.standId);

    return reply(200, {
      device: device.deviceId,
      stand: stand?.standId ?? null,
      slots: stand?.slots ?? null,
      config: device.config ?? {},
    });
  };
}

module.exports = { createDeviceConfigHandler };
