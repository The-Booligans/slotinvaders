"use strict";

const { app } = require("@azure/functions");
const { containers, catalogCache, verbose } = require("../lib/runtime");
const { createReadingsHandler } = require("../lib/ingest");
const { preflight } = require("../lib/http");

// Devices send their count here: POST https://<app>.azurewebsites.net/api/v1/readings
// with the header X-Api-Key. The key itself is the authentication, so the
// function is anonymous at the Functions level.

<<<<<<< Updated upstream
const catalogCache = createCatalogCache({
  container: () => containers().catalog,
  ttlMs: Number(process.env.CATALOG_CACHE_SECONDS || 60) * 1000,
});

const ingest = createReadingsHandler({
  catalogCache,
  containers,
  verbose: process.env.DEBUG_LOGGING !== "false",
});

=======
>>>>>>> Stashed changes
app.http("readings", {
  route: "v1/readings",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
<<<<<<< Updated upstream
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return preflight();
    return ingest(request, context);
  },
=======
  handler: createReadingsHandler({ catalogCache, containers, verbose }),
>>>>>>> Stashed changes
});
