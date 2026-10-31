"use strict";

// Runs without Azure: Cosmos DB is replaced by a small in-memory fake.
//   npm test   (node --test test/*.test.js)

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hashKey, createCatalogCache } = require("../src/lib/catalog");
const { createReadingsHandler } = require("../src/lib/ingest");

// --- fakes -------------------------------------------------------------------

function fakeContainer(initial = []) {
  const docs = new Map(initial.map((d) => [d.id, structuredClone(d)]));
  const etags = new Map(initial.map((d) => [d.id, "e0"]));
  let n = 0;
  const container = {
    docs,
    interfere: null, // optional hook: runs between read and replace
    items: {
      query: () => ({ fetchAll: async () => ({ resources: [...docs.values()].map((d) => structuredClone(d)), requestCharge: 3.1 }) }),
      create: async (doc) => {
        if (docs.has(doc.id)) throw Object.assign(new Error("conflict"), { code: 409 });
        docs.set(doc.id, structuredClone(doc));
        etags.set(doc.id, `e${++n}`);
        return { resource: structuredClone(doc), etag: etags.get(doc.id), requestCharge: 6.2 };
      },
    },
    item: (id) => ({
      read: async () => {
        const result = { resource: docs.has(id) ? structuredClone(docs.get(id)) : undefined, etag: etags.get(id), requestCharge: 1 };
        if (container.interfere) {
          const hook = container.interfere;
          container.interfere = null;
          hook();
        }
        return result;
      },
      replace: async (doc, options) => {
        if (options?.accessCondition?.condition !== etags.get(id)) throw Object.assign(new Error("precondition failed"), { code: 412 });
        docs.set(id, structuredClone(doc));
        etags.set(id, `e${++n}`);
        return { resource: doc, etag: etags.get(id), requestCharge: 10.4 };
      },
    }),
    bump: (id) => etags.set(id, `e${++n}`),
  };
  return container;
}

const KEYS = { thor: "vs_thor", probe: "vs_probe", lonely: "vs_lonely", oldie: "vs_oldie", fixme: "vs_fixme" };

function catalogDocs() {
  const device = (deviceId, status = "active") => ({
    id: `device:${deviceId}`, type: "device", siteId: "reinach", deviceId, name: `${deviceId} test`,
    hardware: "vl53l5cx-array", mode: "device", status, keyHash: hashKey(KEYS[deviceId]),
  });
  const assignment = (deviceId, standId, validTo = null) => ({
    id: `assignment:${deviceId}`, type: "assignment", siteId: "reinach", deviceId, standId, areaId: "kaegen-hof",
    validFrom: "2026-10-31T00:00:00.000Z", validTo,
  });
  return [
    { id: "site:reinach", type: "site", siteId: "reinach", settings: { staleAfterSeconds: 300 } },
    { id: "area:kaegen-hof", type: "area", siteId: "reinach", areaId: "kaegen-hof", name: "Kägenstrasse 2 – Hof", kind: "open" },
    { id: "stand:kaegen-hof-1", type: "stand", siteId: "reinach", standId: "kaegen-hof-1", areaId: "kaegen-hof", name: "Kägenstrasse 2 – Hof, Stand 1", slots: 40 },
    { id: "stand:kaegen-hof-2", type: "stand", siteId: "reinach", standId: "kaegen-hof-2", areaId: "kaegen-hof", name: "Kägenstrasse 2 – Hof, Stand 2", slots: 10 },
    device("thor"), device("probe"), device("lonely"), device("oldie", "retired"), device("fixme", "maintenance"),
    assignment("thor", "kaegen-hof-1"), assignment("probe", "kaegen-hof-1"),
    assignment("oldie", "kaegen-hof-1", "2026-11-01T00:00:00.000Z"), assignment("fixme", "kaegen-hof-2"),
  ];
}

function setup() {
  let clock = new Date("2026-11-02T07:00:00.000Z");
  const catalog = fakeContainer(catalogDocs());
  const state = fakeContainer([{ id: "kaegen-hof", areaId: "kaegen-hof", devices: {}, updatedAt: "2026-10-31T00:00:00.000Z" }]);
  const readings = fakeContainer();
  const lines = [];
  const context = {
    invocationId: "1a2b3c4d-0000",
    log: (m) => lines.push(m),
    warn: (m) => lines.push(`WARN ${m}`),
    error: (m) => lines.push(`ERROR ${m}`),
  };
  const handler = createReadingsHandler({
    catalogCache: createCatalogCache({ container: () => catalog, clock: () => clock.getTime() }),
    containers: () => ({ state, readings }),
    now: () => clock,
  });
  const send = (key, body) =>
    handler(
      {
        method: "POST",
        url: "https://func-test.azurewebsites.net/api/v1/readings",
        headers: new Map(Object.entries({ "x-api-key": key, "x-forwarded-for": "203.0.113.7:51234" }).filter(([, v]) => v !== undefined)),
        text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
      },
      context
    );
  return { send, state, readings, catalog, lines, advance: (s) => (clock = new Date(clock.getTime() + s * 1000)) };
}

// --- tests -------------------------------------------------------------------

test("a reading updates the device, the stand and the history", async () => {
  const t = setup();
  const res = await t.send(KEYS.thor, { occupied: 9, seq: 1, fw: "0.3.1", rssi: -61 });
  assert.equal(res.status, 202);
  assert.deepEqual(res.jsonBody, { device: "thor", stand: "kaegen-hof-1", occupied: 9, standOccupied: 9, slots: 40, free: 31, nextInSeconds: 60 });

  const area = t.state.docs.get("kaegen-hof");
  assert.equal(area.devices.thor.occupied, 9);
  assert.equal(area.stands["kaegen-hof-1"].free, 31);
  assert.deepEqual(area.stands["kaegen-hof-1"].missingDevices, ["probe"]);

  const [history] = [...t.readings.docs.values()];
  assert.equal(history.standFree, 31);
  assert.equal(history.deviceId, "thor");
  assert.equal(history.fw, "0.3.1");
  console.log(t.lines.join("\n"));
});

