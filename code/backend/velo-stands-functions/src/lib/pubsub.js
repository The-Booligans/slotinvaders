"use strict";

// One Web PubSub client per Function instance, created on first use.
// Returns null when WEBPUBSUB_CONNECTION_STRING isn't set, so the rest of the
// API still runs locally without live updates.

const HUB = process.env.WEBPUBSUB_HUB || "occupancy";

let client;

function pubsub() {
  if (client !== undefined) return client;
  const connectionString = process.env.WEBPUBSUB_CONNECTION_STRING;
  if (!connectionString) return (client = null);
  const { WebPubSubServiceClient } = require("@azure/web-pubsub");
  return (client = new WebPubSubServiceClient(connectionString, HUB));
}

module.exports = { pubsub };
