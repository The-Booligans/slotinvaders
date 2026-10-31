# Velo Stands – device API and stand status (Azure Functions, Node.js 22)

Two HTTP functions:

| Function | Route | Auth | |
|---|---|---|---|
| `readings` | `POST /api/v1/readings` | device key in `X-Api-Key` | Devices send their count |
| `stands` | `GET /api/v1/stands[/<standId>]` | none (public, read-only) | Name, current and maximum occupancy per stand |

## POST /api/v1/readings

Devices send the number of bikes they see. The function finds the device's stand and works out the free slots, `max(0, slots − sum of all the stand's device counts)`. It then updates Cosmos DB and logs every step.

```
POST https://<app>.azurewebsites.net/api/v1/readings
X-Api-Key: vs_...
Content-Type: application/json

{ "occupied": 9, "seq": 1842, "measuredAt": "2026-11-02T07:00:00Z", "fw": "0.3.1", "rssi": -61 }
```

```json
202 { "device": "thor", "stand": "kaegen-hof-1", "occupied": 9, "standOccupied": 21, "slots": 40, "free": 19, "nextInSeconds": 60 }
```

| Status | When |
|---|---|
| 202 | Accepted: state updated and the reading stored in the history |
| 200 | `seq` isn't higher than the last one, so it's ignored as a duplicate or late retry (`"duplicate": true`) |
| 400 | The body isn't valid JSON |
| 401 | The key is missing, unknown or belongs to a retired device |
| 403 | The device is in `maintenance` |
| 409 | The device sends images (`mode: cloud`), has no open assignment, or its stand is retired |
| 422 | Invalid body: a missing or negative count, more than the stand's slots, or an unknown field |
| 429 | More than one reading from the same device within 5 s |
| 503 | Cosmos DB couldn't be reached. The device simply sends again next cycle. |

`occupied` and `seq` are required; `measuredAt`, `fw` and `rssi` are optional. A `seq` lower than the last one is accepted if the device has been silent longer than `staleAfterSeconds` (300 s), because it most likely restarted.

## GET /api/v1/stands (public)

Returns each stand's name, current occupancy and maximum occupancy. No key is needed, and any web page may call it.

| Request | Returns |
|---|---|
| `GET /api/v1/stands` | All active stands |
| `GET /api/v1/stands?area=kaegen-hof` | The stands of one area (404 for an unknown area) |
| `GET /api/v1/stands/kaegen-hof-1` | One stand (404 if unknown or retired) |

```json
GET /api/v1/stands
{
  "at": "2026-11-02T07:00:00.000Z",
  "stands": [
    { "id": "kaegen-hof-1", "name": "Kägenstrasse 2 – Hof, Stand 1",
      "areaId": "kaegen-hof", "areaName": "Kägenstrasse 2 – Hof",
      "currentOccupancy": 21, "maxOccupancy": 40, "free": 19,
      "stale": false, "updatedAt": "2026-11-02T06:59:30.000Z" }
  ]
}
```

| Field | Meaning |
|---|---|
| `currentOccupancy` | Bikes counted now: the sum of the latest count of every device assigned to the stand. A device that never reported counts as 0. It can exceed `maxOccupancy` if two devices see the same bike. |
| `maxOccupancy` | The stand's slots from `stands.yaml` |
| `free` | `max(0, maxOccupancy − currentOccupancy)` |
| `stale` | `true` if a device of the stand never reported or has been quiet for more than `staleAfterSeconds` (300 s). The numbers may then be out of date. |
| `updatedAt` | Time of the stand's most recent device report, or `null` |

The numbers are worked out on every request from the latest device counts, so a device that goes quiet shows up as `stale` without any extra job. To keep a public endpoint cheap, the device counts are read from Cosmos DB at most every 5 s per instance (`STATE_CACHE_SECONDS`), and browsers may cache the answer for 5 s. Each Cosmos read costs about 3 RU, whatever the number of callers.

Log lines look like this:

```
[stands 5e1a77c0] -> GET /api/v1/stands from 198.51.100.23
[stands 5e1a77c0] state loaded: 6 area documents (2.86 RU)
[stands 5e1a77c0] cmr-ost-1: ling=0 (never reported) = 0 of 20 slots, 20 free (stale: ling never reported)
[stands 5e1a77c0] kaegen-hof-1: thor=9 + probe=12 = 21 of 40 slots, 19 free
[stands 5e1a77c0] <- 200 in 22 ms, 5.9 RU | 6 stands, 1 stale
```

## What the readings function writes

| Container | What changes |
|---|---|
| `state` (one document per area) | `devices.<deviceId>`: latest count, seq and time. `stands.<standId>`: slots, occupied, free, missing and stale devices. Both are recalculated on every reading. |
| `readings` (history, 30 days) | One new document per accepted reading. It includes the stand's total and free count at that moment, which the hourly trend job can use directly. |

Two devices in the same area can send at the same moment. The area document is then updated with optimistic concurrency, re-reading and retrying up to 5 times, so no count gets lost. Stands, devices and assignments are read from the `catalog` container and cached for 60 s per instance. A key the cache doesn't know triggers a reload, at most every 10 s, so a newly synced device works right away.

## Files

| File | |
|---|---|
<<<<<<< Updated upstream
| `src/functions/readings.js` | Registers `POST /api/v1/readings` |
| `src/functions/config.js` | Registers `GET /api/v1/config` |
| `src/functions/debug.js` | Registers `GET /api/v1/debug/devices` and `GET /api/v1/debug/devices/{deviceId}/logs` |
=======
| `src/functions/readings.js` | Registers the HTTP function `POST /api/v1/readings` |
| `src/functions/stands.js` | Registers the HTTP function `GET /api/v1/stands/{standId?}` |
| `src/lib/stands.js` | Stand status: state cache, totals, public response |
| `src/lib/runtime.js` | Cosmos containers and caches shared by both functions |
| `src/lib/http.js` | Log prefix and JSON replies |
>>>>>>> Stashed changes
| `src/lib/ingest.js` | The request flow and the log output |
| `src/lib/debug.js` | Public config and debug handlers |
| `src/lib/catalog.js` | Catalog cache and key check (SHA-256, compared in constant time) |
| `src/lib/occupancy.js` | Stand totals and free slots |
| `src/lib/validate.js` | Body checks |
| `src/lib/device-log.js` | Per-device in-memory ring buffer for the debug endpoint |
| `src/lib/http.js` | Shared reply builder and CORS preflight |
| `src/lib/cosmos.js` | Cosmos DB client (managed identity in Azure, `az login` locally) |
| `function.bicep` | Function App, Consumption plan, storage, Application Insights, Cosmos DB access |
| `deploy-function.ps1` | Creates the Azure resources and deploys the code |
| `scripts/new-device-key.js` | Hashes a device secret, or creates a new one |
| `scripts/send-test-reading.ps1` | Sends a reading the way a device would |
| `test/ingest.test.js`, `test/stands.test.js` | 17 tests against an in-memory Cosmos DB (`npm test`) |

## Deploy

You need the Azure CLI and Node.js 22 with npm; Azure Cloud Shell has both. Run `deploy-cosmos.ps1` first: this script looks up the Cosmos DB account that it created.

```powershell
./deploy-function.ps1
```

The script uses the same defaults as the database script: subscription `1bd6c9df-…`, tenant `7ec7369b-…`, resource group `nag-rg-slotinvaders` and region `switzerlandnorth`. It creates the resources and then deploys the code. To deploy only new code, run `./deploy-function.ps1 -SkipInfra`.

## Device keys and a test reading

Each device has a secret API key: it's flashed to the device, sent as `X-Api-Key`, and never committed. `stands.yaml` only holds `keyHash`, which is `"sha256:"` followed by the SHA-256 (lowercase hex) of the secret. The function hashes the key it receives and compares the result with `keyHash`, in constant time. To get the `keyHash` for a secret, or to create a new random secret:

```powershell
node scripts/new-device-key.js <secret>      # prints keyHash
node scripts/new-device-key.js               # new secret + keyHash
```

After changing `stands.yaml`, reload the catalog from the Cosmos folder with `./deploy-cosmos.ps1 -Sync`. Then send a reading as a device:

```powershell
./scripts/send-test-reading.ps1 -Url https://<app>.azurewebsites.net/api/v1/readings -Key <thor's secret> -Occupied 9
```

## Debug log

Every request writes lines like these:

```
[readings 7f3c9a12] -> POST /api/v1/readings from 198.51.100.23
[readings 7f3c9a12] catalog loaded: 6 stands, 11 devices, 11 open assignments (3.04 RU)
[readings 7f3c9a12] device thor "Kägenstrasse Hof – ToF, near row" (vl53l5cx-array, mode device) -> stand kaegen-hof-1 "Kägenstrasse 2 – Hof, Stand 1" (40 slots) in area kaegen-hof
[readings 7f3c9a12] body: occupied=9 seq=1842 measuredAt=2026-11-02T07:00:00.000Z fw=0.3.1 rssi=-61
[readings 7f3c9a12] previous: none, this is the device's first reading
[readings 7f3c9a12] stand kaegen-hof-1: thor=9 + probe=12 = 21 of 40 slots -> 19 free
[readings 7f3c9a12] state of area kaegen-hof updated (attempt 1)
[readings 7f3c9a12] reading c0a424cb-adc4-43d6-82b0-65193b2ede7b stored in history
[readings 7f3c9a12] <- 202 in 48 ms, 22.14 RU | thor -> kaegen-hof-1: 9 bikes, stand 21/40, 19 free

