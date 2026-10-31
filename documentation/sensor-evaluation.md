# Sensor evaluation

BaselHack 2026 · how we pick what to deploy per stand.

The goal is to count bikes **without ever sending an image off the stand**. This
document is the live record of every sensor we try, how well it works, and why
we pick what we pick.

## The two solutions we deploy

Both run entirely on-device; only the integer count leaves the stand. Most
stands use one of the two; three stands currently combine them (see the table
below).

1. **LiDAR (preferred).** A 360° RPLidar C1 head on an AtomS3, mounted on the
   ceiling or a beam, splits the arc into one angular bay per slot and
   thresholds the nearest return. One device per stand, no image data by
   construction, and the signal is depth — so it works in rain, snow, fog,
   direct sun and darkness. This is the default choice whenever a mounting
   point exists. Firmware: [`code/firmware/thor`](../code/firmware/thor).
2. **On-device YOLO on ESP32-CAM.** Where no LiDAR mount is available. An
   AtomS3R-CAM-M12 runs the Espressif ESP-DL `coco_detect` YOLO11n model on
   every captured frame and POSTs the count of `bicycle` detections. The
   frame stays in RAM; only the integer leaves the device. Each stand uses
   **two cameras**, mounted **top-left** and **top-right** of the row and
   angled **≈ 30°** downward into the stand, so the two viewpoints
   cross-check and together cover the full line of bays. Firmware:
   [`code/firmware/mule`](../code/firmware/mule) and
   [`code/firmware/hydra`](../code/firmware/hydra).

## Uplink: Wi-Fi (tested) vs. LoRaWAN (recommended)

We tested both counting solutions with the firmware uplinking over **campus
Wi-Fi + HTTPS** — fast to iterate during the hackathon and no gateway
required. For production we **recommend LoRaWAN**:

- Campus Wi-Fi doesn't reach every stand we care about: open yards and
  outdoor racks have no AP in range, and basement garages are RF dead zones
  for 2.4 GHz.
- The payload is a single integer, well inside the LoRaWAN per-airtime
  budget even with regional duty cycles.
- A LoRaWAN node sleeps between uplinks and wakes to send a few bytes, so a
  stand can run on battery or a small solar panel with **no mains cabling** —
  the device goes anywhere a sensor view fits.

The backend contract stays the same: the LoRaWAN gateway relays the uplink
over HTTPS to `POST /api/v1/readings`, and the Function App can't tell the
two paths apart.

## What is deployed per stand

From the catalog in Cosmos DB (`code/backend/velo-stands-cosmos/stands.yaml`):

| Area | Kind | Stand | Slots | Devices |
| ---- | ---- | ----- | ----: | ------- |
| Flow Main | covered | `flow-main-1` | 40 | `ghost` LiDAR · `raven` YOLO camera |
| Sternenhof | covered | `sternenhof-1` | 30 | `medic` LiDAR · `reaper` YOLO camera |
| Flow Garage South | inside | `flow-garage-south-1` | 30 | `roach` LiDAR · `probe` YOLO camera |
| Flow South West | covered | `flow-sw-1` | 20 | `mule` + `hydra`, two YOLO cameras |
| Flow South East | covered | `flow-se-1` | 10 | `thor` LiDAR |
| Flow Garage North | covered | `flow-garage-north-1` | 20 | `ling` LiDAR |
| **6 areas** | | **6 stands** | **150** | **10 devices: 5 LiDAR, 5 YOLO cameras** |

- Flow Main, Sternenhof and Flow Garage South each pair one LiDAR with one
  camera. The backend adds the two counts, so the two devices must watch
  different bikes, or the stand is counted twice.
- Flow South West is the reference two-camera setup (`mule` + `hydra`).
- Flow South East and Flow Garage North use the preferred single LiDAR.
  `thor` on Flow South East is the only device with a `config:` block:
  10 slot bays, `freeMm` 600, range 100–1000 mm, report every 5 s.
- Slot counts are placeholders until Endress+Hauser confirms the real
  capacities.

The rest of this document is the record of candidates we evaluated before
settling on these two, so the choice stays defensible.

## What we score

For each candidate we record:

| Field                   | What it means                                                           |
| ----------------------- | ----------------------------------------------------------------------- |
| Hardware                | Exact part number, link, unit price                                     |
| Firmware spike          | Path to the sketch / module in `code/firmware/experiments/`             |
| Range                   | Reliable detection distance in our mounting                             |
| Field of view           | Horizontal × vertical in degrees, or scanning                           |
| Accuracy (bench)        | Mean error on a controlled test: real count vs. reported count          |
| Accuracy (on-site)      | Same, run at a real stand on the E+H campus                             |
| False positives         | Rate on non-bike targets (people walking by, pushchairs, rain, snow)    |
| Lighting dependence     | Does accuracy drop at night, in direct sun, in rain?                    |
| Power                   | Idle + active current, suitability for solar / battery / PoE            |
| Mounting                | Height, angle, enclosure needed                                         |
| Cost per stand          | Total BOM to cover one real stand (sensor + MCU + enclosure + power)    |
| Privacy                 | Does the raw signal reveal anything personal? (we only ship integers anyway) |
| Verdict                 | pass / fail / conditional, with the one-line reason                     |

