"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hashKey, createCatalogCache } = require("../src/lib/catalog");
const { createDeviceConfigHandler } = require("../src/lib/device-config");

const KEYS = { thor: "vs_thor", probe: "vs_probe", oldie: "vs_oldie" };

function fakeContainer(initial = []) {
  const docs = new Map(initial.map((d) => [d.id, structuredClone(d)]));
  return {
    items: {
      query: () => ({
        fetchAll: async () => ({
          resources: [...docs.values()].map((d) => structuredClone(d)),
          requestCharge: 1.1,
        }),
      }),
    },
  };
}

function catalogDocs() {
  return [
    {
      id: "site:reinach",
      type: "site",
      siteId: "reinach",
      settings: { staleAfterSeconds: 300, reportIntervalSeconds: 45 },
    },
    { id: "area:kaegen-hof", type: "area", siteId: "reinach", areaId: "kaegen-hof", kind: "open" },
    { id: "stand:kaegen-hof-1", type: "stand", siteId: "reinach", standId: "kaegen-hof-1", areaId: "kaegen-hof", slots: 40 },
    {
      id: "device:thor",
      type: "device",
      siteId: "reinach",
      deviceId: "thor",
      hardware: "rplidar-c1",
      mode: "device",
      status: "active",
      keyHash: hashKey(KEYS.thor),
      config: { slots: 8, occupiedMm: 650, freeMm: 850 },
    },
    {
      id: "device:probe",
      type: "device",
      siteId: "reinach",
      deviceId: "probe",
      hardware: "vl53l5cx-array",
      mode: "device",
      status: "active",
      keyHash: hashKey(KEYS.probe),
      // no config block: handler must still return {}
    },
    {
      id: "device:oldie",
      type: "device",
      siteId: "reinach",
      deviceId: "oldie",
      hardware: "rplidar-c1",
      mode: "device",
      status: "retired",
      keyHash: hashKey(KEYS.oldie),
    },
    { id: "assignment:thor", type: "assignment", siteId: "reinach", deviceId: "thor", standId: "kaegen-hof-1", areaId: "kaegen-hof", validFrom: "2026-10-31T00:00:00.000Z", validTo: null },
    { id: "assignment:probe", type: "assignment", siteId: "reinach", deviceId: "probe", standId: "kaegen-hof-1", areaId: "kaegen-hof", validFrom: "2026-10-31T00:00:00.000Z", validTo: null },
  ];
}

function setup() {
  const catalog = fakeContainer(catalogDocs());
  return {
    context: { log: () => {}, warn: () => {}, error: () => {} },
    catalogCache: createCatalogCache({ container: () => catalog }),
  };
}

function fakeRequest(headers = {}) {
  const map = new Map(Object.entries(headers));
  return {
    method: "GET",
    url: "https://localhost/api/v1/device/config",
    headers: { get: (name) => map.get(name.toLowerCase()) ?? null },
  };
}

test("GET /v1/device/config returns the device's config, stand and slots", async () => {
  const t = setup();
  const handler = createDeviceConfigHandler({ catalogCache: t.catalogCache });
  const res = await handler(fakeRequest({ "x-api-key": KEYS.thor }), t.context);
  assert.equal(res.status, 200);
  assert.equal(res.jsonBody.device, "thor");
  assert.equal(res.jsonBody.stand, "kaegen-hof-1");
  assert.equal(res.jsonBody.slots, 40);
  assert.equal(res.jsonBody.reportIntervalSeconds, undefined, "report interval lives inside config, not at the top");
  assert.deepEqual(res.jsonBody.config, { slots: 8, occupiedMm: 650, freeMm: 850 });
});

test("a device without a config block gets {}", async () => {
  const t = setup();
  const handler = createDeviceConfigHandler({ catalogCache: t.catalogCache });
  const res = await handler(fakeRequest({ "x-api-key": KEYS.probe }), t.context);
  assert.equal(res.status, 200);
  assert.equal(res.jsonBody.device, "probe");
  assert.deepEqual(res.jsonBody.config, {});
});

test("missing X-Api-Key gets 401", async () => {
  const t = setup();
  const handler = createDeviceConfigHandler({ catalogCache: t.catalogCache });
  const res = await handler(fakeRequest(), t.context);
  assert.equal(res.status, 401);
});

test("unknown key gets 401", async () => {
  const t = setup();
  const handler = createDeviceConfigHandler({ catalogCache: t.catalogCache });
  const res = await handler(fakeRequest({ "x-api-key": "vs_unknown" }), t.context);
  assert.equal(res.status, 401);
});

test("retired devices get 401", async () => {
  const t = setup();
  const handler = createDeviceConfigHandler({ catalogCache: t.catalogCache });
  const res = await handler(fakeRequest({ "x-api-key": KEYS.oldie }), t.context);
  assert.equal(res.status, 401);
});
