"use strict";

// Objects shared by all functions of one Function App instance: the Cosmos DB
// containers, the Web PubSub client and the in-memory caches. Created once,
// on first use.

const { containers } = require("./cosmos");
const { createCatalogCache } = require("./catalog");
const { createStateCache } = require("./stands");
const { pubsub } = require("./pubsub");

const verbose = process.env.DEBUG_LOGGING !== "false";

const catalogCache = createCatalogCache({
  container: () => containers().catalog,
  ttlMs: Number(process.env.CATALOG_CACHE_SECONDS || 60) * 1000,
});

const stateCache = createStateCache({
  container: () => containers().state,
  ttlMs: Number(process.env.STATE_CACHE_SECONDS || 5) * 1000,
});

module.exports = { containers, catalogCache, stateCache, pubsub, verbose };
