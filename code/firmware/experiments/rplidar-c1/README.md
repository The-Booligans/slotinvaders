# RPLidar C1 — gap logic spike

Counts free places along one row of a bike rack from a single overhead
RPLidar C1. **Status: simulation only, not yet tested on hardware.**

## Mounting

The lidar hangs above the row (≈ 2.3 m) and is turned so that its scan plane
is **vertical and runs along the row**. One rotation is a height profile of
the row: handlebars, saddles, scooters, people. It never produces an image.

```
        lidar ──▶ scan plane (vertical, along the row)
   ┌──────●─────────────────────────────┐ roof
   │     ╱│╲                            │
   │    ╱ │ ╲      🚲   🛴     🛵       │
   └────────────────────────────────────┘ floor
   row_start_m ◀──── 0 ────▶ row_end_m
```

## How it works

Per rotation (`gap_logic.py`):

1. Polar → (x, z): position along the row, height above ground.
2. Split the row into 10 cm bins; per bin the top height, or "hidden".
3. Compare with the **empty-rack profile** from `calibrate()`. Anything 10 cm
   above it is occupied, so folded scooters count too.
4. **Tall (> 1.4 m) and recent = person.** Tall for 3 minutes = parked vehicle
   (e.g. a motor-scooter windshield).
5. Each bin remembers its state and changes it only after 60 s of the same
   reading. Bins under, next to or hidden behind a person keep their state —
   the confirmation clock pauses instead of restarting, so the count stays
   current at rush hour.
6. **Being taken:** a person standing on a free spot for 10 s, or a new object
   not yet confirmed, removes that place from the free count at once.
7. Every object reserves at least one bike width (0.55 m); free = bike widths
   that still fit into the gaps. Parking in the middle of a gap wastes space,
   and the count reflects that.

## Reporting to the backend

`POST /v1/readings` accepts one integer, `occupied`. The tracker returns
`occupied = capacity − free`, where `capacity` is how many bikes fit into the
watched part of the row. Places being taken count as occupied.

→ The slots this device covers in `code/common/config/stands.yaml` must match
its `capacity`, otherwise `slots − occupied` is wrong for the stand.

Showing "being taken" separately in the app would need a new field in the
readings schema; that is not done here.

## Run it

```bash
pip install numpy pytest
python simulation.py    # 7-minute simulated rush hour, printed as a table
python -m pytest        # tests
```

## Settings to measure on site (`Config`)

| Setting | Default | What it is |
| --- | --- | --- |
| `mount_height_m` | 2.3 | lidar centre above ground |
| `angle_offset_deg` | 0 | lidar angle that points straight down |
| `row_start_m`, `row_end_m` | −1.5, 1.5 | watched part of the row |
| `bike_width_m` | 0.55 | space per bike (smaller for high-low racks) |
| `occ_above_bg_m` | 0.10 | height above the empty profile that counts as occupied |
| `tall_m` | 1.40 | above this: person or tall vehicle |
| `stable_s`, `claim_s`, `static_tall_s` | 60, 10, 180 | confirmation, claim and parked-vehicle times |

## Known limits

- Only objects that cross the scan plane are seen.
- New vehicles show as "being taken" after ~10–20 s and are confirmed after
  ~1–2 min.
- A tall vehicle counts as a person for its first 3 minutes; a person standing
  still for longer than that counts as an object.
- Flat things just above the rack bar (a deck lying on the ground) are
  borderline.
- A gap of exactly two bike widths can flip between 1 and 2.
- Real scans add reflections and weak returns from matte black surfaces; all
  thresholds need tuning with real data.

## Next step

`run_lidar.py` for the Raspberry Pi: read rotations with `rplidarc1`
(C1-specific, 460800 baud; check the import name after installing), call
`calibrate()` on the empty rack, feed `RackTracker.update()`, and send
`occupied` every 60 s with the device's `X-Api-Key`.
