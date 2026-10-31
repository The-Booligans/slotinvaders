# Velo Stands – Cosmos DB setup

Creates the serverless Cosmos DB for the Velo Stands backend and, optionally, loads the stands and devices into it.

| File | What it is |
|---|---|
| `deploy-cosmos.ps1` | The script you run in PowerShell. Creates the account, the database and the containers in the existing resource group `nag-rg-slotinvaders`. |
| `deploy-cosmos.sh` | The same script for Bash (Linux, macOS, Cloud Shell). |
| `cosmos.bicep` | The infrastructure as code: account, database, four containers and data access. |
| `sync-catalog.mjs` | Checks a stands file and loads it into the `catalog` container. |
| `stands.sample.yaml` | Example stands file: one area, one stand, two devices. |
| `package.json` | Dependencies of the sync script. |

## Run it

You need the Azure CLI, Contributor rights on the resource group `nag-rg-slotinvaders` and, for the sync, Node.js 20 or later.

**PowerShell**, from this folder. In a PowerShell prompt that's already open, such as Azure Cloud Shell, Linux or macOS:

```powershell
./deploy-cosmos.ps1 -Sync
```

On Windows, if the execution policy blocks scripts, start it like this instead. The bypass applies to this one run only:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy-cosmos.ps1 -Sync
```

`Get-Help ./deploy-cosmos.ps1 -Detailed` lists all options.

**Bash**:

```bash
chmod +x deploy-cosmos.sh
./deploy-cosmos.sh --sync
```

That creates a serverless account in `nag-rg-slotinvaders` in subscription `1bd6c9df-485a-459f-9a7c-6ce143b7909d`, in Switzerland North. It gives you read and write access to the data and loads `stands.sample.yaml`. The script never creates or changes the resource group itself, and stops if it can't find it. A new account takes a few minutes. Running the script again is safe: everything is updated in place, and live counts in `state` are kept.

| PowerShell | Bash | Default | |
|---|---|---|---|
| `-ResourceGroup` | `-g`, `--resource-group` | `nag-rg-slotinvaders` | Must already exist |
| `-Location` | `-l`, `--location` | `switzerlandnorth` | If the region has no capacity for new accounts, try `germanywestcentral` |
| `-Account` | `-n`, `--account` | `velostands-<hash>` | Must be unique across Azure |
| `-Subscription` | `-s`, `--subscription` | `1bd6c9df-485a-459f-9a7c-6ce143b7909d` | |
| `-Grant <id>,<id>` | `--grant <id>` (repeatable) | | More identities with data access, such as the Function App's managed identity |
| `-Sync` `-SyncFile <file>` | `--sync [file]` | `stands.sample.yaml` | Loads stands, devices and assignments into `catalog` |
| `-PeriodicBackup` | `--periodic-backup` | off | Use this if the region refuses continuous backup |
| `-NoKeys` | `--no-keys` | off | Turns off account keys, so only Entra ID identities get in |

To check a stands file without writing anything, run `npm install` and then `node sync-catalog.mjs config/stands.yaml --dry-run`.

## Cheapest settings

- **Serverless**: you pay per request unit and per GB stored, with no minimum. There is no tier to choose. The free tier exists only for provisioned throughput, not for serverless.
- **One region, no availability zones.** Zones would add 25 % to every request.
- **Continuous 7-day backup.** It has no backup storage charge and gives point-in-time restore. You only pay if you restore.
- **Only the queried fields are indexed** in the write-heavy containers, because every indexed field costs request units on each write.

At 10 devices sending once a minute, expect roughly USD 2–3 a month. That figure assumes about 20 request units per reading, for the insert plus the state update.

## Containers

| Container | Partition key | Expires | One document per |
|---|---|---|---|
| `catalog` | `/siteId` | never | site, area, stand, device and device assignment (`type` tells them apart) |
| `readings` | `/standId` | 30 days | accepted reading (an occupancy event, never updated) |
| `state` | `/areaId` | never | area, holding the latest count of each of its devices |
| `rollups` | `/standId` | never | stand and hour |

Partition keys can't be changed later, so changing one means a new container. Indexes, expiry and access can be changed by editing `cosmos.bicep` and running the script again. Containers can't be created with account keys. That's deliberate: the template is the only place where they change.

### Document shapes

```jsonc
// catalog: run the sync with --dry-run to see all types
{ "id": "stand:fsw-1", "type": "stand", "siteId": "reinach", "standId": "fsw-1", "areaId": "flow-sw",
  "name": "Flow South West – Stand 1", "slots": 20,
  "location": { "type": "Point", "coordinates": [7.59, 47.495] },          // GeoJSON: [lon, lat]
  "locationNote": "…", "retiredAt": null }
{ "id": "assignment:cam-01:2026-10-31T00:00:00.000Z", "type": "assignment", "siteId": "reinach",
  "deviceId": "cam-01", "standId": "fsw-1", "areaId": "flow-sw",
  "validFrom": "2026-10-31T00:00:00.000Z", "validTo": null }

// readings: written by the ingest Functions
{ "id": "<uuid>", "standId": "fsw-1", "areaId": "flow-sw", "deviceId": "cam-01", "source": "device",
  "occupied": 9, "seq": 1842, "receivedAt": "2026-10-31T07:42:11Z", "measuredAt": "2026-10-31T07:42:10Z",
  "fw": "0.3.1", "rssi": -61 }
  // cloud devices also: "deviceCount", "model", "meanConfidence"

// state: id = areaId. Ingest patches /devices/<deviceId>, guarded by seq.
{ "id": "flow-sw", "areaId": "flow-sw", "updatedAt": "…",
  "devices": { "cam-01": { "standId": "fsw-1", "occupied": 9, "source": "device", "seq": 1842, "at": "…" } } }

// rollups: id = "<standId>:<hourStartUtc>", written by the hourly timer
{ "id": "fsw-1:2026-11-02T07:00:00Z", "standId": "fsw-1", "areaId": "flow-sw",
  "hourStartUtc": "2026-11-02T07:00:00Z", "localDate": "2026-11-02", "localHour": 8, "dayOfWeek": 1,
  "isWorkday": true, "slots": 20, "avgOccupied": 14.3, "minOccupied": 9, "maxOccupied": 20,
  "avgOccupancyRate": 0.715, "minutesFull": 12, "coverage": 1.0, "devices": ["cam-01", "cam-02"] }
```

The sync creates an empty `state` document for each area, because a patch needs an existing document. When a device is retired or moved, the sync also removes it from its area's `state` document.

## After setup

- **Function App**: set `COSMOS_ENDPOINT` and `COSMOS_DATABASE`. Turn on its system-assigned managed identity and give it data access with `.\deploy-cosmos.ps1 -Grant <principal-id>` or `./deploy-cosmos.sh --grant <principal-id>`. Add the account name too if you chose your own. In code, use `new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() })`.
- **No keys anywhere**: once the Functions use the identity, run the script again with `-NoKeys` (`--no-keys` in Bash).
- **Teammates**: give them access to the resource group, and data access with `-Grant <their object id>`, so local code and tools can use their own login.

## Replacing a device

A replacement device gets its own id and key. In the stands file:

1. Add the new device (`pnpm device:add cam-03 …`).
2. Set the old device to `status: retired` and add `to:` to its assignment.
3. Add an assignment for the new device that starts on the same date.
4. Run `.\deploy-cosmos.ps1 -Sync -SyncFile config\stands.yaml` (or `./deploy-cosmos.sh --sync config/stands.yaml`) again.

The stand's history and trend rows carry on, because they are stored per stand.
