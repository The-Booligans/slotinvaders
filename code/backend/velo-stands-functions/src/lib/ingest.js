"use strict";

const crypto = require("node:crypto");
const { hashKey } = require("./catalog");
const { validateReading } = require("./validate");
const { computeStand, describeParts } = require("./occupancy");
const { reply, clientIp: getClientIp, round } = require("./http");
const { deviceLog: defaultDeviceLog } = require("./device-log");

// POST /api/v1/readings
//
// A device sends the number of bikes it sees. The function
//   1. identifies the device by its X-Api-Key (only the SHA-256 hash is stored),
//   2. finds the stand the device is assigned to and checks the body,
//   3. updates the device's latest count in the area's "state" document and
//      recomputes the stand: free = max(0, slots - sum of its devices' counts),
//   4. appends the reading to "readings" (history, kept 30 days),
// and logs every step, so the Function's log shows exactly what happened.

const RATE_LIMIT_MS = 2_000; // at most one request per device every 2 s (devices may report every 5 s)
const MAX_STATE_ATTEMPTS = 5; // retries when two devices of an area write at the same time

// The readings handler needs more than http.js's generic logger: every line
// also gets appended to the per-device ring buffer the debug app reads back
// through GET /api/v1/debug/devices/{deviceId}/logs. The device id is only
// known after step 1, so the caller passes a getter instead of the value.
function createLogger(context, verbose, { deviceLog, getDeviceId }) {
  const tag = `[readings ${String(context.invocationId ?? "local").slice(0, 8)}]`;
  const record = (level, message) => {
    const deviceId = getDeviceId();
    if (deviceId) deviceLog.push(deviceId, { level, source: "api", message });
  };
  return {
    step: (message) => {
      if (verbose) context.log(`${tag} ${message}`);
      record("debug", message);
    },
    info: (message) => {
      context.log(`${tag} ${message}`);
      record("info", message);
    },
    warn: (message) => {
      context.warn(`${tag} ${message}`);
      record("warn", message);
    },
    error: (message, err) => {
      const full = `${message}${err ? `: ${err.message ?? err}` : ""}`;
      context.error(`${tag} ${full}`);
      record("error", full);
    },
  };
}

/**
 * @param {object} deps
 * @param {{ get: (opts?: {force?: boolean}) => Promise<{catalog: any, ageMs: number, reloaded: boolean}> }} deps.catalogCache
 * @param {() => { state: any, readings: any }} deps.containers
 * @param {() => Date} [deps.now]
 * @param {boolean} [deps.verbose]
 */
