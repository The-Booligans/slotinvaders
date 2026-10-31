"use strict";

// One Cosmos DB client per Function instance, created on first use.
// In Azure the Function App's managed identity signs in (no keys needed);
// locally your `az login` is used, or COSMOS_KEY if you set it.

let client = null;

function getClient() {
  if (client) return client;
  const { CosmosClient } = require("@azure/cosmos");
  const endpoint = process.env.COSMOS_ENDPOINT;
  if (!endpoint) throw new Error("App setting COSMOS_ENDPOINT is missing");
  if (process.env.COSMOS_KEY) {
    client = new CosmosClient({ endpoint, key: process.env.COSMOS_KEY });
  } else {
    const { DefaultAzureCredential } = require("@azure/identity");
    client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
  }
  return client;
}

function database() {
  return getClient().database(process.env.COSMOS_DATABASE || "velostands");
}

function containers() {
  const db = database();
  return {
    catalog: db.container("catalog"),
    state: db.container("state"),
    readings: db.container("readings"),
  };
}

module.exports = { containers };
