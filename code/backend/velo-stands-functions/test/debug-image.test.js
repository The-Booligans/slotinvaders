"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hashKey, createCatalogCache } = require("../src/lib/catalog");
const {
  createDebugImageUploadHandler,
  createDebugImageFetchHandler,
} = require("../src/lib/debug-image");
const { createImageStore } = require("../src/lib/image-store");
const { createDeviceLog } = require("../src/lib/device-log");
const { createDebugDevicesHandler } = require("../src/lib/debug");

const KEY = "vs_hydra";

function fakeContainer(initial = []) {
  const docs = new Map(initial.map((d) => [d.id, structuredClone(d)]));
  return {
    docs,
    items: {
      query: () => ({
        fetchAll: async () => ({
          resources: [...docs.values()].map((d) => structuredClone(d)),
          requestCharge: 0.5,
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
      name: "Endress+Hauser Reinach",
      timezone: "Europe/Zurich",
      settings: { staleAfterSeconds: 60, reportIntervalSeconds: 30 },
    },
    { id: "area:a", type: "area", siteId: "reinach", areaId: "a", name: "A", kind: "open" },
    { id: "stand:s1", type: "stand", siteId: "reinach", standId: "s1", areaId: "a", name: "s1", slots: 10 },
    {
      id: "device:hydra",
      type: "device",
      siteId: "reinach",
      deviceId: "hydra",
      name: "hydra",
      hardware: "atoms3r-cam-m12",
      mode: "device",
      status: "active",
      keyHash: hashKey(KEY),
    },
    {
      id: "assignment:hydra",
      type: "assignment",
      siteId: "reinach",
      deviceId: "hydra",
      standId: "s1",
      areaId: "a",
      validFrom: "2026-10-31T00:00:00.000Z",
      validTo: null,
    },
  ];
}

function setup() {
  const catalog = fakeContainer(catalogDocs());
  const catalogCache = createCatalogCache({
    container: () => catalog,
    clock: () => new Date("2026-11-02T07:00:00.000Z").getTime(),
  });
  const context = { log: () => {}, warn: () => {}, error: () => {} };
  const imageStore = createImageStore({ clock: () => new Date("2026-11-02T07:00:00.000Z") });
  const deviceLog = createDeviceLog();
  return { catalogCache, context, imageStore, deviceLog };
}

function fakeRequest({
  method = "POST",
  url = "https://api.example.test/api/v1/debug/images",
  headers = {},
  params = {},
  body = Buffer.from([]),
} = {}) {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method,
    url,
    params,
    headers: { get: (name) => lower.get(String(name).toLowerCase()) ?? null },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    body,
  };
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
);

// --- POST /api/v1/debug/images ---------------------------------------------

test("POST /debug/images stores the latest JPEG per device", async () => {
  const t = setup();
  const handler = createDebugImageUploadHandler({ ...t });
  const res = await handler(
    fakeRequest({
      headers: { "x-api-key": KEY, "content-type": "image/jpeg", "x-seq": "7" },
      body: JPEG,
    }),
    t.context,
  );
  assert.equal(res.status, 202);
  assert.equal(res.jsonBody.device, "hydra");
  assert.equal(res.jsonBody.seq, 7);
  assert.equal(res.jsonBody.bytes, JPEG.length);
  const stored = t.imageStore.get("hydra");
  assert.ok(stored, "image is stored");
  assert.equal(stored.seq, 7);
  assert.deepEqual(stored.buffer, JPEG);
});

test("POST /debug/images rejects missing X-Api-Key", async () => {
  const t = setup();
  const handler = createDebugImageUploadHandler({ ...t });
  const res = await handler(
    fakeRequest({ headers: { "content-type": "image/jpeg" }, body: JPEG }),
    t.context,
  );
  assert.equal(res.status, 401);
});

test("POST /debug/images rejects an unknown key", async () => {
  const t = setup();
  const handler = createDebugImageUploadHandler({ ...t });
  const res = await handler(
    fakeRequest({
      headers: { "x-api-key": "vs_nope", "content-type": "image/jpeg" },
      body: JPEG,
    }),
    t.context,
  );
  assert.equal(res.status, 401);
});

test("POST /debug/images rejects a non-JPEG content type", async () => {
  const t = setup();
  const handler = createDebugImageUploadHandler({ ...t });
  const res = await handler(
    fakeRequest({
      headers: { "x-api-key": KEY, "content-type": "image/png" },
      body: JPEG,
    }),
    t.context,
  );
  assert.equal(res.status, 415);
});

test("POST /debug/images accepts image/svg+xml for non-camera sensors", async () => {
  const t = setup();
  const handler = createDebugImageUploadHandler({ ...t });
  const res = await handler(
    fakeRequest({
      headers: { "x-api-key": KEY, "content-type": "image/svg+xml", "x-seq": "4" },
      body: SVG,
    }),
    t.context,
  );
  assert.equal(res.status, 202);
  const stored = t.imageStore.get("hydra");
  assert.ok(stored, "svg frame is stored");
  assert.equal(stored.seq, 4);
  assert.equal(stored.mimeType, "image/svg+xml");
});

test("GET /debug/devices/{id}/image serves SVG with the right Content-Type", async () => {
  const t = setup();
  t.imageStore.put("hydra", { buffer: SVG, mimeType: "image/svg+xml", seq: 5 });
  const handler = createDebugImageFetchHandler({ imageStore: t.imageStore });
  const res = await handler(
    fakeRequest({ method: "GET", url: "https://api/x", params: { deviceId: "hydra" } }),
    t.context,
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers["Content-Type"], "image/svg+xml");
  assert.deepEqual(res.body, SVG);
});

test("POST /debug/images rejects an empty body", async () => {
  const t = setup();
  const handler = createDebugImageUploadHandler({ ...t });
  const res = await handler(
    fakeRequest({
      headers: { "x-api-key": KEY, "content-type": "image/jpeg" },
      body: Buffer.alloc(0),
    }),
    t.context,
  );
  assert.equal(res.status, 400);
});

test("POST /debug/images rejects a body above the limit", async () => {
  const t = setup();
  const smallStore = createImageStore({ maxBytes: 32 });
  const handler = createDebugImageUploadHandler({ ...t, imageStore: smallStore });
  const res = await handler(
    fakeRequest({
      headers: { "x-api-key": KEY, "content-type": "image/jpeg" },
      body: Buffer.alloc(64, 0xff),
    }),
    t.context,
  );
  assert.equal(res.status, 413);
});

test("POST /debug/images auto-increments seq when the header is absent", async () => {
  const t = setup();
  const handler = createDebugImageUploadHandler({ ...t });
  const first = await handler(
    fakeRequest({ headers: { "x-api-key": KEY, "content-type": "image/jpeg" }, body: JPEG }),
    t.context,
  );
  const second = await handler(
    fakeRequest({ headers: { "x-api-key": KEY, "content-type": "image/jpeg" }, body: JPEG }),
    t.context,
  );
  assert.equal(first.jsonBody.seq, 1);
  assert.equal(second.jsonBody.seq, 2);
});

// --- GET /api/v1/debug/devices/{id}/image ----------------------------------

test("GET /debug/devices/{id}/image returns the stored JPEG bytes", async () => {
  const t = setup();
  t.imageStore.put("hydra", { buffer: JPEG, seq: 3 });
  const handler = createDebugImageFetchHandler({ imageStore: t.imageStore });
  const res = await handler(
    fakeRequest({ method: "GET", url: "https://api/x", params: { deviceId: "hydra" } }),
    t.context,
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers["Content-Type"], "image/jpeg");
  assert.equal(res.headers["X-Image-Seq"], "3");
  assert.deepEqual(res.body, JPEG);
});

test("GET /debug/devices/{id}/image returns 404 when nothing is stored", async () => {
  const t = setup();
  const handler = createDebugImageFetchHandler({ imageStore: t.imageStore });
  const res = await handler(
    fakeRequest({ method: "GET", url: "https://api/x", params: { deviceId: "hydra" } }),
    t.context,
  );
  assert.equal(res.status, 404);
});

// --- debug/devices summary now reports lastImage ---------------------------

test("GET /debug/devices fills lastImage from the image store", async () => {
  const t = setup();
  t.imageStore.put("hydra", { buffer: JPEG, seq: 11 });
  const now = new Date("2026-11-02T07:00:00.000Z");
  const containers = () => ({
    state: {
      items: {
        query: () => ({ fetchAll: async () => ({ resources: [], requestCharge: 0 }) }),
      },
    },
  });
  const handler = createDebugDevicesHandler({
    catalogCache: t.catalogCache,
    containers,
    now: () => now,
    imageStore: t.imageStore,
  });
  const res = await handler(
    fakeRequest({ method: "GET", url: "https://api.example.test/api/v1/debug/devices" }),
    t.context,
  );
  assert.equal(res.status, 200);
  const summary = res.jsonBody.devices.find((d) => d.device.id === "hydra");
  assert.ok(summary.lastImage, "lastImage is populated");
  assert.equal(summary.lastImage.seq, 11);
  assert.equal(summary.lastImage.deviceId, "hydra");
  assert.ok(summary.lastImage.url.startsWith("https://api.example.test/api/v1/debug/devices/hydra/image"));
  assert.equal(summary.stale, false, "an image stored at 'now' means not stale");
});
