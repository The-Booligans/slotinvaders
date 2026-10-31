"use strict";

const { app } = require("@azure/functions");
const { catalogCache, stateCache, verbose } = require("../lib/runtime");
const { createStandsHandler } = require("../lib/stands");

// Public stand status, no key needed:
//   GET https://<app>.azurewebsites.net/api/v1/stands
//   GET https://<app>.azurewebsites.net/api/v1/stands?area=kaegen-hof
//   GET https://<app>.azurewebsites.net/api/v1/stands/kaegen-hof-1

app.http("stands", {
  route: "v1/stands/{standId?}",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: createStandsHandler({ catalogCache, stateCache, verbose }),
});
