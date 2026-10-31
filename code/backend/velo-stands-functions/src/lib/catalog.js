"use strict";

const crypto = require("node:crypto");

// Stands, devices and assignments from the Cosmos "catalog" container, kept in
// memory per Function instance. The catalog is tiny (a few dozen documents),
// so one query per minute costs a few RU and saves a read on every request.

const DEFAULT_TTL_MS = 60_000;
const MIN_RELOAD_MS = 10_000; // an unknown key forces a reload, at most this often

/** "sha256:<hex>" of the key, the format stored in stands.yaml and the catalog. */
function hashKey(key) {
  return "sha256:" + crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

function buildCatalog(docs, loadedAt, requestCharge) {
  const site = docs.find((d) => d.type === "site") ?? null;
  const areas = new Map();
  const stands = new Map();
  const devices = [];
  const openAssignmentByDevice = new Map();

  for (const doc of docs) {
    if (doc.type === "area") areas.set(doc.areaId, doc);
    else if (doc.type === "stand") stands.set(doc.standId, doc);
    else if (doc.type === "device") {
      devices.push({ ...doc, keyHashBuffer: Buffer.from(String(doc.keyHash).toLowerCase(), "utf8") });
    } else if (doc.type === "assignment" && !doc.validTo && Date.parse(doc.validFrom) <= loadedAt) {
      openAssignmentByDevice.set(doc.deviceId, doc);
    }
  }

  // Which devices count towards each stand right now: open assignment, not retired.
  const devicesByStand = new Map();
  for (const device of devices) {
    const assignment = openAssignmentByDevice.get(device.deviceId);
    if (!assignment || device.status === "retired") continue;
    if (!devicesByStand.has(assignment.standId)) devicesByStand.set(assignment.standId, []);
    devicesByStand.get(assignment.standId).push(device.deviceId);
  }

  const settings = {
    staleAfterSeconds: site?.settings?.staleAfterSeconds ?? 300,
    reportIntervalSeconds: site?.settings?.reportIntervalSeconds ?? 60,
  };

  return {
    loadedAt,
    requestCharge,
    site,
    settings,
    areas,
    stands,
    devices,
    openAssignmentByDevice,
    devicesByStand,

    /** Finds the device by key hash. Compares against every device in constant time. */
    findDeviceByKeyHash(keyHash) {
      const wanted = Buffer.from(keyHash.toLowerCase(), "utf8");
      let match = null;
      for (const device of devices) {
        const candidate = device.keyHashBuffer;
        const same =
          candidate.length === wanted.length
            ? crypto.timingSafeEqual(candidate, wanted)
            : crypto.timingSafeEqual(wanted, wanted) && false;
        if (same && !match) match = device;
      }
      return match;
    },
  };
}

/**
 * @param {object} args
 * @param {() => import("@azure/cosmos").Container} args.container  the "catalog" container
 * @param {number} [args.ttlMs]
 * @param {() => number} [args.clock]
 */
function createCatalogCache({ container, ttlMs = DEFAULT_TTL_MS, clock = () => Date.now() }) {
  let current = null;
  let loading = null;

  async function load() {
    const started = clock();
    const response = await container().items.query("SELECT * FROM c").fetchAll();
    current = buildCatalog(response.resources, started, response.requestCharge ?? 0);
    return current;
  }

  return {
    /** Returns { catalog, ageMs, reloaded }. */
    async get({ force = false } = {}) {
      const now = clock();
      const tooOld = !current || now - current.loadedAt > ttlMs;
      const forcedOk = force && current && now - current.loadedAt > MIN_RELOAD_MS;
      if (tooOld || forcedOk) {
        loading = loading ?? load().finally(() => (loading = null));
        const catalog = await loading;
        return { catalog, ageMs: 0, reloaded: true };
      }
      return { catalog: current, ageMs: now - current.loadedAt, reloaded: false };
    },
  };
}

module.exports = { hashKey, buildCatalog, createCatalogCache };
