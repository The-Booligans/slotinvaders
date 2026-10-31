# mule — on-device YOLO bike counter

M5Stack **AtomS3R-CAM-M12** (ESP32-S3 + OV3660) that counts bikes **on the device** with a YOLO-derived object detection model, and POSTs only the integer count to the backend.

```
camera ──► capture JPEG (VGA)
            │
            ▼
         decode + center-crop + resize to model input
            │
            ▼
         YOLO inference (Edge Impulse Arduino SDK)
            │  ↓ bounding boxes labelled "bicycle"
            ▼
         count detections with confidence ≥ MIN_CONFIDENCE
            │
            ▼
     POST ${API_BASE}/api/v1/readings
            X-Api-Key: <device key>
            { "occupied": N, "seq": …, "fw": …, "rssi": … }
```

This is a **plan A** device per [`documentation/architecture.md`](../../../documentation/architecture.md): the frame never leaves the stand. Only the count is sent.

## Files

| File | |
|---|---|
| `mule.ino` | The sketch |
| `secrets.example.h` | Template for Wi-Fi + device key — copy to `secrets.h` |
| `secrets.h` | Local credentials (git-ignored) |
| `start.sh` | Compile + upload + open serial monitor. Pass `--compile-only` to skip the upload (useful when another device is on the USB port). |

## Install the YOLO model

