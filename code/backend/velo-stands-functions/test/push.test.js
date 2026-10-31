"use strict";

// Live push over Web PubSub, against in-memory fakes of Cosmos DB and Web PubSub.
//   npm test

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createCatalogCache } = require("../src/lib/catalog");
const { createStateCache } = require("../src/lib/stands");
const { createNegotiateHandler, createBroadcastHandler, createEventsHandler } = require("../src/lib/push");

const T0 = Date.parse("2026-11-02T07:00:00.000Z");

const catalogDocs = [
  { id: "site:reinach", type: "site", siteId: "reinach", settings: { staleAfterSeconds: 300 } },
  { id: "area:kaegen-hof", type: "area", areaId: "kaegen-hof", name: "Kägenstrasse 2 – Hof" },
  { id: "stand:kaegen-hof-1", type: "stand", standId: "kaegen-hof-1", areaId: "kaegen-hof", name: "Kägenstrasse 2 – Hof, Stand 1", slots: 40 },
  { id: "device:thor", type: "device", deviceId: "thor", name: "thor", mode: "device", status: "active", keyHash: "sha256:thor" },
  { id: "assignment:thor", type: "assignment", deviceId: "thor", standId: "kaegen-hof-1", validFrom: "2026-10-31T00:00:00.000Z", validTo: null },
];
const states = [
  { id: "kaegen-hof", areaId: "kaegen-hof", devices: { thor: { standId: "kaegen-hof-1", occupied: 9, seq: 5, at: new Date(T0 - 30_000).toISOString() } } },
];

const fakeContainer = (docs, fail) => ({
  items: {
    query: () => ({
      fetchAll: async () => {
        if (fail) throw new Error("Cosmos DB unavailable");
        return { resources: structuredClone(docs), requestCharge: 3 };
      },
    }),
  },
});

function fakePubsub({ failToken = false } = {}) {
  const sent = [];
  return {
    sent,
    client: {
      getClientAccessToken: async (options) => {
        if (failToken) throw new Error("service down");
        return { url: `wss://wps.webpubsub.azure.com/client/hubs/occupancy?access_token=t&minutes=${options.expirationTimeInMinutes}` };
      },
      sendToAll: async (message) => sent.push({ to: "all", message }),
      sendToConnection: async (connectionId, message) => sent.push({ to: connectionId, message }),
    },
  };
}

function setup({ pubsub = fakePubsub(), failState = false } = {}) {
  const lines = [];
  const context = { invocationId: "abcdef12-0000", log: (m) => lines.push(m), warn: (m) => lines.push(`WARN ${m}`), error: (m) => lines.push(`ERROR ${m}`) };
  const deps = {
    pubsub: () => pubsub?.client ?? null,
    catalogCache: createCatalogCache({ container: () => fakeContainer(catalogDocs), clock: () => T0 }),
    stateCache: createStateCache({ container: () => fakeContainer(states, failState), clock: () => T0 }),
    now: () => new Date(T0),
  };
  return { deps, context, lines, sent: pubsub?.sent };
}

const expectedMessage = {
  type: "stands",
  at: "2026-11-02T07:00:00.000Z",
  stands: [
    {
      id: "kaegen-hof-1", name: "Kägenstrasse 2 – Hof, Stand 1", areaId: "kaegen-hof", areaName: "Kägenstrasse 2 – Hof",
      currentOccupancy: 9, maxOccupancy: 40, free: 31, stale: false, updatedAt: new Date(T0 - 30_000).toISOString(),
    },
  ],
};

test("negotiate returns a receive-only client URL", async () => {
  const t = setup();
  const res = await createNegotiateHandler(t.deps)({}, t.context);
  assert.equal(res.status, 200);
  assert.match(res.jsonBody.url, /^wss:\/\/wps\.webpubsub\.azure\.com\/client\/hubs\/occupancy\?/);
  assert.match(res.jsonBody.url, /minutes=60/);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
});

test("negotiate answers 503 when Web PubSub isn't configured or fails", async () => {
  const off = setup({ pubsub: null });
  assert.equal((await createNegotiateHandler(off.deps)({}, off.context)).status, 503);

  const down = setup({ pubsub: fakePubsub({ failToken: true }) });
  const res = await createNegotiateHandler(down.deps)({}, down.context);
  assert.equal(res.status, 503);
  assert.equal(res.headers["Retry-After"], "10");
  assert.ok(down.lines.some((l) => l.startsWith("ERROR [negotiate abcdef12]")));
});

test("broadcast sends every stand to all clients, same shape as GET /v1/stands", async () => {
  const t = setup();
  await createBroadcastHandler(t.deps)({}, t.context);
  assert.deepEqual(t.sent, [{ to: "all", message: expectedMessage }]);
});

test("broadcast does nothing without Web PubSub and logs Cosmos DB errors", async () => {
  const off = setup({ pubsub: null });
  await createBroadcastHandler(off.deps)({}, off.context);

  const t = setup({ failState: true });
  await createBroadcastHandler(t.deps)({}, t.context);
  assert.deepEqual(t.sent, []);
  assert.ok(t.lines.some((l) => l.includes("broadcast failed: Cosmos DB unavailable")));
});

const eventRequest = (method, headers) => ({ method, headers: new Map(Object.entries(headers)) });

test("events: accepts the abuse-protection handshake only from Web PubSub", async () => {
  const t = setup();
  const handle = createEventsHandler(t.deps);
  const ok = await handle(eventRequest("OPTIONS", { "webhook-request-origin": "wps-velo.webpubsub.azure.com" }), t.context);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers["WebHook-Allowed-Origin"], "wps-velo.webpubsub.azure.com");
  const bad = await handle(eventRequest("OPTIONS", { "webhook-request-origin": "evil.example.com" }), t.context);
  assert.equal(bad.status, 400);
});

test("events: a new connection gets the snapshot right away", async () => {
  const t = setup();
  const res = await createEventsHandler(t.deps)(
    eventRequest("POST", { "ce-type": "azure.webpubsub.sys.connected", "ce-connectionid": "conn-123" }),
    t.context
  );
  assert.equal(res.status, 204);
  assert.deepEqual(t.sent, [{ to: "conn-123", message: expectedMessage }]);
});

test("events: other events are acknowledged and ignored", async () => {
  const t = setup();
  const res = await createEventsHandler(t.deps)(
    eventRequest("POST", { "ce-type": "azure.webpubsub.sys.disconnected", "ce-connectionid": "conn-123" }),
    t.context
  );
  assert.equal(res.status, 204);
  assert.deepEqual(t.sent, []);
});
