# Slot Invaders

**Find my Bike Slot** — a BaselHack 2026 entry for the Endress+Hauser challenge.

> How might we help employees quickly find an available bicycle parking slot at
> our company site?

Slot Invaders turns the six bike parking areas on the Endress+Hauser Reinach
campus into live counters. Sensors at each stand report how many bikes they
see; the app shows you where to park before you arrive.

## Privacy first — no images leave the stand

The challenge is explicit: **no faces, no license plates, no identifying or
tracking individuals.** We take that further.

**Plan A — counting without cameras.** Each stand uses non-image sensors (ToF
arrays, LiDAR, mmWave radar, ultrasonic) or does inference on-device. The
sensor stays local; only one integer — the number of bikes it currently sees —
reaches the backend. There is no image to lose, store or leak.

**Plan B — cloud image recognition.** Only if no sensor configuration proves
out for a given stand in time. In that case an ESP32-CAM uploads a cropped
JPEG, Azure AI Vision counts the bikes, and the image is dropped from memory
in the same call. The code path exists as a fallback, not as the target.

We test every sensor we can get our hands on and record the numbers in
[`documentation/sensor-evaluation.md`](documentation/sensor-evaluation.md).
The best result per stand wins; cloud recognition is only used where nothing
else clears the bar.

## The idea in one picture

```
 ┌─ Field ──────────────────────┐      ┌─ Azure ─────────────────┐      ┌─ Clients ──┐
 │ Plan A: ToF · LiDAR · mmWave │─────▶│ Functions · Cosmos DB   │─────▶│ PWA        │
 │         on-device CV         │      │ Web PubSub              │      │ iOS/Android│
 │   ─────  integer only  ────▶ │      │                         │      │ Landing    │
 │                              │      │                         │      └────────────┘
 │ Plan B (fallback): ESP32-CAM │ ···▶ │ AI Vision (drops image) │
 └──────────────────────────────┘      └─────────────────────────┘
```

Devices `POST /v1/readings` with their count. Fallback devices `POST /v1/images`.
Free slots = stand slots − sum of device counts. Updates go out via WebSockets,
so every open client refreshes within about a second.

See [`documentation/architecture.md`](documentation/architecture.md) for the
full picture, data model and API.

## Repository layout

Following the [BaselHack repo template](https://github.com/BaselHack/baselhack_repo_template):

| Folder          | Contents                                                        |
| --------------- | --------------------------------------------------------------- |
| `code/`         | all code — `app/`, `backend/`, `firmware/`, `webpage/`, `debug/`, `common/` |
| `documentation/`| architecture, sensor evaluation, challenge brief, hackathon rules |
| `assets/`       | pitch materials, videos, presentations                          |

Sensor spikes live under `code/firmware/experiments/<sensor>/` so results can
be reproduced.

## Stack

- **Front ends** — Next.js (static export) · Serwist (PWA) · Capacitor (iOS/Android) · shadcn/ui · Tailwind · three.js + R3F
- **Backend** — Azure Functions (Node 22, TypeScript) · Cosmos DB serverless · Web PubSub
- **Sensors (plan A)** — ST VL53L5CX ToF · RPLidar C1 · mmWave radar · ultrasonic arrays · on-device CV on ESP32-S3
- **Fallback (plan B)** — ESP32-CAM / ESP32-S3-CAM + Azure AI Vision Image Analysis
- **Shared** — Zod schemas, TypeScript contracts, `computeViews` pure function
- **Tooling** — pnpm workspaces · Oxlint · Oxfmt · Vitest · Bicep

## Challenge

- **Event**: BaselHack 2026 · Fri 30 Oct – Sun 1 Nov 2026 · 48h
- **Challenge owner**: Endress+Hauser
- **Site**: Reinach campus — 2 property zones, 6 bike parking areas
- **Hardware provided**: 10× ESP32 cameras with boards (we use them for on-device CV where possible, as the plan-B fallback otherwise)

Full brief in [`documentation/challenge-brief.md`](documentation/challenge-brief.md).
Hackathon rules and judging notes in
[`documentation/baselhack-rules.md`](documentation/baselhack-rules.md).

## Team

The Booligans:

- Dobrawa Kiefer
- Nila M.
- Artur Semenko
- Luca Rullo
- Samuel Rink
- Valentino Rusconi
- David Übelacker

## License

MIT — see [`license.txt`](license.txt). All artifacts are published openly, in
line with the BaselHack rules.
