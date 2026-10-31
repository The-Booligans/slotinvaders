"use strict";

const { app } = require("@azure/functions");
const { containers } = require("../lib/cosmos");
const { createCatalogCache } = require("../lib/catalog");
const { createReadingsHandler } = require("../lib/ingest");
const { preflight } = require("../lib/http");

// Devices send their count here: POST https://<app>.azurewebsites.net/api/v1/readings
// with the header X-Api-Key. The key itself is the authentication, so the
// function is anonymous at the Functions level.

const catalogCache = createCatalogCache({
  container: () => containers().catalog,
  ttlMs: Number(process.env.CATALOG_CACHE_SECONDS || 60) * 1000,
});

const ingest = createReadingsHandler({
  catalogCache,
  containers,
  verbose: process.env.DEBUG_LOGGING !== "false",
});

app.http("readings", {
  route: "v1/readings",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return preflight();
    return ingest(request, context);
  },
});