WARN [readings b04e1d77] <- 429 in 9 ms, 1 RU | device thor: last reading only 2000 ms ago
WARN [readings c2a81f05] <- 401 in 2 ms, 0 RU | unknown key (hash sha256:28e0f7ef...)
WARN [readings d9e3b6a0] <- 422 in 3 ms, 0 RU | device probe: occupied (44) is more than the stand's 40 slots
```

The 8 characters after `readings` are the start of the invocation ID, so the lines of one request belong together. API keys are never logged, only the start of an unknown key's hash.

Where to see the log:

- **Live:** Azure portal > the Function App > **Log stream**.
- **Afterwards:** Application Insights > **Logs**:
  ```
  traces
  | where message startswith "[readings"
  | project timestamp, severityLevel, message
  | order by timestamp desc
  ```

When you're done debugging, run `./deploy-function.ps1 -QuietLogs`. Each request then writes only its last line, the one with the status code. Log ingestion is capped at 0.15 GB a day either way.

## Cost

The Consumption plan on Windows is the cheapest option at this load. 11 devices sending once a minute make about 475,000 calls a month. That fits within the plan's monthly free grant of 1 million executions and 400,000 GB-s, which applies to pay-as-you-go subscriptions and is shared by all function apps in the subscription. The Flex Consumption plan, which Microsoft now recommends for new apps, would cost roughly USD 3–4 a month for the same load, because it bills at least one second per execution. The storage account and the logs cost cents. The function stops any request after 30 s (`functionTimeout`), so a hanging call can't run up a bill.

The trade-off is cold starts: after a quiet period, the first request takes a few seconds. Devices don't notice, because they only wait for the answer.

## Run it locally (optional)

With [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local):

```powershell
npm install
copy local.settings.sample.json local.settings.json   # set COSMOS_ENDPOINT
az login                                              # your account needs data access, see deploy-cosmos.ps1 -Grant
func start
./scripts/send-test-reading.ps1 -Url http://localhost:7071/api/v1/readings -Key <key> -Occupied 3
```

## Client and debug endpoints

Three GET endpoints are anonymous and read-only. They share a wide-open CORS header, so the debug app can call them from a browser tab on a different port.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/config` | The public config: `site`, `areas`, `stands` and `devices`. `keyHash` is never included; retired stands and devices are left out. |
| `GET /api/v1/debug/devices` | For each active device: its public info plus `lastSeenAt` and `stale` from the state container. `lastImage` is always `null` until `POST /api/v1/images` is in place. |
| `GET /api/v1/debug/devices/{deviceId}/logs?limit=200` | The recent log lines for one device, newest last. |

The log entries come from an in-memory ring buffer the ingest handler writes to (200 lines per device, override with `DEVICE_LOG_MAX`). The buffer is per Function instance, so it resets when the app scales or restarts; the authoritative log still lives in Application Insights. `limit` is capped at the buffer size.

The debug app (`code/debug`) is wired to these three endpoints:

```
NEXT_PUBLIC_API_URL=http://localhost:7071 pnpm --filter code/debug dev
```

## Not in here yet

- `POST /api/v1/images` for cloud-counting devices (`drone`).
- The Web PubSub broadcast for live updates in the app.
- The hourly rollup job for weekday trends.
