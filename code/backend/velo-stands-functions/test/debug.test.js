"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hashKey, createCatalogCache } = require("../src/lib/catalog");
const {
  toPublicConfig,
  createConfigHandler,
  createDebugDevicesHandler,
  createDebugLogsHandler,
} = require("../src/lib/debug");
const { createDeviceLog } = require("../src/lib/device-log");

// --- shared fakes ------------------------------------------------------------

function fakeContainer(initial = []) {
  const docs = new Map(initial.map((d) => [d.id, structuredClone(d)]));
  return {
    docs,
    items: {
      query: () => ({
        fetchAll: async () => ({
          resources: [...docs.values()].map((d) => structuredClone(d)),
          requestCharge: 1.2,
        }),
      }),
    },
  };
}

const KEYS = { thor: "vs_thor", drone: "vs_drone", oldie: "vs_oldie" };

function catalogDocs() {
  const device = (deviceId, status = "active", hardware = "vl53l5cx-array") => ({
    id: `device:${deviceId}`,
    type: "device",
    siteId: "reinach",
    deviceId,
    name: `${deviceId} test`,
    hardware,
    mode: "device",
    status,
    keyHash: hashKey(KEYS[deviceId] ?? deviceId),
  });
  const assignment = (deviceId, standId, validTo = null) => ({
    id: `assignment:${deviceId}`,
    type: "assignment",
    siteId: "reinach",
    deviceId,
    standId,
    areaId: "kaegen-hof",
    validFrom: "2026-10-31T00:00:00.000Z",
    validTo,
  });
  return [
    {
      id: "site:reinach",
      type: "site",
      siteId: "reinach",
      name: "Endress+Hauser Reinach",
      timezone: "Europe/Zurich",
      settings: { staleAfterSeconds: 60, reportIntervalSeconds: 30 },
    },
    { id: "area:kaegen-hof", type: "area", siteId: "reinach", areaId: "kaegen-hof", name: "Kägenstrasse 2 – Hof", kind: "open" },
    { id: "stand:kaegen-hof-1", type: "stand", siteId: "reinach", standId: "kaegen-hof-1", areaId: "kaegen-hof", name: "Kägenstrasse 2 – Hof, Stand 1", slots: 40 },
    { id: "stand:gone", type: "stand", siteId: "reinach", standId: "gone", areaId: "kaegen-hof", name: "retired", slots: 10, retiredAt: "2026-01-01T00:00:00.000Z" },
    device("thor"),
    device("drone", "active", "esp32-cam"),
    device("oldie", "retired"),
    assignment("thor", "kaegen-hof-1"),
    assignment("drone", "kaegen-hof-1"),
  ];
}

function setup({ now = new Date("2026-11-02T07:00:00.000Z"), stateDocs } = {}) {
  const catalog = fakeContainer(catalogDocs());
  const state = fakeContainer(
    stateDocs ?? [
      {
        id: "kaegen-hof",
        areaId: "kaegen-hof",
        devices: {
          thor: { standId: "kaegen-hof-1", occupied: 9, source: "device", seq: 1, at: new Date(now.getTime() - 10_000).toISOString() },
          drone: { standId: "kaegen-hof-1", occupied: 2, source: "device", seq: 3, at: new Date(now.getTime() - 10 * 60_000).toISOString() },
        },
        updatedAt: now.toISOString(),
      },
    ],
  );
  const context = {
    log: () => {},
    warn: () => {},
    error: () => {},
  };
  return {
    catalog,
    state,
    context,
    catalogCache: createCatalogCache({ container: () => catalog, clock: () => now.getTime() }),
    containers: () => ({ state, readings: fakeContainer() }),
  };
}

function fakeRequest({ method = "GET", url = "https://localhost/api/v1/debug/devices", params = {} } = {}) {
  return { method, url, params, headers: new Map() };
}

// --- toPublicConfig ----------------------------------------------------------

test("toPublicConfig strips keyHash and retired devices/stands", async () => {
  const t = setup();
  const { catalog } = await t.catalogCache.get();
  const pub = toPublicConfig(catalog);
  assert.equal(pub.version, 1);
  assert.deepEqual(pub.site, { id: "reinach", name: "Endress+Hauser Reinach", timezone: "Europe/Zurich" });
  assert.deepEqual(pub.areas, [{ id: "kaegen-hof", name: "Kägenstrasse 2 – Hof", kind: "open" }]);
  assert.deepEqual(pub.stands, [{ id: "kaegen-hof-1", area: "kaegen-hof", name: "Kägenstrasse 2 – Hof, Stand 1", slots: 40 }]);
  const ids = pub.devices.map((d) => d.id).sort();
  assert.deepEqual(ids, ["drone", "thor"]);
  for (const d of pub.devices) {
    assert.ok(!("keyHash" in d), "keyHash must never leave the backend");
    assert.ok(!("status" in d), "status is internal, not public");
  }
});