Numbers go into the table **below**. Keep the sentence under each row short —
the detail lives in the firmware experiment folder.

## Candidates

Status legend: ⬜ not started · 🧪 testing · ✅ passed · ❌ ruled out

### ⬜ ToF array — ST VL53L5CX (8×8 zones)

- **Idea:** mount above each row of bays, one zone per slot. A bay with
  something tall in it is "occupied".
- **Expected strengths:** no image data by construction, cheap, low power,
  works at night, I²C.
- **Expected weaknesses:** 8×8 is coarse (needs several heads for a long rack),
  short range (≈4 m), rain / snow may trigger false hits.
- **Spike:** `code/firmware/experiments/tof-vl53l5cx/`
- **Status:** not started.

### ⬜ 1D LiDAR scan — RPLidar C1

- **Idea:** one 360° head per covered garage, mounted on the ceiling. Cluster
  returns into bike-shaped silhouettes.
- **Expected strengths:** covers a large area with one device, no imagery,
  great accuracy.
- **Expected weaknesses:** mechanical, cost, needs a clear sightline, parsing
  silhouettes is non-trivial.
- **Spike:** `code/firmware/experiments/rplidar-c1/`
- **Status:** not started.

### ⬜ mmWave radar — e.g. Seeed MR24HPC1 or XENSIV BGT60

- **Idea:** detect "presence of a bike-sized object" per bay.
- **Expected strengths:** sees through plastic enclosures, immune to light and
  weather, cheap, no imagery.
- **Expected weaknesses:** tuned for human presence by default; may struggle
  to distinguish a parked bike from background clutter.
- **Spike:** `code/firmware/experiments/mmwave/`
- **Status:** not started.

### ⬜ Ultrasonic array — HC-SR04 / grid of them

- **Idea:** cheap distance-per-bay fallback for covered stands.
- **Expected strengths:** trivially cheap, no imagery.
- **Expected weaknesses:** narrow beam, slow, cross-talk between heads,
  weather sensitive.
- **Spike:** `code/firmware/experiments/ultrasonic/`
- **Status:** not started.

### 🧪 On-device CV — ESP32-S3 with Edge Impulse YOLO ("mule")

- **Idea:** use the provided ESP32 cameras but **do inference on the board**.
  The image stays in RAM; only the integer count leaves.
- **Expected strengths:** reuses provided hardware, keeps the "no image
  uploads" promise, scales to open racks a ToF can't cover.
- **Expected weaknesses:** ESP32-S3 inference is tight; model accuracy on
  bikes from oblique angles unproven.
- **Hardware:** AtomS3R-CAM-M12 (OV3660 on ESP32-S3 with 8 MB OPI PSRAM).
- **Firmware:** [`code/firmware/mule`](../code/firmware/mule) — captures a VGA
  JPEG, decodes to RGB888, center-crops to the model's input, runs an
  Edge Impulse YOLOv5-for-CPU detector, and POSTs the count of `bicycle`
  bounding boxes to `/api/v1/readings`. The model is dropped in as an
  Edge Impulse Arduino library (see the firmware README).
- **Status:** firmware prepared, waiting on the first trained model.

### ⬜ Magnetic / inductive loop per bay

- **Idea:** one loop or hall sensor at each bay rail, triggered by a locked
  bike frame.
- **Expected strengths:** zero false positives from people walking past, no
  imagery.
- **Expected weaknesses:** requires physical install at every bay — not
  realistic to retrofit at campus scale in a hackathon.
- **Status:** likely out of scope; recorded for completeness.

## Results

Fill one row per candidate as experiments complete. Keep numbers; link to the
spike for the method.

| Candidate         | Bench acc. | On-site acc. | False+ | Cost/stand | Power | Verdict |
| ----------------- | ---------- | ------------ | ------ | ---------- | ----- | ------- |
| VL53L5CX ToF      | —          | —            | —      | —          | —     | ⬜      |
| RPLidar C1        | —          | —            | —      | —          | —     | ⬜      |
| mmWave            | —          | —            | —      | —          | —     | ⬜      |
| Ultrasonic grid   | —          | —            | —      | —          | —     | ⬜      |
| ESP32-S3 on-device CV | —      | —            | —      | —          | —     | ⬜      |

## Decision rule

Per stand:

1. If a ceiling or beam mount can see the whole row, deploy **LiDAR**. One
   device per stand.
2. Otherwise deploy **two YOLO cameras**, top-left and top-right at ≈ 30°
   downward into the stand.
3. Record the choice and the measured numbers in
   `code/backend/velo-stands-cosmos/stands.yaml` as a comment next to the
   device.

The bar is set deliberately low for the demo (a single wrong count in a
60-second cycle self-corrects on the next read), but we record the real number
so we can argue the privacy trade-off honestly in the pitch.
