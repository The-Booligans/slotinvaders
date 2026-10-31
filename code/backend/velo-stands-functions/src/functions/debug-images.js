"use strict";

const { app } = require("@azure/functions");
const { containers } = require("../lib/cosmos");
const { createCatalogCache } = require("../lib/catalog");
const { createDebugImageUploadHandler, createDebugImageFetchHandler } = require("../lib/debug-image");
const { preflight } = require("../lib/http");

// POST /api/v1/debug/images                   — a device uploads its latest JPEG
// GET  /api/v1/debug/devices/{deviceId}/image — the debug app pulls it back
//
// The POST stores only the latest frame per device in memory (per Function
// instance) and never writes to Cosmos. The GET serves the raw bytes. Both
// are anonymous at the Functions level; the POST is gated by X-Api-Key.

const catalogCache = createCatalogCache({
  container: () => containers().catalog,
  ttlMs: Number(process.env.CATALOG_CACHE_SECONDS || 60) * 1000,
});

app.http("debugImageUpload", {
  route: "v1/debug/images",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return preflight();
    return createDebugImageUploadHandler({ catalogCache })(request, context);
  },
});

app.http("debugImageFetch", {
  route: "v1/debug/devices/{deviceId}/image",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return preflight();
    return createDebugImageFetchHandler()(request, context);
  },
});
