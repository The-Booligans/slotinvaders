# Sensor evaluation

BaselHack 2026 · how we pick what to deploy per stand.

The goal is to count bikes **without ever sending an image off the stand**. This
document is the live record of every sensor we try, how well it works, and why
we pick what we pick.

Cloud image recognition (plan B) is only used for stands where none of these
sensors proves out in time.

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

### 🧪 2D LiDAR scan — RPLidar C1

- **Idea:** one head above a rack row, scan plane turned vertical and running
  along the row. Each rotation is a height profile of the row; free places are
  the gaps wide enough for a bike. Counts bikes whether or not they are in a
  holder, plus folded e-scooters and motor scooters.
- **Expected strengths:** one device per row segment (≈ 3 m at 2.3 m height),
  no imagery, works in the dark, no training data needed.
- **Expected weaknesses:** mechanical; only sees what crosses the scan plane;
  people hide what is behind them (handled: hidden sections keep their last
  state, a person waiting on a free spot marks it "being taken").
- **Spike:** `code/firmware/experiments/rplidar-c1/` — gap logic, simulation
  and tests; reports `occupied = capacity − free`.
- **Status:** works on a simulated rush hour; not yet tested on hardware.

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

### ⬜ On-device CV — ESP32-S3 with ESP-DL / EdgeImpulse

- **Idea:** use the provided ESP32 cameras but **do inference on the board**.
  The image stays in RAM; only the integer count leaves.
- **Expected strengths:** reuses provided hardware, keeps the "no image
  uploads" promise, scales to open racks a ToF can't cover.
- **Expected weaknesses:** ESP32-S3 inference is tight; model accuracy on
  bikes from oblique angles unproven.
- **Spike:** `code/firmware/experiments/esp32-s3-cv/`
- **Status:** not started.

### ⬜ Magnetic / inductive loop per bay

- **Idea:** one loop or hall sensor at each bay rail, triggered by a locked
  bike frame.
- **Expected strengths:** zero false positives from people walking past, no
  imagery.
- **Expected weaknesses:** requires physical install at every bay — not
  realistic to retrofit at campus scale in a hackathon.
- **Status:** likely out of scope; recorded for completeness.

### Plan B — Cloud image recognition (Azure AI Vision)

- **Idea:** fallback only. ESP32-CAM sends a cropped JPEG to `POST /v1/images`,
  the Function calls Azure AI Vision, counts `bicycle` boxes, drops the image.
- **Why last:** the image leaves the device, even if transiently. Everything
  above tries to avoid that.
- **Status:** code path exists in [`architecture.md`](architecture.md); engaged
  per-stand via `mode: cloud` in `config/stands.yaml`.

## Results

Fill one row per candidate as experiments complete. Keep numbers; link to the
spike for the method.

| Candidate         | Bench acc. | On-site acc. | False+ | Cost/stand | Power | Verdict |
| ----------------- | ---------- | ------------ | ------ | ---------- | ----- | ------- |
| VL53L5CX ToF      | —          | —            | —      | —          | —     | ⬜      |
| RPLidar C1        | —          | —            | —      | —          | —     | 🧪      |
| mmWave            | —          | —            | —      | —          | —     | ⬜      |
| Ultrasonic grid   | —          | —            | —      | —          | —     | ⬜      |
| ESP32-S3 on-device CV | —      | —            | —      | —          | —     | ⬜      |
| Azure AI Vision (plan B) | — | —            | —      | n/a        | n/a   | ⬜      |

## Decision rule

Per stand, in order:

1. Pick the cheapest **plan A** candidate whose on-site accuracy clears the
   bar for that stand's size and layout.
2. If none clears the bar before the demo, mark the stand `mode: cloud` and
   deploy an ESP32-CAM as the plan-B fallback.
3. Record the choice and the measured numbers in `config/stands.yaml` as a
   comment next to the device.

The bar is set deliberately low for the demo (a single wrong count in a
60-second cycle self-corrects on the next read), but we record the real number
so we can argue the privacy trade-off honestly in the pitch.