test("two devices on one stand are added up", async () => {
  const t = setup();
  await t.send(KEYS.thor, { occupied: 9, seq: 1 });
  t.advance(20);
  const res = await t.send(KEYS.probe, { occupied: 12, seq: 1 });
  assert.equal(res.jsonBody.standOccupied, 21);
  assert.equal(res.jsonBody.free, 19);
  assert.equal(t.state.docs.get("kaegen-hof").stands["kaegen-hof-1"].missingDevices.length, 0);
});

test("free slots never go below zero", async () => {
  const t = setup();
  await t.send(KEYS.thor, { occupied: 30, seq: 1 });
  const res = await t.send(KEYS.probe, { occupied: 15, seq: 1 });
  assert.equal(res.jsonBody.standOccupied, 45);
  assert.equal(res.jsonBody.free, 0);
});

test("missing, unknown, retired and maintenance keys are refused", async () => {
  const t = setup();
  assert.equal((await t.send(undefined, { occupied: 1, seq: 1 })).status, 401);
  assert.equal((await t.send("vs_wrong", { occupied: 1, seq: 1 })).status, 401);
  assert.equal((await t.send(KEYS.oldie, { occupied: 1, seq: 1 })).status, 401);
  assert.equal((await t.send(KEYS.fixme, { occupied: 1, seq: 1 })).status, 403);
  assert.equal(t.readings.docs.size, 0);
});

test("an unassigned device gets 409", async () => {
  const t = setup();
  assert.equal((await t.send(KEYS.lonely, { occupied: 1, seq: 1 })).status, 409);
});

test("bad bodies are refused", async () => {
  const t = setup();
  assert.equal((await t.send(KEYS.thor, "{not json")).status, 400);
  const tooMany = await t.send(KEYS.thor, { occupied: 41, seq: 1 });
  assert.equal(tooMany.status, 422);
  assert.match(tooMany.jsonBody.details[0], /more than the stand's 40 slots/);
  assert.equal((await t.send(KEYS.thor, { occupied: 3, seq: 1, image: "..." })).status, 422);
  assert.equal((await t.send(KEYS.thor, { occupied: -1, seq: 1 })).status, 422);
  assert.equal((await t.send(KEYS.thor, { occupied: 3 })).status, 422);
});

test("duplicates are ignored, repeats within 2 s are throttled, a restart is accepted", async () => {
  const t = setup();
  await t.send(KEYS.thor, { occupied: 9, seq: 10 });
  t.advance(30);
  const dup = await t.send(KEYS.thor, { occupied: 9, seq: 10 });
  assert.equal(dup.status, 200);
  assert.equal(dup.jsonBody.duplicate, true);

  t.advance(1);
  await t.send(KEYS.thor, { occupied: 8, seq: 11 });
  t.advance(1); // within the 2 s rate limit
  const fast = await t.send(KEYS.thor, { occupied: 7, seq: 12 });
  assert.equal(fast.status, 429);
  t.advance(2); // 3 s after the last accepted reading: allowed again
  assert.equal((await t.send(KEYS.thor, { occupied: 7, seq: 12 })).status, 202);

  t.advance(600); // device was off for 10 minutes and restarted with seq 0
  const restart = await t.send(KEYS.thor, { occupied: 4, seq: 0 });
  assert.equal(restart.status, 202);
  assert.equal(t.state.docs.get("kaegen-hof").devices.thor.seq, 0);
  assert.equal(t.readings.docs.size, 4);
});

test("a quick reboot is detected by the seq going backwards, not frozen for 5 minutes", async () => {
  const t = setup();
  await t.send(KEYS.thor, { occupied: 9, seq: 25 });
  t.advance(3);
  // Device power-cycles and comes back immediately with a fresh counter. The
  // stand must reflect the new reading right away — not wait for the stale
  // window — because the pre-reboot occupied is no longer accurate.
  const rebooted = await t.send(KEYS.thor, { occupied: 0, seq: 1 });
  assert.equal(rebooted.status, 202);
  assert.equal(t.state.docs.get("kaegen-hof").devices.thor.seq, 1);
  assert.equal(t.state.docs.get("kaegen-hof").devices.thor.occupied, 0);
});

test("a parallel write to the same area is retried, not lost", async () => {
  const t = setup();
  await t.send(KEYS.probe, { occupied: 5, seq: 1 });
  t.state.interfere = () => t.state.bump("kaegen-hof"); // someone else writes between read and replace
  t.advance(10);
  const res = await t.send(KEYS.thor, { occupied: 9, seq: 1 });
  assert.equal(res.status, 202);
  assert.equal(res.jsonBody.standOccupied, 14);
  assert.ok(t.lines.some((l) => l.includes("retrying (attempt 2)")));
});

test("the state document is created if the area has none yet", async () => {
  const t = setup();
  t.state.docs.clear();
  const res = await t.send(KEYS.thor, { occupied: 2, seq: 1 });
  assert.equal(res.status, 202);
  assert.equal(t.state.docs.get("kaegen-hof").devices.thor.occupied, 2);
});

test("the API key never appears in the log", async () => {
  const t = setup();
  await t.send(KEYS.thor, { occupied: 1, seq: 1 });
  await t.send("vs_secret_wrong_key", { occupied: 1, seq: 1 });
  assert.ok(!t.lines.join("\n").includes("vs_"));
});
