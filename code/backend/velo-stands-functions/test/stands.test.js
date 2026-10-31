"use strict";

// GET /api/v1/stands against in-memory fakes of the catalog and state containers.
//   npm test

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createCatalogCache } = require("../src/lib/catalog");
const { createStateCache, createStandsHandler } = require("../src/lib/stands");

const T0 = Date.parse("2026-11-02T07:00:00.000Z");
const ago = (s) => new Date(T0 - s * 1000).toISOString();

function catalogDocs() {
  const device = (deviceId, status = "active") => ({ id: `device:${deviceId}`, type: "device", deviceId, name: deviceId, mode: "device", status, keyHash: `sha256:${deviceId}` });
  const assignment = (deviceId, standId) => ({ id: `assignment:${deviceId}`, type: "assignment", deviceId, standId, validFrom: "2026-10-31T00:00:00.000Z", validTo: null });
  return [
    { id: "site:reinach", type: "site", siteId: "reinach", settings: { staleAfterSeconds: 300 } },
    { id: "area:kaegen-hof", type: "area", areaId: "kaegen-hof", name: "Kägenstrasse 2 – Hof" },
    { id: "area:cmr-ost", type: "area", areaId: "cmr-ost", name: "Christoph Merian-Ring – Ost" },
    { id: "stand:kaegen-hof-1", type: "stand", standId: "kaegen-hof-1", areaId: "kaegen-hof", name: "Kägenstrasse 2 – Hof, Stand 1", slots: 40 },
    { id: "stand:cmr-ost-1", type: "stand", standId: "cmr-ost-1", areaId: "cmr-ost", name: "Christoph Merian-Ring – Ost, Stand 1", slots: 20 },
    { id: "stand:old-1", type: "stand", standId: "old-1", areaId: "cmr-ost", name: "Old stand", slots: 5, retiredAt: "2026-10-01T00:00:00.000Z" },
    device("thor"), device("probe"), device("ling"), device("oldie", "retired"),
    assignment("thor", "kaegen-hof-1"), assignment("probe", "kaegen-hof-1"), assignment("ling", "cmr-ost-1"), assignment("oldie", "kaegen-hof-1"),
  ];
}

function setup({ states, failState = false } = {}) {
  let clock = T0;
  let stateQueries = 0;
  const catalog = { items: { query: () => ({ fetchAll: async () => ({ resources: structuredClone(catalogDocs()), requestCharge: 3.04 }) }) } };
  const state = {
    items: {
      query: () => ({
        fetchAll: async () => {
          stateQueries++;
          if (failState) throw new Error("Cosmos DB unavailable");
          return { resources: structuredClone(states), requestCharge: 2.86 };
        },
      }),
    },
  };
  const lines = [];
  const context = { invocationId: "5e1a77c0-0000", log: (m) => lines.push(m), warn: (m) => lines.push(`WARN ${m}`), error: (m) => lines.push(`ERROR ${m}`) };
  const handler = createStandsHandler({
    catalogCache: createCatalogCache({ container: () => catalog, clock: () => clock }),
    stateCache: createStateCache({ container: () => state, clock: () => clock }),
    now: () => new Date(clock),
  });
  const get = (path, standId) =>
    handler({ method: "GET", url: `https://func-test.azurewebsites.net/api${path}`, params: standId ? { standId } : {}, headers: new Map([["x-forwarded-for", "198.51.100.23:40112"]]) }, context);
  return { get, lines, advance: (s) => (clock += s * 1000), stateQueries: () => stateQueries };
}

const freshStates = () => [
  {
    id: "kaegen-hof", areaId: "kaegen-hof",
    devices: {
      thor: { standId: "kaegen-hof-1", occupied: 9, seq: 5, at: ago(30) },
      probe: { standId: "kaegen-hof-1", occupied: 12, seq: 7, at: ago(50) },
      oldie: { standId: "kaegen-hof-1", occupied: 30, seq: 1, at: ago(10) }, // retired: must not count
    },
  },
  { id: "cmr-ost", areaId: "cmr-ost", devices: {} },
];

test("lists every active stand with name, current and max occupancy", async () => {
  const t = setup({ states: freshStates() });
  const res = await t.get("/v1/stands");
  assert.equal(res.status, 200);
  assert.deepEqual(res.jsonBody.stands.map((s) => s.id), ["cmr-ost-1", "kaegen-hof-1"]);
  const kh = res.jsonBody.stands.find((s) => s.id === "kaegen-hof-1");
  assert.deepEqual(kh, {
    id: "kaegen-hof-1", name: "Kägenstrasse 2 – Hof, Stand 1", areaId: "kaegen-hof", areaName: "Kägenstrasse 2 – Hof",
    currentOccupancy: 21, maxOccupancy: 40, free: 19, stale: false, updatedAt: ago(30),
  });
  const cmr = res.jsonBody.stands.find((s) => s.id === "cmr-ost-1");
  assert.equal(cmr.currentOccupancy, 0);
  assert.equal(cmr.stale, true); // ling never reported
  assert.equal(cmr.updatedAt, null);
  console.log(t.lines.join("\n"));
});

test("one stand by id, and 404 for an unknown one", async () => {
  const t = setup({ states: freshStates() });
  const one = await t.get("/v1/stands/kaegen-hof-1", "kaegen-hof-1");
  assert.equal(one.status, 200);
  assert.equal(one.jsonBody.name, "Kägenstrasse 2 – Hof, Stand 1");
  assert.equal(one.jsonBody.currentOccupancy, 21);
  assert.equal(one.jsonBody.maxOccupancy, 40);
  assert.equal((await t.get("/v1/stands/nope", "nope")).status, 404);
  assert.equal((await t.get("/v1/stands/old-1", "old-1")).status, 404); // retired
});

test("filter by area", async () => {
  const t = setup({ states: freshStates() });
  const res = await t.get("/v1/stands?area=kaegen-hof");
  assert.deepEqual(res.jsonBody.stands.map((s) => s.id), ["kaegen-hof-1"]);
  assert.equal((await t.get("/v1/stands?area=atlantis")).status, 404);
});

test("a device that went quiet makes the stand stale", async () => {
  const states = freshStates();
  states[0].devices.probe.at = ago(600);
  const t = setup({ states });
  const kh = (await t.get("/v1/stands/kaegen-hof-1", "kaegen-hof-1")).jsonBody;
  assert.equal(kh.stale, true);
  assert.equal(kh.currentOccupancy, 21); // its last count still counts
  assert.ok(t.lines.some((l) => l.includes("probe quiet for more than 300 s")));
});

test("more bikes than slots: free stays at 0", async () => {
  const states = freshStates();
  states[0].devices.thor.occupied = 30;
  const t = setup({ states });
  const kh = (await t.get("/v1/stands/kaegen-hof-1", "kaegen-hof-1")).jsonBody;
  assert.equal(kh.currentOccupancy, 42);
  assert.equal(kh.free, 0);
});

test("state is read from Cosmos DB at most every 5 s", async () => {
  const t = setup({ states: freshStates() });
  await t.get("/v1/stands");
  t.advance(2);
  await t.get("/v1/stands");
  assert.equal(t.stateQueries(), 1);
  t.advance(4);
  await t.get("/v1/stands");
  assert.equal(t.stateQueries(), 2);
});

test("public headers, and 503 when Cosmos DB is down", async () => {
  const ok = await setup({ states: freshStates() }).get("/v1/stands");
  assert.equal(ok.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(ok.headers["Cache-Control"], "public, max-age=5");
  const down = await setup({ states: [], failState: true }).get("/v1/stands");
  assert.equal(down.status, 503);
});
