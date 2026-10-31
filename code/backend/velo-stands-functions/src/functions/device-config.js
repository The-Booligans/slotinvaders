"use strict";

const { app } = require("@azure/functions");
const { catalogCache } = require("../lib/runtime");
const { createDeviceConfigHandler } = require("../lib/device-config");
const { preflight } = require("../lib/http");

// GET https://<app>.azurewebsites.net/api/v1/device/config
// Device fetches its own thresholds, slot count and report interval at boot.
// Authenticated with X-Api-Key, like /v1/readings.

const handler = createDeviceConfigHandler({ catalogCache });

app.http("deviceConfig", {
  route: "v1/device/config",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return preflight();
    return handler(request, context);
  },
});
