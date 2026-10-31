"use strict";

const { app } = require("@azure/functions");
const { containers } = require("../lib/cosmos");
const { createCatalogCache } = require("../lib/catalog");
const { createConfigHandler } = require("../lib/debug");
const { preflight } = require("../lib/http");

// GET https://<app>.azurewebsites.net/api/v1/config
// Public config for the front ends and the debug app: areas, stands and
// devices without any key hashes. Anonymous and read-only.

const catalogCache = createCatalogCache({
  container: () => containers().catalog,
  ttlMs: Number(process.env.CATALOG_CACHE_SECONDS || 60) * 1000,
});

app.http("config", {
  route: "v1/config",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return preflight();
    return createConfigHandler({ catalogCache })(request, context);
  },
});
