#!/usr/bin/env node
// Velo Stands – load stands, devices and device assignments into the "catalog"
// container, and give every area its document in "state".
//
//   node sync-catalog.mjs [stands.yaml] [--dry-run] [--prune]
//
//   --dry-run  only check the file and print the documents
//   --prune    also delete catalog documents of this site that are no longer in
//              the file, and state documents of areas that are no longer in it.
//              Use it to clear out test or sample data, not to retire devices.
//
//   COSMOS_ENDPOINT   https://<account>.documents.azure.com:443/ (not needed for --dry-run)
//   COSMOS_DATABASE   default: velostands
//   COSMOS_KEY        optional. Without it, your Azure CLI login or managed identity is used.
//
// The file is checked first, and nothing is written if it has errors.
// Without --prune the sync only adds and updates. To take a stand or device out
// of service, retire it in the file instead of deleting it, because the history
// points at it.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

// Used for devices that still use the short form `stand: fsw-1` without an assignment.
const DEFAULT_VALID_FROM = "2026-10-31";

const AREA_KINDS = ["covered", "inside", "open"];
const DEVICE_MODES = ["device", "cloud"];
const DEVICE_STATUSES = ["active", "maintenance", "retired"];

// ---------------------------------------------------------------------------
// Config -> catalog documents (pure, no I/O)
// ---------------------------------------------------------------------------