// --- GET /v1/config ----------------------------------------------------------

test("GET /v1/config returns the public config", async () => {
  const t = setup();
  const res = await createConfigHandler({ catalogCache: t.catalogCache })(fakeRequest(), t.context);
  assert.equal(res.status, 200);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(res.jsonBody.site.id, "reinach");
  assert.equal(res.jsonBody.devices.length, 2);
});

// --- GET /v1/debug/devices ---------------------------------------------------

test("GET /v1/debug/devices adds lastSeenAt and stale from state", async () => {
  const now = new Date("2026-11-02T07:00:00.000Z");
  const t = setup({ now });
  const res = await createDebugDevicesHandler({
    catalogCache: t.catalogCache,
    containers: t.containers,
    now: () => now,
  })(fakeRequest(), t.context);
  assert.equal(res.status, 200);
  assert.equal(typeof res.jsonBody.at, "string");
  const byId = Object.fromEntries(res.jsonBody.devices.map((d) => [d.device.id, d]));
  assert.equal(byId.thor.lastImage, null, "there is no image endpoint yet");
  assert.equal(byId.thor.stale, false, "thor reported 10 s ago, below 60 s stale threshold");
  assert.equal(byId.drone.stale, true, "drone has been quiet for 10 min");
  assert.equal(byId.thor.device.hardware, "vl53l5cx-array");
});

test("devices with no state yet come back stale and without a lastSeenAt", async () => {
  const t = setup({ stateDocs: [{ id: "kaegen-hof", areaId: "kaegen-hof", devices: {}, updatedAt: new Date().toISOString() }] });
  const res = await createDebugDevicesHandler({ catalogCache: t.catalogCache, containers: t.containers })(
    fakeRequest(),
    t.context,
  );
  for (const d of res.jsonBody.devices) {
    assert.equal(d.lastSeenAt, null);
    assert.equal(d.stale, true);
  }
});

test("the state container being down does not sink the devices endpoint", async () => {
  const t = setup();
  const brokenContainers = () => ({
    state: {
      items: {
        query: () => ({
          fetchAll: async () => {
            throw new Error("cosmos is down");
          },
        }),
      },
    },
    readings: fakeContainer(),
  });
  const res = await createDebugDevicesHandler({ catalogCache: t.catalogCache, containers: brokenContainers })(
    fakeRequest(),
    t.context,
  );
  assert.equal(res.status, 200);
  for (const d of res.jsonBody.devices) {
    assert.equal(d.lastSeenAt, null);
    assert.equal(d.stale, true);
  }
});

// --- GET /v1/debug/devices/{id}/logs ---------------------------------------

test("GET /v1/debug/devices/{id}/logs returns the ring buffer, newest last", async () => {
  const t = setup();
  const deviceLog = createDeviceLog({ maxPerDevice: 5, clock: () => new Date("2026-11-02T07:00:00.000Z") });
  deviceLog.push("thor", { level: "info", message: "reading 1" });
  deviceLog.push("thor", { level: "warn", message: "slow network" });
  deviceLog.push("thor", { level: "info", message: "reading 2" });
  const handler = createDebugLogsHandler({ catalogCache: t.catalogCache, deviceLog });
  const res = await handler(
    fakeRequest({
      url: "https://localhost/api/v1/debug/devices/thor/logs?limit=2",
      params: { deviceId: "thor" },
    }),
    t.context,
  );
  assert.equal(res.status, 200);
  assert.equal(res.jsonBody.deviceId, "thor");
  assert.equal(res.jsonBody.entries.length, 2);
  assert.equal(res.jsonBody.entries[1].message, "reading 2");
  assert.equal(res.jsonBody.entries[0].message, "slow network");
});

test("unknown device ids return 404", async () => {
  const t = setup();
  const handler = createDebugLogsHandler({ catalogCache: t.catalogCache, deviceLog: createDeviceLog() });
  const res = await handler(
    fakeRequest({
      url: "https://localhost/api/v1/debug/devices/ghost/logs",
      params: { deviceId: "ghost" },
    }),
    t.context,
  );
  assert.equal(res.status, 404);
});

test("the device log caps per-device entries", () => {
  const log = createDeviceLog({ maxPerDevice: 3 });
  for (let i = 0; i < 10; i++) log.push("thor", { level: "info", message: `line ${i}` });
  const entries = log.entries("thor");
  assert.equal(entries.length, 3);
  assert.equal(entries[0].message, "line 7");
  assert.equal(entries[2].message, "line 9");
});