function createReadingsHandler({
  catalogCache,
  containers,
  now = () => new Date(),
  verbose = true,
  deviceLog = defaultDeviceLog,
}) {
  return async function handleReading(request, context) {
    const started = Date.now();
    let currentDeviceId = null;
    const log = createLogger(context, verbose, {
      deviceLog,
      getDeviceId: () => currentDeviceId,
    });
    const receivedAt = now();
    const clientIp = getClientIp(request);
    let ru = 0;

    const finish = (response, summary) => {
      const ms = Date.now() - started;
      const line = `<- ${response.status} in ${ms} ms, ${round(ru)} RU${summary ? ` | ${summary}` : ""}`;
      if (response.status >= 500) log.error(line);
      else if (response.status >= 400) log.warn(line);
      else log.info(line);
      return response;
    };

    log.step(`-> ${request.method} ${new URL(request.url).pathname} from ${clientIp}`);

    // 1. Who is calling? -------------------------------------------------------
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return finish(reply(401, { error: "missing X-Api-Key header" }), "no API key");
    }
    const keyHash = hashKey(apiKey.trim());

    let lookup;
    try {
      lookup = await catalogCache.get();
      let device = lookup.catalog.findDeviceByKeyHash(keyHash);
      if (!device) {
        // Maybe the device was added since the catalog was loaded.
        const fresh = await catalogCache.get({ force: true });
        if (fresh.reloaded) {
          lookup = fresh;
          device = lookup.catalog.findDeviceByKeyHash(keyHash);
        }
      }
      lookup.device = device;
    } catch (err) {
      log.error("couldn't load the catalog from Cosmos DB", err);
      return finish(reply(503, { error: "catalog unavailable, try again" }, { "Retry-After": "30" }));
    }
    const { catalog, device } = lookup;
    if (lookup.reloaded) {
      ru += catalog.requestCharge;
      log.step(
        `catalog loaded: ${catalog.stands.size} stands, ${catalog.devices.length} devices, ` +
          `${catalog.openAssignmentByDevice.size} open assignments (${round(catalog.requestCharge)} RU)`
      );
    } else {
      log.step(`catalog from cache (${Math.round(lookup.ageMs / 1000)} s old)`);
    }

    if (!device || device.status === "retired") {
      const why = device ? `device ${device.deviceId} is retired` : `unknown key (hash ${keyHash.slice(0, 15)}...)`;
      if (device) currentDeviceId = device.deviceId;
      return finish(reply(401, { error: "unknown or revoked API key" }), why);
    }
    currentDeviceId = device.deviceId;
    if (device.status === "maintenance") {
      return finish(reply(403, { error: "device is in maintenance" }), `device ${device.deviceId} is in maintenance`);
    }

    const assignment = catalog.openAssignmentByDevice.get(device.deviceId);
    const stand = assignment && catalog.stands.get(assignment.standId);
    if (!stand) {
      return finish(
        reply(409, { error: "device is not assigned to a stand" }),
        `device ${device.deviceId} has no open assignment`
      );
    }
    if (stand.retiredAt) {
      return finish(reply(409, { error: "the device's stand is retired" }), `stand ${stand.standId} is retired`);
    }
    const areaId = stand.areaId;
    log.step(
      `device ${device.deviceId} "${device.name}" (${device.hardware}, mode ${device.mode}) -> ` +
        `stand ${stand.standId} "${stand.name}" (${stand.slots} slots) in area ${areaId}`
    );

    // 2. What did it send? -----------------------------------------------------
    let raw;
    let body;
    try {
      raw = await request.text();
      body = JSON.parse(raw);
    } catch {
      log.step(`body is not valid JSON: ${JSON.stringify(String(raw ?? "").slice(0, 200))}`);
      return finish(reply(400, { error: "body must be valid JSON" }), `device ${device.deviceId}: invalid JSON`);
    }
    const checked = validateReading(body, stand.slots);
    if (!checked.ok) {
      log.step(`body refused: ${checked.errors.join("; ")}`);
      return finish(
        reply(422, { error: "invalid reading", details: checked.errors }),
        `device ${device.deviceId}: ${checked.errors.join("; ")}`
      );
    }
    const reading = checked.value;
    log.step(
      `body: occupied=${reading.occupied} seq=${reading.seq}` +
        (reading.measuredAt ? ` measuredAt=${reading.measuredAt}` : "") +
        (reading.fw ? ` fw=${reading.fw}` : "") +
        (reading.rssi !== undefined ? ` rssi=${reading.rssi}` : "")
    );

    // 3. Update the area's state and recompute the stand ------------------------
    const { state, readings } = containers();
    const stateItem = state.item(areaId, areaId);
    const staleAfterSeconds = catalog.settings.staleAfterSeconds;
    const standDeviceIds = catalog.devicesByStand.get(stand.standId) ?? [device.deviceId];
    let standResult;
    let attempt = 0;

    try {
      for (;;) {
        attempt++;
        const read = await stateItem.read();
        ru += read.requestCharge ?? 0;
        let doc = read.resource;
        let etag = read.etag;

        if (!doc) {
          log.step(`no state document for area ${areaId} yet, creating it`);
          try {
            const created = await state.items.create({ id: areaId, areaId, devices: {}, stands: {}, updatedAt: receivedAt.toISOString() });
            ru += created.requestCharge ?? 0;
            doc = created.resource;
            etag = created.etag;
          } catch (err) {
            if (err.code === 409 && attempt < MAX_STATE_ATTEMPTS) continue; // created by a parallel request
            throw err;
          }
        }

        const previous = doc.devices?.[device.deviceId];
        if (attempt === 1) {
          if (previous) {
            const ago = (receivedAt.getTime() - Date.parse(previous.at)) / 1000;
            log.step(`previous: occupied=${previous.occupied} seq=${previous.seq} at ${previous.at} (${ago.toFixed(1)} s ago)`);
          } else {
            log.step("previous: none, this is the device's first reading");
          }
        }

        if (previous) {
          const sinceMs = receivedAt.getTime() - Date.parse(previous.at);
          if (reading.seq <= previous.seq) {
            if (sinceMs <= staleAfterSeconds * 1000) {
              return finish(
                reply(200, { device: device.deviceId, duplicate: true, nextInSeconds: catalog.settings.reportIntervalSeconds }),
                `device ${device.deviceId}: seq ${reading.seq} <= last seq ${previous.seq}, ignored as duplicate or late retry`
              );
            }
            log.step(`seq ${reading.seq} <= last seq ${previous.seq}, but the last reading is ${Math.round(sinceMs / 1000)} s old: treating it as a device restart`);
          } else if (sinceMs < RATE_LIMIT_MS) {
            return finish(
              reply(429, { error: "too many requests, wait 2 s between readings" }, { "Retry-After": "2" }),
              `device ${device.deviceId}: last reading only ${sinceMs} ms ago`
            );
          }
        }

        const deviceState = {
          standId: stand.standId,
          occupied: reading.occupied,
          source: "device",
          seq: reading.seq,
          at: receivedAt.toISOString(),
        };
        if (reading.measuredAt) deviceState.measuredAt = reading.measuredAt;

        const devices = { ...(doc.devices ?? {}), [device.deviceId]: deviceState };
        standResult = computeStand({
          slots: stand.slots,
          deviceIds: standDeviceIds,
          devices,
          now: receivedAt,
          staleAfterSeconds,
        });

        const next = {
          ...doc,
          devices,
          stands: {
            ...(doc.stands ?? {}),
            [stand.standId]: {
              slots: standResult.slots,
              occupied: standResult.occupied,
              free: standResult.free,
              devices: standDeviceIds,
              missingDevices: standResult.missing,
              staleDevices: standResult.stale,
              at: receivedAt.toISOString(),
            },
          },
          updatedAt: receivedAt.toISOString(),
        };

        try {
          const replaced = await stateItem.replace(next, { accessCondition: { type: "IfMatch", condition: etag } });
          ru += replaced.requestCharge ?? 0;
          break;
        } catch (err) {
          if (err.code === 412 && attempt < MAX_STATE_ATTEMPTS) {
            log.step(`state of area ${areaId} changed in the meantime (another device), retrying (attempt ${attempt + 1})`);
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      log.error(`couldn't update the state of area ${areaId} (attempt ${attempt})`, err);
      return finish(reply(503, { error: "storage unavailable, try again" }, { "Retry-After": "10" }));
    }

    log.step(
      `stand ${stand.standId}: ${describeParts(standResult.parts)} = ${standResult.occupied} of ${standResult.slots} slots -> ${standResult.free} free` +
        (standResult.overCapacity ? " (more bikes than slots, free clamped to 0)" : "") +
        (standResult.stale.length ? `; stale devices: ${standResult.stale.join(", ")}` : "")
    );
    log.step(`state of area ${areaId} updated (attempt ${attempt})`);

    // 4. Append the reading to the history --------------------------------------
    const readingDoc = {
      id: crypto.randomUUID(),
      standId: stand.standId,
      areaId,
      deviceId: device.deviceId,
      source: "device",
      occupied: reading.occupied,
      seq: reading.seq,
      receivedAt: receivedAt.toISOString(),
      slots: standResult.slots,
      standOccupied: standResult.occupied,
      standFree: standResult.free,
    };
    if (reading.measuredAt) readingDoc.measuredAt = reading.measuredAt;
    if (reading.fw) readingDoc.fw = reading.fw;
    if (reading.rssi !== undefined) readingDoc.rssi = reading.rssi;

    try {
      const created = await readings.items.create(readingDoc);
      ru += created.requestCharge ?? 0;
      log.step(`reading ${readingDoc.id} stored in history`);
    } catch (err) {
      // The live count is already right; only this history point is missing.
      log.error(`reading couldn't be stored in history (state is updated)`, err);
    }

    return finish(
      reply(202, {
        device: device.deviceId,
        stand: stand.standId,
        occupied: reading.occupied,
        standOccupied: standResult.occupied,
        slots: standResult.slots,
        free: standResult.free,
        nextInSeconds: catalog.settings.reportIntervalSeconds,
      }),
      `${device.deviceId} -> ${stand.standId}: ${reading.occupied} bikes, stand ${standResult.occupied}/${standResult.slots}, ${standResult.free} free`
    );
  };
}

module.exports = { createReadingsHandler, RATE_LIMIT_MS };