export function toCatalog(cfg) {
  const errors = [];
  const warnings = [];
  const site = cfg?.site ?? {};
  const areas = cfg?.areas ?? [];
  const stands = cfg?.stands ?? [];
  const devices = cfg?.devices ?? [];
  const explicit = cfg?.assignments ?? [];

  if (!site.id) errors.push("site.id is missing");
  const siteId = site.id;

  const uniqueIds = (list, kind) => {
    const ids = new Map();
    for (const item of list) {
      if (!item?.id) errors.push(`a ${kind} has no id`);
      else if (ids.has(item.id)) errors.push(`${kind} id "${item.id}" is used twice`);
      else ids.set(item.id, item);
    }
    return ids;
  };
  const areaById = uniqueIds(areas, "area");
  const standById = uniqueIds(stands, "stand");
  const deviceById = uniqueIds(devices, "device");

  for (const a of areas) {
    if (!AREA_KINDS.includes(a.kind)) errors.push(`area "${a.id}": kind must be ${AREA_KINDS.join(" | ")}`);
  }

  for (const s of stands) {
    if (!areaById.has(s.area)) errors.push(`stand "${s.id}": unknown area "${s.area}"`);
    if (!Number.isInteger(s.slots) || s.slots < 1) errors.push(`stand "${s.id}": slots must be a whole number of at least 1`);
    if (s.location !== undefined && !isLatLon(s.location)) {
      errors.push(`stand "${s.id}": location must be { lat: <-90..90>, lon: <-180..180> }`);
    }
    if (s.retiredAt !== undefined && !toIso(s.retiredAt)) errors.push(`stand "${s.id}": retiredAt is not a date`);
  }
  for (const a of areas) {
    if (!stands.some((s) => s.area === a.id)) warnings.push(`area "${a.id}" has no stands`);
  }

  const hashes = new Set();
  for (const d of devices) {
    if (!DEVICE_MODES.includes(d.mode)) errors.push(`device "${d.id}": mode must be ${DEVICE_MODES.join(" | ")}`);
    if (d.status !== undefined && !DEVICE_STATUSES.includes(d.status)) {
      errors.push(`device "${d.id}": status must be ${DEVICE_STATUSES.join(" | ")}`);
    }
    if (typeof d.keyHash !== "string" || !d.keyHash.startsWith("sha256:")) {
      errors.push(`device "${d.id}": keyHash must start with "sha256:"`);
    } else if (hashes.has(d.keyHash)) {
      errors.push(`device "${d.id}": keyHash is also used by another device`);
    }
    hashes.add(d.keyHash);
    if (d.config !== undefined && d.config !== null && (typeof d.config !== "object" || Array.isArray(d.config))) {
      errors.push(`device "${d.id}": config must be a mapping of knob names to values`);
    }
  }

  // Assignments: the explicit list, plus the short form `device.stand`.
  const assignments = explicit.map((a) => ({ ...a }));
  for (const d of devices) {
    if (d.stand && !explicit.some((a) => a.device === d.id)) {
      assignments.push({ device: d.id, stand: d.stand, from: DEFAULT_VALID_FROM });
    }
  }

  const byDevice = new Map();
  for (const a of assignments) {
    const label = `assignment ${a.device} -> ${a.stand}`;
    a.validFrom = toIso(a.from);
    a.validTo = a.to === undefined || a.to === null ? null : toIso(a.to);
    if (!deviceById.has(a.device)) errors.push(`${label}: unknown device`);
    if (!standById.has(a.stand)) errors.push(`${label}: unknown stand`);
    if (!a.validFrom) errors.push(`${label}: "from" is missing or not a date`);
    if (a.to != null && !a.validTo) errors.push(`${label}: "to" is not a date`);
    if (a.validFrom && a.validTo && a.validTo <= a.validFrom) errors.push(`${label}: "to" must be after "from"`);
    if (!byDevice.has(a.device)) byDevice.set(a.device, []);
    byDevice.get(a.device).push(a);
  }

  // One device, one stand at a time: periods must not overlap, and only the last may be open.
  for (const [deviceId, list] of byDevice) {
    list.sort((x, y) => String(x.validFrom).localeCompare(String(y.validFrom)));
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      if (prev.validTo === null || prev.validTo > list[i].validFrom) {
        errors.push(`device "${deviceId}": assignments overlap (${prev.stand} from ${prev.validFrom} and ${list[i].stand} from ${list[i].validFrom})`);
      }
    }
  }

  const openAssignment = new Map();
  for (const [deviceId, list] of byDevice) {
    const open = list.find((a) => a.validTo === null);
    if (open) openAssignment.set(deviceId, open);
  }
  for (const d of devices) {
    const status = d.status ?? "active";
    const open = openAssignment.get(d.id);
    if (status === "retired" && open) errors.push(`device "${d.id}" is retired but still assigned to "${open.stand}": add "to" to its assignment`);
    if (status !== "retired" && !open) warnings.push(`device "${d.id}" is not assigned to any stand, so its readings will be refused`);
    const stand = open && standById.get(open.stand);
    if (stand?.retiredAt) errors.push(`device "${d.id}" is assigned to retired stand "${stand.id}"`);
  }
  for (const s of stands) {
    if (!s.retiredAt && ![...openAssignment.values()].some((a) => a.stand === s.id)) {
      warnings.push(`stand "${s.id}" has no device watching it`);
    }
  }

  if (errors.length) return { errors, warnings, docs: [], areaIds: [], activeDevicesByArea: new Map() };

  const docs = [
    {
      id: `site:${siteId}`, type: "site", siteId,
      name: site.name ?? siteId,
      timezone: site.timezone ?? "Europe/Zurich",
      recognition: cfg.recognition ?? null,
      settings: cfg.settings ?? null,
    },
    ...areas.map((a) => ({
      id: `area:${a.id}`, type: "area", siteId,
      areaId: a.id, name: a.name ?? a.id, kind: a.kind,
    })),
    ...stands.map((s) => ({
      id: `stand:${s.id}`, type: "stand", siteId,
      standId: s.id, areaId: s.area, name: s.name ?? s.id, slots: s.slots,
      location: s.location ? { type: "Point", coordinates: [s.location.lon, s.location.lat] } : null, // GeoJSON: [lon, lat]
      locationNote: s.locationNote ?? null,
      retiredAt: s.retiredAt ? toIso(s.retiredAt) : null,
    })),
    ...devices.map((d) => ({
      id: `device:${d.id}`, type: "device", siteId,
      deviceId: d.id, name: d.name ?? d.id, hardware: d.hardware ?? "unknown", mode: d.mode,
      keyHash: d.keyHash, serial: d.serial ?? null, status: d.status ?? "active",
      config: d.config ?? null,  // free-form device knobs, served back by /v1/device/config
    })),
    ...assignments.map((a) => ({
      id: `assignment:${a.device}:${a.validFrom}`, type: "assignment", siteId,
      deviceId: a.device, standId: a.stand, areaId: standById.get(a.stand).area,
      validFrom: a.validFrom, validTo: a.validTo, note: a.note ?? null,
    })),
  ];

  const activeDevicesByArea = new Map(areas.map((a) => [a.id, new Set()]));
  for (const [deviceId, a] of openAssignment) {
    activeDevicesByArea.get(standById.get(a.stand).area).add(deviceId);
  }

  return { errors, warnings, docs, areaIds: areas.map((a) => a.id), activeDevicesByArea };
}

function isLatLon(v) {
  return v && typeof v === "object"
    && typeof v.lat === "number" && v.lat >= -90 && v.lat <= 90
    && typeof v.lon === "number" && v.lon >= -180 && v.lon <= 180;
}

