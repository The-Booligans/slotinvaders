<p align="center">
  <img src="assets/TheBooligans.png" alt="The Booligans" width="320" />
</p>

# Slot Invaders

[![CI](https://github.com/The-Booligans/slotinvaders/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/The-Booligans/slotinvaders/actions/workflows/ci.yml)

[![BaselHack 2026](https://img.shields.io/badge/BaselHack-2026-ff3b30?style=for-the-badge&logo=github&logoColor=white)](https://www.baselhack.ch/)
[![Challenge: Endress+Hauser](https://img.shields.io/badge/Challenge-Endress%2BHauser-005b82?style=for-the-badge)](https://www.endress.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)](license.txt)
[![Privacy by design](https://img.shields.io/badge/Privacy-by%20design-10b981?style=for-the-badge&logo=signal&logoColor=white)](#privacy-first--no-images-leave-the-stand)
[![No images uploaded](https://img.shields.io/badge/No%20images-leave%20the%20stand-0ea5e9?style=for-the-badge)](documentation/sensor-evaluation.md)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js 22](https://img.shields.io/badge/Node.js-22-5FA04E?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=flat&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000?style=flat&logo=shadcnui&logoColor=white)](https://ui.shadcn.com/)
[![three.js](https://img.shields.io/badge/three.js-000000?style=flat&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=flat&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)](https://vitest.dev/)

[![Azure Functions](https://img.shields.io/badge/Azure%20Functions-0062AD?style=flat&logo=azurefunctions&logoColor=white)](https://learn.microsoft.com/azure/azure-functions/)
[![Cosmos DB](https://img.shields.io/badge/Cosmos%20DB-0078D4?style=flat&logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/azure/cosmos-db/)
[![Web PubSub](https://img.shields.io/badge/Web%20PubSub-0078D4?style=flat&logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/azure/azure-web-pubsub/)
[![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=flat&logo=terraform&logoColor=white)](https://www.terraform.io/)

[![ESP32](https://img.shields.io/badge/ESP32-E7352C?style=flat&logo=espressif&logoColor=white)](https://www.espressif.com/en/products/socs/esp32)
[![LiDAR / ToF / mmWave](https://img.shields.io/badge/Sensors-ToF%20%C2%B7%20LiDAR%20%C2%B7%20mmWave-6366f1?style=flat)](documentation/sensor-evaluation.md)

**Find my Bike Slot** — a BaselHack 2026 entry for the Endress+Hauser challenge.

> How might we help employees quickly find an available bicycle parking slot at
> our company site?

Slot Invaders turns the six bike parking areas on the Endress+Hauser Reinach
campus into live counters. Sensors at each stand report how many bikes they
see; the app shows you where to park before you arrive.

## Live environments

| URL                                             | What it is                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| [slotinvaders.ch](https://slotinvaders.ch)      | Landing page                                                        |
| [app.slotinvaders.ch](https://app.slotinvaders.ch/) | The app                                                             |
| [debug.slotinvaders.ch](https://debug.slotinvaders.ch/) | Development environment to test and research devices and sensors |

## Privacy first — no images leave the stand

The challenge is explicit: **no faces, no license plates, no identifying or
tracking individuals.** We take that further.

We offer **two on-device solutions**. Both report only the integer; the image
or point cloud never leaves the stand.

- **LiDAR (preferred).** One 360° RPLidar C1 head per stand, mounted on the
  ceiling. Works day, night, rain, snow — the signal is depth, not light.
- **On-device YOLO on ESP32 cameras.** Where no LiDAR mounting is available.
  Each stand gets **two cameras**, top-left and top-right at ≈ 30° downward
  into the stand, both running YOLO11 locally. The frame stays in RAM; only
  the count is POSTed.

Details and numbers in
[`documentation/sensor-evaluation.md`](documentation/sensor-evaluation.md).

## The idea in one picture

```
 ┌─ Field ──────────────────────┐      ┌─ Azure ─────────────────┐      ┌─ Clients ──┐
 │ LiDAR  (1× per stand)        │─────▶│ Functions · Cosmos DB   │─────▶│ PWA        │
 │ or on-device YOLO (2× per    │      │ Web PubSub              │      │ iOS/Android│
 │   stand, 30° top-L + top-R)  │      │                         │      │ Landing    │
 │   ─────  integer only  ────▶ │      │                         │      │            │
 └──────────────────────────────┘      └─────────────────────────┘      └────────────┘
```

Devices `POST /v1/readings` with their count. Free slots = stand slots − sum
of device counts. Updates go out via WebSockets, so every open client refreshes
within about a second.

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

## Run the app

1. Open a terminal in `code/app` and install dependencies once:
   `pnpm install`
2. Run the web app locally:
   `pnpm run dev`
   Then open `http://localhost:3000`.
3. To run it on Android, build the static web app and sync it into the native
   project:
   `pnpm run build`
   `pnpm exec cap sync android`
4. Open `code/app/android` in Android Studio (or run `pnpm exec cap open android`
   from `code/app`).
5. Select an emulator or connected Android device, then click **Run**.

After changing app code, repeat steps 3–5 so Android gets the latest build.

## Stack

- **Front ends** — Next.js (static export) · Serwist (PWA) · Capacitor (iOS/Android) · shadcn/ui · Tailwind · three.js + R3F
- **Backend** — Azure Functions (Node 22, TypeScript) · Cosmos DB serverless · Web PubSub
- **Counting** — RPLidar C1 on an AtomS3 (default) · AtomS3R-CAM-M12 running ESP-DL YOLO11n on-device (two per stand, top-L + top-R at 30°)
- **Shared** — Zod schemas, TypeScript contracts, `computeViews` pure function
- **Tooling** — pnpm workspaces · Oxlint · Oxfmt · Vitest · Terraform

## Challenge

- **Event**: BaselHack 2026 · Fri 30 Oct – Sun 1 Nov 2026 · 48h
- **Challenge owner**: Endress+Hauser
- **Site**: Reinach campus — 2 property zones, 6 bike parking areas
- **Hardware provided**: 10× ESP32 cameras with boards (we use them for on-device CV)

Full brief in [`documentation/challenge-brief.md`](documentation/challenge-brief.md).
Hackathon rules and judging notes in
[`documentation/baselhack-rules.md`](documentation/baselhack-rules.md).

## Team

The Booligans:

- Dobrawa Kiefer
- Nila M.
- Artur Semenenko
- Luca Rullo
- Samuel Rink
- Valentino Rusconi
- David Übelacker

## License

MIT — see [`license.txt`](license.txt). All artifacts are published openly, in
line with the BaselHack rules.
