# hydra — camera debug uploader

M5Stack **AtomS3R-CAM-M12** (ESP32-S3 + OV3660) that posts a JPEG to the backend every 10 s so the debug app at `code/debug` can show the live view.

```
camera ──► capture JPEG (800×600, ~18 KB)
            │
            ▼
     POST ${API_BASE}/api/v1/debug/images
            X-Api-Key: <device key>
            X-Seq: <frame id>
            Content-Type: image/jpeg
```

The backend keeps only the **latest** frame per device in memory and serves it as `GET /api/v1/debug/devices/hydra/image`. Nothing is written to Cosmos.

## Files

| File | |
|---|---|
| `hydra.ino` | The sketch |
| `secrets.example.h` | Template for Wi-Fi + device key — copy to `secrets.h` |
| `secrets.h` | Local credentials (git-ignored) |
| `start.sh` | Compile + upload + open serial monitor |

## Build and flash

```sh
./start.sh                      # uses /dev/cu.usbmodem1101 by default
./start.sh /dev/cu.usbmodemXXXX # or pass a port explicitly
```

Requires `arduino-cli` and the ESP32 core (board FQBN `esp32:esp32:esp32s3`).

## Connecting to Wi-Fi

Edit `secrets.h`:

```c
#define WIFI_SSID     "your-ssid"
#define WIFI_PASSWORD "your-password"
```

**ESP32-S3 is 2.4 GHz-only.** If your router mixes 2.4 and 5 GHz under one SSID, you may need to use the explicit 2.4 GHz name (e.g. `internet_2.4GHz`). On boot the sketch scans and marks the target with a `*`:

```
[hydra] scanning 2.4 GHz networks
[hydra]   * internet_2.4GHz   ch11   -51 dBm  secured
[hydra] target SSID "internet_2.4GHz" FOUND on 2.4 GHz
[hydra] joining internet_2.4GHz.............
[hydra] ip 192.168.1.28  rssi -43 dBm
```

If the target shows `NOT FOUND`, you have the wrong SSID or you are near a 5 GHz-only AP. The sketch reboots itself after 30 s of failed join attempts, so just fix `secrets.h` and reflash.

## Connecting to the Azure endpoint

The base URL is **hardcoded** in `hydra.ino` as `API_BASE`:

```c
static constexpr char API_BASE[] =
    "https://func-velostands-37sp3n5axfjna.azurewebsites.net";
```

The device key comes from `secrets.h`:

```c
#define DEVICE_API_KEY "..."     // from code/backend/device-keys.secret.yaml, keys.hydra
```

Each upload is:

- `POST ${API_BASE}/api/v1/debug/images`
- `X-Api-Key: ${DEVICE_API_KEY}`
- `X-Seq: <monotonic frame id>`
- `Content-Type: image/jpeg`
- body: raw JPEG bytes

A successful upload prints:

```
[hydra] upload #26  18196 B  HTTP 202  1249 ms  {"device":"hydra","seq":26,"receivedAt":"...","bytes":18196}
```

TLS uses `WiFiClientSecure::setInsecure()` — fine for the hackathon, not for production. The backend route itself must exist on the Function App; it's added by `src/functions/debug-images.js` in `code/backend/velo-stands-functions`, so a backend without that deployed will return `HTTP 404`.

## Debugging

### Serial monitor

```sh
arduino-cli monitor -p /dev/cu.usbmodem1101 -c baudrate=115200
```

Normal boot log:

```
[hydra] boot (debug uploader)
[hydra] camera ok
[hydra] scanning 2.4 GHz networks
[hydra]   * internet_2.4GHz   ch11   -51 dBm  secured
[hydra] target SSID "internet_2.4GHz" FOUND on 2.4 GHz
[hydra] joining internet_2.4GHz....
[hydra] ip 192.168.1.28  rssi -43 dBm
[hydra] uploading to https://func-velostands-37sp3n5axfjna.azurewebsites.net/api/v1/debug/images every 10 s
[hydra] upload #1  17083 B  HTTP 202  1711 ms  {...}
```

### Verify the backend sees it

```sh
# Snapshot — hydra.lastImage.url should be non-null and stale:false
curl -s https://func-velostands-37sp3n5axfjna.azurewebsites.net/api/v1/debug/devices \
  | jq '.devices[] | select(.device.id=="hydra")'

# Pull the latest frame directly
curl -s https://func-velostands-37sp3n5axfjna.azurewebsites.net/api/v1/debug/devices/hydra/image \
  -o hydra.jpg && file hydra.jpg
```

### Debug app

Point `NEXT_PUBLIC_API_URL` to the Function App and open `code/debug`. The `hydra` card refreshes every 5 s.

### Common failure modes

| Symptom in serial | Likely cause | Fix |
|---|---|---|
| `[hydra] esp_camera_init: 0x106` with `probe device timeout` on I²C | Camera power rail is off | `POWER_GPIO_NUM = 18` must be driven **LOW** before `esp_camera_init` — already handled in setup; if it still fails, reseat the M12 module and power-cycle USB |
| `target SSID "..." NOT FOUND on 2.4 GHz` | SSID is wrong or 5 GHz-only | Use the exact 2.4 GHz SSID in `secrets.h` |
| `[hydra] wifi status=6` then reboot | Wrong password (status 6 = `WL_DISCONNECTED` after failed auth) | Fix `WIFI_PASSWORD` |
| `HTTP 404` on upload | Backend doesn't have the `/api/v1/debug/images` route deployed | `func azure functionapp publish func-velostands-37sp3n5axfjna --javascript` from `code/backend/velo-stands-functions` |
| `HTTP 401` on upload | Wrong `DEVICE_API_KEY` | Copy the `hydra` entry from `code/backend/device-keys.secret.yaml` |
| `HTTP 415` on upload | Content-Type isn't `image/jpeg` | Shouldn't happen — the sketch always sends JPEG |
| `HTTP 413` on upload | Frame too large (> 2 MiB) | Lower `FRAMESIZE_*` or raise the backend `DEBUG_IMAGE_MAX_BYTES` |

### Notes

- The in-memory image store on the backend is **per Function App instance**. On Consumption with multiple instances, a cold GET right after a POST may miss. Not an issue at hackathon traffic levels.
- Only the latest frame per device is kept — history is not persisted.
- Capture interval is `CAPTURE_EVERY_MS = 10000` at the top of `hydra.ino`.
