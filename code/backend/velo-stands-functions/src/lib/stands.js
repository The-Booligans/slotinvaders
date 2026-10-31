"use strict";

const { computeStand, describeParts } = require("./occupancy");
const { createLogger, reply, clientIp, round } = require("./http");

// GET /api/v1/stands                 all stands
// GET /api/v1/stands?area=<areaId>   the stands of one area
// GET /api/v1/stands/<standId>       one stand
//
// Public and read-only: no key needed. Returns each stand's name, current
// occupancy (bikes counted now) and maximum occupancy (slots). The numbers are
// worked out on every request from the latest device counts in "state" and
// the stands in "catalog", so a device that went quiet shows up as stale.

const DEFAULT_STATE_TTL_MS = 5_000;
const CACHE_MAX_AGE_SECONDS = 5;

/**
 * The latest device counts of all areas, from the "state" container, kept in
 * memory for a few seconds. However many people open the app, Cosmos DB is
 * asked at most once per TTL and Function instance.
 */
function createStateCache({ container, ttlMs = DEFAULT_STATE_TTL_MS, clock = () => Date.now() }) {
  let current = null;
  let loading = null;

  async function load() {
    const started = clock();
    const response = await container().items.query("SELECT c.id, c.areaId, c.devices FROM c").fetchAll();
    const byArea = new Map(response.resources.map((d) => [d.areaId ?? d.id, d.devices ?? {}]));
    current = { loadedAt: started, byArea, documents: response.resources.length, requestCharge: response.requestCharge ?? 0 };
    return current;
  }

  return {
    async get() {
      const now = clock();
      if (!current || now - current.loadedAt > ttlMs) {
        loading = loading ?? load().finally(() => (loading = null));
        return { snapshot: await loading, ageMs: 0, reloaded: true };
      }
      return { snapshot: current, ageMs: now - current.loadedAt, reloaded: false };
    },
  };
}

/** Builds the public view of one stand. */
function standView({ stand, catalog, devices, now }) {
  const deviceIds = catalog.devicesByStand.get(stand.standId) ?? [];
  const result = computeStand({
    slots: stand.slots,
    deviceIds,
    devices,
    now,
    staleAfterSeconds: catalog.settings.staleAfterSeconds,
  });
  const times = deviceIds.map((id) => devices[id]?.at).filter(Boolean).sort();
  const stale = deviceIds.length === 0 || result.missing.length > 0 || result.stale.length > 0;

  return {
    result,
    stale,
    view: {
      id: stand.standId,
      name: stand.name ?? stand.standId,
      areaId: stand.areaId,
      areaName: catalog.areas.get(stand.areaId)?.name ?? stand.areaId,
      currentOccupancy: result.occupied,
      maxOccupancy: result.slots,
      free: result.free,
      stale,
      updatedAt: times.length ? times[times.length - 1] : null,
    },
  };
}

/**
 * @param {object} deps
 * @param {{ get: () => Promise<{catalog: any, ageMs: number, reloaded: boolean}> }} deps.catalogCache
 * @param {{ get: () => Promise<{snapshot: any, ageMs: number, reloaded: boolean}> }} deps.stateCache
 * @param {() => Date} [deps.now]
 * @param {boolean} [deps.verbose]
 */
function createStandsHandler({ catalogCache, stateCache, now = () => new Date(), verbose = true }) {
  return async function handleStands(request, context) {
    const started = Date.now();
    const log = createLogger(context, "stands", verbose);
    const url = new URL(request.url);
    const standId = request.params?.standId || null;
    const areaId = url.searchParams.get("area");
    let ru = 0;

    // Public data: any web page may read it, and browsers may cache it briefly.
    const publicHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE_SECONDS}`,
    };
    const finish = (response, summary) => {
      const line = `<- ${response.status} in ${Date.now() - started} ms, ${round(ru)} RU${summary ? ` | ${summary}` : ""}`;
      if (response.status >= 500) log.error(line);
      else if (response.status >= 400) log.warn(line);
      else log.info(line);
      return response;
    };

    log.step(`-> GET ${url.pathname}${url.search} from ${clientIp(request)}`);

    let catalogLookup;
    let stateLookup;
    try {
      [catalogLookup, stateLookup] = await Promise.all([catalogCache.get(), stateCache.get()]);
    } catch (err) {
      log.error("couldn't read from Cosmos DB", err);
      return finish(reply(503, { error: "data unavailable, try again" }, { "Retry-After": "10", "Access-Control-Allow-Origin": "*" }));
    }
    const { catalog } = catalogLookup;
    const { snapshot } = stateLookup;

    if (catalogLookup.reloaded) {
      ru += catalog.requestCharge;
      log.step(`catalog loaded: ${catalog.stands.size} stands, ${catalog.devices.length} devices (${round(catalog.requestCharge)} RU)`);
    } else {
      log.step(`catalog from cache (${Math.round(catalogLookup.ageMs / 1000)} s old)`);
    }
    if (stateLookup.reloaded) {
      ru += snapshot.requestCharge;
      log.step(`state loaded: ${snapshot.documents} area documents (${round(snapshot.requestCharge)} RU)`);
    } else {
      log.step(`state from cache (${(stateLookup.ageMs / 1000).toFixed(1)} s old)`);
    }

    let stands = [...catalog.stands.values()].filter((s) => !s.retiredAt);
    if (standId) {
      stands = stands.filter((s) => s.standId === standId);
      if (!stands.length) {
        return finish(reply(404, { error: `unknown stand "${standId}"` }, { "Access-Control-Allow-Origin": "*" }), `unknown stand ${standId}`);
      }
    }
    if (areaId) {
      if (!catalog.areas.has(areaId)) {
        return finish(reply(404, { error: `unknown area "${areaId}"` }, { "Access-Control-Allow-Origin": "*" }), `unknown area ${areaId}`);
      }
      stands = stands.filter((s) => s.areaId === areaId);
    }
    stands.sort((a, b) => a.areaId.localeCompare(b.areaId) || a.standId.localeCompare(b.standId));

    const at = now();
    const views = stands.map((stand) => {
      const { result, stale, view } = standView({ stand, catalog, devices: snapshot.byArea.get(stand.areaId) ?? {}, now: at });
      const reasons = [
        ...(view.stale && !result.parts.length ? ["no devices assigned"] : []),
        ...result.missing.map((d) => `${d} never reported`),
        ...result.stale.map((d) => `${d} quiet for more than ${catalog.settings.staleAfterSeconds} s`),
      ];
      log.step(
        `${stand.standId}: ${describeParts(result.parts) || "no devices"} = ${result.occupied} of ${result.slots} slots, ${result.free} free` +
          (stale ? ` (stale: ${reasons.join(", ")})` : "")
      );
      return view;
    });

    if (standId) {
      const v = views[0];
      return finish(reply(200, v, publicHeaders), `${v.id}: ${v.currentOccupancy}/${v.maxOccupancy}, ${v.free} free${v.stale ? ", stale" : ""}`);
    }
    const staleCount = views.filter((v) => v.stale).length;
    return finish(
      reply(200, { at: at.toISOString(), stands: views }, publicHeaders),
      `${views.length} stands${areaId ? ` in ${areaId}` : ""}, ${staleCount} stale`
    );
  };
}

module.exports = { createStateCache, createStandsHandler, standView };
