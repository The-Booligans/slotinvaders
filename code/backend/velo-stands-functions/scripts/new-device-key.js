#!/usr/bin/env node
"use strict";

// Device API keys.
//
//   node scripts/new-device-key.js <secret>   the keyHash of an existing secret
//   node scripts/new-device-key.js            a new random secret and its keyHash
//
// The secret goes onto the device and is sent as X-Api-Key; never commit it.
// Only keyHash goes into stands.yaml. Load the file again with the Cosmos sync
// afterwards (deploy-cosmos.ps1 -Sync).

const crypto = require("node:crypto");

const key = process.argv[2] ?? crypto.randomBytes(32).toString("base64url");
const hash = "sha256:" + crypto.createHash("sha256").update(key, "utf8").digest("hex");

if (!process.argv[2]) console.log(`secret:   ${key}`);
console.log(`keyHash:  "${hash}"`);
