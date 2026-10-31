# Firmware — how devices talk to the backend

Every sketch in this directory is a Slot Invaders bike-counting device. They all join Wi-Fi over 2.4 GHz, authenticate the same way, and POST to the same Azure Functions base URL. The authoritative API spec lives in [`documentation/architecture.md`](../../documentation/architecture.md); this README is the firmware-side cheat sheet: what every device needs to agree on, how to flash credentials, and which endpoints each sketch uses.

## Devices in this folder

| Dir | Hardware | What it sends | Mode |
|---|---|---|---|
| [`hydra/`](hydra) | AtomS3R-CAM-M12 (ESP32-S3 + OV3660) | Raw JPEG → debug viewer | debug only |
| [`thor/`](thor) | AtomS3 + RPLIDAR C1 | Integer count + SVG preview | `device` (plan A) |
| [`mule/`](mule) | AtomS3R-CAM-M12 (ESP32-S3 + OV3660) | Integer count (YOLO on-device) | `device` (plan A) |

Each folder has its own README with the wiring, boot log and tuning knobs.

## Backend base URL

Hardcoded in every sketch as `API_BASE`:

```c
static constexpr char API_BASE[] =
    "https://func-velostands-37sp3n5axfjna.azurewebsites.net";
```

If the Function App moves, grep for `API_BASE` across the folder and swap all three. TLS uses `WiFiClientSecure::setInsecure()` — hackathon-grade; for production, pin the Azure root CA or load an ESP certificate bundle.

## Credentials: Wi-Fi + device key

Each sketch reads credentials from a git-ignored `secrets.h` sitting next to the `.ino`. Copy the template and fill in:

```sh
cp secrets.example.h secrets.h
```

```c
#define WIFI_SSID     "your-ssid"           // 2.4 GHz — ESP32-S3 can't see 5 GHz
#define WIFI_PASSWORD "your-password"
#define DEVICE_API_KEY "..."                // 32 random bytes, base64url, from device-keys.secret.yaml
```

### Generating a device key

Device keys live in [`code/backend/device-keys.secret.yaml`](../backend/device-keys.sample.yaml) (git-ignored). Only the SHA-256 digest ever reaches the repo, stored under `devices[].keyHash` in [`code/common/config/stands.yaml`](../common/config/stands.yaml). To mint a new key for device `mule`:

```sh
# One random 256-bit key, base64url
node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))'
# → vs_3q9ZwfQ…  ← paste into secrets.h and device-keys.secret.yaml

# The matching keyHash for stands.yaml
node -e 'console.log("sha256:" + require("crypto").createHash("sha256").update(process.argv[1]).digest("hex"))' <paste-key>
# → sha256:9f2c…e41a
```

Or use the helper in the backend: `node code/backend/scripts/new-device-key.js [<secret>]`.

Rotating a key means re-flashing the one device with its new `secrets.h` and updating the `keyHash` in `stands.yaml`. The backend compares digests in constant time; there is no device-id field in request bodies — the key identifies the device, and everything else (stand, mode, thresholds) is looked up server-side.

## Endpoints

All device requests carry `X-Api-Key: <DEVICE_API_KEY>`. There is no other authentication, no sessions, no OAuth.

### `GET /api/v1/device/config`  — optional per-device runtime config

```http
GET /api/v1/device/config
X-Api-Key: vs_3q9Z…
```

```json
200
{
  "device": "thor",
  "stand": "kaegen-hof-1",
  "slots": 40,
  "reportIntervalSeconds": 60,
  "config": { "slots": 8, "occupiedMm": 650, "freeMm": 850, "stableLatch": 3, ... }
}
```

Devices fetch this once on boot and apply the keys they recognise; missing keys keep the firmware's defaults. `thor` uses it to pull thresholds and slot count without reflashing. `hydra` and `mule` ignore it.

### `POST /api/v1/readings`  — plan A count (JSON)

```http
POST /api/v1/readings
X-Api-Key: vs_3q9Z…
Content-Type: application/json

{ "occupied": 9, "seq": 1842, "measuredAt": "2026-10-31T07:42:10Z", "fw": "0.3.1", "rssi": -61 }
```

```json
202 { "device": "thor", "nextInSeconds": 60 }
```

The only required fields are `occupied` and `seq`. `fw`, `rssi` and `measuredAt` are optional diagnostics. **No field may carry an image**; unknown fields are rejected (422).

`seq` is a device-local monotonic counter that lets the server drop duplicate and out-of-order retries. Each device should report at least every 60 s — that doubles as its heartbeat.

### `POST /api/v1/images`  — plan B cropped JPEG (fallback)

```http
POST /api/v1/images
X-Api-Key: vs_8kLm…
Content-Type: image/jpeg
X-Seq: 1843
X-Device-Count: 9

<JPEG cropped to the stand, ≤ 640 px long side, ≤ 1 MB>
```

Only cloud-mode devices use this. None of the sketches in this folder are cloud-mode today — the drone device slot in `stands.yaml` is reserved for an ESP32-CAM fallback build.

### `POST /api/v1/debug/images`  — debug upload (not a count)

```http
POST /api/v1/debug/images
X-Api-Key: vs_3q9Z…
Content-Type: image/jpeg          # or image/svg+xml
X-Seq: 26

<JPEG or SVG bytes>
```

Keeps the latest frame per device in backend memory (not Cosmos). Served back by `GET /api/v1/debug/devices/<id>/image` for the debug app at `code/debug`. `hydra` uses this as its only output; `thor` uses it alongside readings to render its live slot strip.

## Errors

| Status | When |
|---|---|
| 401 | `X-Api-Key` missing or unknown |
| 409 | Mode mismatch (count from a cloud-only device, image from a device-only device) |
| 413 / 415 | Image too large, or not JPEG / PNG / SVG |
| 422 | JSON invalid: negative count, count above the stand's slots, or unknown field |
| 429 | More than one request within 5 s from the same device |
| 502 | Cloud recognizer failed (plan B only). Device retries next cycle. |

## Flashing

Every sketch has a `start.sh` that compiles, uploads and opens the serial monitor. Pass a port, or let it use the default `/dev/cu.usbmodem1101`:

```sh
cd hydra && ./start.sh                       # default port
cd thor  && ./start.sh /dev/cu.usbmodem101   # explicit port
cd mule  && ./start.sh                       # ESP-IDF build, see below
```

`hydra` and `thor` use `arduino-cli` with the ESP32 core (`esp32:esp32:esp32s3` for the AtomS3R-CAM-M12, `esp32:esp32:m5stack_atoms3` for the plain AtomS3). `mule` uses **ESP-IDF 5.3+** — source `$IDF_PATH/export.sh` first so `idf.py` is on PATH; see [`mule/README.md`](mule/README.md) for the full toolchain notes.

## When something looks wrong

- `wifi status=6` repeatedly → wrong password.
- SSID not showing `*` in the boot scan → wrong SSID or 5 GHz-only AP.
- `HTTP 401` on every request → `DEVICE_API_KEY` in `secrets.h` doesn't match any device in `device-keys.secret.yaml`, or `stands.yaml`'s `keyHash` wasn't updated after the last key rotation.
- `HTTP 404` on `/api/v1/debug/images` → that route isn't deployed; redeploy the Function App from `code/backend/velo-stands-functions`.
- `HTTP 422` on a reading → check that `occupied` ≤ the stand's slot count and no extra JSON fields are being serialised.
- Cold GET of a debug image right after a POST misses → the in-memory store is per Function App instance; harmless at hackathon traffic.
