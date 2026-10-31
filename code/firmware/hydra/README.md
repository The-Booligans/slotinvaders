# mule — on-device YOLO bike counter

M5Stack AtomS3R-CAM-M12 (ESP32-S3 + OV3660). Runs the Espressif ESP-DL
`coco_detect` YOLO11n model on every captured frame, counts the detections
whose COCO class is `bicycle`, and POSTs that integer to the backend as a
`/api/v1/readings` call. Also uploads the latest frame to
`/api/v1/debug/images` so the debug app has something to look at. The full
frame stays in RAM; only the count leaves the device.

Everything else — authentication, endpoints, error codes — matches
[`code/firmware/README.md`](../README.md).

## Build toolchain

Unlike `thor` and `hydra`, mule is **ESP-IDF**, not Arduino. ESP-DL isn't
packaged for the Arduino core, and the inference runs on the device.

Requirements:

- ESP-IDF **5.3+** on PATH (source `$IDF_PATH/export.sh` in the shell).
- The ESP32-S3 target toolchain (installed by `install.sh esp32s3`).
- A working USB serial connection to the AtomS3R-CAM-M12.

Build and flash:

```sh
cd code/firmware/mule
./start.sh                        # default port /dev/cu.usbmodem1101
./start.sh /dev/cu.usbmodem101    # explicit port
```

The first build downloads `espressif/coco_detect`, `espressif/esp-dl` and
`espressif/esp32-camera` into `managed_components/` (git-ignored).

## Credentials

Copy the template and fill in Wi-Fi + the device key for `mule`:

```sh
cp secrets.example.h secrets.h
```

```c
#define WIFI_SSID     "your-ssid"       // 2.4 GHz
#define WIFI_PASSWORD "your-password"
#define DEVICE_API_KEY "vs_…"           // from code/backend/device-keys.secret.yaml
```

The hash in [`code/backend/velo-stands-cosmos/stands.yaml`](../../backend/velo-stands-cosmos/stands.yaml)
under `devices` → `id: mule` must match the SHA-256 of the key you flash.

## Runtime knobs

Fetched once on boot (and after every report) from
`GET /api/v1/device/config`. Missing keys keep the compile-time default:

| Key                  | Default | Range          | What |
|----------------------|---------|----------------|------|
| `reportIntervalMs`   | 10000   | 1 000 … 600 000 | How often to POST a reading. The ingest endpoint rate-limits at 1 req / 5 s, so values below 5 000 will see 429s. |
| `minScore`           | 0.35    | 0.0 … 1.0       | Confidence threshold for a detection to count as a bike. |

Stand-level fields outside the `config:` block are honoured too:

| Key     | Default | What |
|---------|---------|------|
| `slots` | 40      | Caps the reported count so the backend never 422s a value above the stand's capacity. |

## What it does on boot

1. Wi-Fi STA join (30 s timeout, hard reboot on timeout).
2. `GET /api/v1/device/config` with `X-Api-Key` — apply what we recognise.
3. Power on the camera rail (GPIO18 low), init `esp-camera` at QVGA/RGB565.
4. Load `COCODetect::YOLO11N_S8_V1` (int8 quantised, lives in the `coco_det`
   SPIFFS partition — see [`partitions.csv`](partitions.csv)).

Then forever, for each frame:
- Run YOLO11 inference.
- Count detections with `category == 1 (bicycle)` and `score >= minScore`.
- Every `reportIntervalMs`: refresh config, POST the count, encode the frame
  as JPEG, upload it to `/api/v1/debug/images`.

A sample serial log:

```
I (3421) mule: ip 192.168.1.42
I (3620) mule: config: reportIntervalMs=10000 minScore=0.35 maxSlots=40
I (4210) mule: camera ok, loading YOLO11…
I (6002) mule: detector ready
I (7020) mule: bikes=3
I (8041) mule: bikes=3
I (18045) mule: report seq=1 occupied=3  HTTP 202  212 ms  {"device":"mule","nextInSeconds":10}
I (18260) mule: debug jpeg 9872 B  HTTP 202  195 ms
```

## When something looks wrong

- `camera init failed: 0x105` → `secrets.h` or wiring. The AtomS3R-CAM-M12
  needs GPIO18 pulled low before the sensor responds on I²C.
- `wifi join timed out — rebooting` → wrong SSID/password, or 5 GHz-only AP.
- `report failed: ESP_ERR_HTTP_CONNECT` → TLS failed. Confirm
  `CONFIG_MBEDTLS_CERTIFICATE_BUNDLE=y` is still on in `sdkconfig`.
- Repeated `HTTP 401` → the key in `secrets.h` doesn't match the hash in
  `stands.yaml`. Rotate using `node code/backend/scripts/new-device-key.js`
  and reflash.
- `HTTP 422` on readings → `maxSlots` isn't being clamped (did `config.slots`
  arrive?). The clamp in `countBicycles` keeps us below the stand's capacity.
- Detections drift wildly between frames → raise `minScore` from the backend
  config, or point the camera at the stand with less glare.
