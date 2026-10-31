"use strict";

const { app } = require("@azure/functions");
const { catalogCache, stateCache, pubsub, verbose } = require("../lib/runtime");
const { createNegotiateHandler, createBroadcastHandler, createEventsHandler } = require("../lib/push");
const { preflight } = require("../lib/http");

// Live stand status for the app, over Web PubSub (see src/lib/push.js).
//   POST https://<app>.azurewebsites.net/api/v1/negotiate  -> { url }
//   new WebSocket(url) receives { type: "stands", at, stands } every 10 s

const negotiate = createNegotiateHandler({ pubsub, verbose });

app.http("negotiate", {
  route: "v1/negotiate",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return preflight();
    return negotiate(request, context);
  },
});

app.timer("broadcast", {
  // six fields: second minute hour day month weekday
  schedule: process.env.PUSH_SCHEDULE || "*/10 * * * * *",
  handler: createBroadcastHandler({ pubsub, catalogCache, stateCache, verbose }),
});

app.http("pubsubEvents", {
  route: "v1/pubsub/events",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: createEventsHandler({ pubsub, catalogCache, stateCache, verbose }),
});
