"use strict";

const { app } = require("@azure/functions");
const { containers } = require("../lib/cosmos");
const { createCatalogCache } = require("../lib/catalog");
const { createDebugDevicesHandler, createDebugLogsHandler } = require("../lib/debug");
const { preflight } = require("../lib/http");

// GET https://<app>.azurewebsites.net/api/v1/debug/devices
// GET https://<app>.azurewebsites.net/api/v1/debug/devices/{deviceId}/logs?limit=200
//
// Serve the debug app (code/debug). Both endpoints are anonymous and read-only.
// Logs come from an in-memory ring buffer the readings handler writes to, so
// they are per Function instance and vanish on restart. For the full history,
// use Application Insights.

const catalogCache = createCatalogCache({
  container: () => containers().catalog,
  ttlMs: Number(process.env.CATALOG_CACHE_SECONDS || 60) * 1000,
});

app.http("debugDevices", {
  route: "v1/debug/devices",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return preflight();
    return createDebugDevicesHandler({ catalogCache, containers })(request, context);
  },
});

app.http("debugDeviceLogs", {
  route: "v1/debug/devices/{deviceId}/logs",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return preflight();
    return createDebugLogsHandler({ catalogCache })(request, context);
  },
});