// A date (2026-10-31) means midnight UTC. Always returns full ISO 8601 with
// milliseconds, so the strings sort correctly. Returns null if it isn't a date.
function toIso(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v !== "string") return null;
  const s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v;
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

// ---------------------------------------------------------------------------
// Writing to Cosmos DB
// ---------------------------------------------------------------------------

async function withAccessRetry(fn, tries = 12) {
  // New data-access role assignments can take a few minutes to become active.
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e?.code !== 403 || i >= tries) throw e;
      console.log(`  waiting for data access to become active (${i}/${tries - 1})…`);
      await new Promise((r) => setTimeout(r, 15_000));
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const prune = args.includes("--prune");
  const file = args.find((a) => !a.startsWith("--")) ?? fileURLToPath(new URL("./stands.sample.yaml", import.meta.url));

  const cfg = parse(await readFile(file, "utf8"));
  const { errors, warnings, docs, areaIds, activeDevicesByArea } = toCatalog(cfg);

  for (const w of warnings) console.warn(`  warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`  error: ${e}`);
    console.error(`\n${file} has ${errors.length} error(s). Nothing was written.`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(JSON.stringify(docs, null, 2));
    console.log(`\n${docs.length} catalog documents, ${areaIds.length} area state documents. Dry run, nothing written.`);
    return;
  }

  const endpoint = process.env.COSMOS_ENDPOINT;
  if (!endpoint) throw new Error("Set COSMOS_ENDPOINT, e.g. https://<account>.documents.azure.com:443/");
  const { CosmosClient } = await import("@azure/cosmos");
  const client = process.env.COSMOS_KEY
    ? new CosmosClient({ endpoint, key: process.env.COSMOS_KEY })
    : new CosmosClient({ endpoint, aadCredentials: new (await import("@azure/identity")).DefaultAzureCredential() });
  const db = client.database(process.env.COSMOS_DATABASE ?? "velostands");
  const catalog = db.container("catalog");
  const state = db.container("state");

  // Catalog: upsert everything (idempotent, the ids are derived from the config).
  await withAccessRetry(() => catalog.items.upsert(docs[0]));
  for (const doc of docs.slice(1)) await catalog.items.upsert(doc);
  console.log(`  catalog: ${docs.length} documents upserted`);

  // State: one document per area. Ingest patches /devices/<deviceId> into it,
  // so it has to exist. Existing documents keep their live counts.
  const now = new Date().toISOString();
  let created = 0;
  let removed = 0;
  for (const areaId of areaIds) {
    const item = state.item(areaId, areaId);
    const { resource } = await item.read();
    if (!resource) {
      await state.items.create({ id: areaId, areaId, devices: {}, updatedAt: now });
      created++;
      continue;
    }
    // Drop entries of devices that are no longer assigned in this area (replaced or retired).
    const active = activeDevicesByArea.get(areaId);
    const stale = Object.keys(resource.devices ?? {}).filter((id) => !active.has(id));
    for (let i = 0; i < stale.length; i += 10) {
      const ops = stale.slice(i, i + 10).map((id) => ({ op: "remove", path: `/devices/${id}` }));
      await item.patch(ops);
    }
    removed += stale.length;
  }
  console.log(`  state: ${created} area document(s) created, ${removed} old device entr${removed === 1 ? "y" : "ies"} removed`);

  if (prune) {
    const siteId = docs[0].siteId;
    const keep = new Set(docs.map((d) => d.id));
    const { resources: existing } = await catalog.items
      .query({ query: "SELECT c.id FROM c WHERE c.siteId = @siteId", parameters: [{ name: "@siteId", value: siteId }] }, { partitionKey: siteId })
      .fetchAll();
    const gone = existing.filter((d) => !keep.has(d.id));
    for (const d of gone) await catalog.item(d.id, siteId).delete();

    const { resources: areaDocs } = await state.items.query("SELECT c.id, c.areaId FROM c").fetchAll();
    const goneAreas = areaDocs.filter((d) => !areaIds.includes(d.areaId));
    for (const d of goneAreas) await state.item(d.id, d.areaId).delete();

    console.log(`  prune: ${gone.length} catalog document(s) and ${goneAreas.length} area state document(s) deleted`);
    for (const d of gone) console.log(`    - ${d.id}`);
    for (const d of goneAreas) console.log(`    - state ${d.id}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e?.message ?? e);
    process.exit(1);
  });
}