The sketch includes `<slotinvaders-bike-yolo_inferencing.h>`, which is produced by [Edge Impulse Studio](https://studio.edgeimpulse.com) when you export your trained impulse as an **Arduino library**. The sketch **does not compile** until that library is installed.

Two paths to get there:

### A. Train with Edge Impulse Studio (recommended)

1. Create a project in Edge Impulse Studio called `slotinvaders-bike-yolo`.
2. Add images of parked bikes at your target stand (your own photos + public bike datasets work well). Label the bounding boxes `bicycle`.
3. In **Impulse design**, pick:
   - Processing block: *Image (RGB)*
   - Learning block: *Object Detection (YOLOv5 for CPU)* — or FOMO if you need < 100 kB of RAM and don't mind lower accuracy
4. Train, then under **Deployment** pick **Arduino library** and download the `.zip`.
5. In the Arduino IDE: **Sketch → Include Library → Add .ZIP Library…** and pick the downloaded file. The CLI equivalent is:
   ```sh
   arduino-cli lib install --zip-path ~/Downloads/slotinvaders-bike-yolo.zip
   ```
6. Re-run `./start.sh --compile-only` to confirm it links.

### B. Use a different model name

If you already have an Edge Impulse export under a different project name (say `my-bikes`), either rename the project in Studio and re-export, or edit the include in `mule.ino`:

```c
#include <my-bikes_inferencing.h>
```

The sketch assumes the model has:
- `EI_CLASSIFIER_INPUT_WIDTH` and `EI_CLASSIFIER_INPUT_HEIGHT` set (any square size works, 96×96 and 160×160 are typical).
- At least one label called `bicycle` on its detector head.
- `bounding_boxes` populated (an object-detection head, not plain classification).

Any Edge Impulse YOLOv5-for-CPU or FOMO export fits that shape.

## Build and flash

```sh
./start.sh                      # compile + upload + monitor
./start.sh --compile-only       # compile only — use while another device is on USB
./start.sh /dev/cu.usbmodemXXXX # explicit port
```

Requires `arduino-cli` and the ESP32 core (board FQBN `esp32:esp32:esp32s3`).

If you only have the firmware prepared and someone else is on the port, `--compile-only` is the right move — it exits as soon as it links, and you can upload later with the same command and no `--compile-only`.

## Connecting to Wi-Fi

Same deal as hydra: edit `secrets.h`.

```c
#define WIFI_SSID     "your-ssid"
#define WIFI_PASSWORD "your-password"
```

ESP32-S3 is 2.4 GHz-only. The sketch scans on boot and marks the target with a `*`; if it says `NOT FOUND` the SSID is wrong or you're near a 5 GHz-only AP.

## Connecting to the Azure endpoint

The base URL is **hardcoded** in `mule.ino` as `API_BASE`:

```c
static constexpr char API_BASE[] =
    "https://func-velostands-37sp3n5axfjna.azurewebsites.net";
```

The device key comes from `secrets.h`:

```c
#define DEVICE_API_KEY "..."     // from code/backend/device-keys.secret.yaml, keys.mule
```

Each reading is:

- `POST ${API_BASE}/api/v1/readings`
- `X-Api-Key: ${DEVICE_API_KEY}`
- `Content-Type: application/json`
- body: `{ "occupied": N, "seq": …, "fw": …, "rssi": … }`

A successful cycle prints:

```
[mule] inferred bikes=3  (dsp=37 ms, cls=1480 ms, anom=0 ms)
[mule] report seq=1 occupied=3  HTTP 202  512 ms  {"device":"mule","nextInSeconds":60}
```

TLS uses `WiFiClientSecure::setInsecure()` — fine for the hackathon, not for production.

## Tuning

| Constant | Default | What it does |
|---|---|---|
| `REPORT_INTERVAL_MS` | 10 000 | How often to capture + infer + report. Longer → cooler chip, longer battery. |
| `MIN_CONFIDENCE` | 0.55 | Drop detections below this value. Raise it if the model false-positives on pushchairs/motorbikes; lower if it misses dark bikes. |
| `FRAMESIZE_*` in `initCamera()` | `FRAMESIZE_VGA` | 640×480 is enough for the model's small input and keeps JPEG decode fast. SVGA/UXGA burn PSRAM and inference time. |

## Debugging

### Serial monitor

```sh
arduino-cli monitor -p /dev/cu.usbmodem1101 -c baudrate=115200
```

Normal boot log:

```
[mule] boot (on-device YOLO, model=slotinvaders-bike-yolo 160x160)
[mule] camera ok
[mule] scanning 2.4 GHz networks
[mule]   * internet_2.4GHz   ch11   -51 dBm  secured
[mule] joining internet_2.4GHz....
[mule] ip 192.168.1.33  rssi -47 dBm
[mule] posting counts to .../api/v1/readings every 10 s
[mule] inferred bikes=2  (dsp=35 ms, cls=1420 ms, anom=0 ms)
[mule] report seq=1 occupied=2  HTTP 202  493 ms  {...}
```

### Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `fatal error: slotinvaders-bike-yolo_inferencing.h: No such file or directory` | Edge Impulse library not installed | Install the exported `.zip` — see **Install the YOLO model** above |
| `[mule] ps_malloc(…) for model input failed` | PSRAM not enabled in the FQBN | The `start.sh` FQBN sets `PSRAM=opi` — don't flash with the plain `esp32s3` config |
| `[mule] run_classifier failed: -1` right after boot | Model expects a different input shape than the sketch feeds | Confirm the Edge Impulse model is RGB and the sketch's crop/resize matches `EI_CLASSIFIER_INPUT_{W,H}` (it should — the sketch reads those macros directly) |
| `HTTP 401` on report | Wrong `DEVICE_API_KEY` | Copy the `mule` entry from `code/backend/device-keys.secret.yaml` |
| `inferred bikes=0` on a stand full of bikes | Mounting angle too oblique, or model under-trained for this stand | Add 20–50 more labelled frames from this exact camera angle, retrain, re-export |

### Notes

- The in-memory JPEG is freed as soon as it has been decoded; only the RGB input buffer (~75 kB at 160×160) and the backbone's intermediate activations stay allocated.
- Inference latency on the AtomS3R at 160×160 is roughly 1.5 s with YOLOv5-for-CPU, or ~250 ms with FOMO. Both easily fit the 10 s reporting cycle.
- No image or feature is ever written to flash, uploaded or logged in full — only the detection count and the per-stage timings reach the serial log.
