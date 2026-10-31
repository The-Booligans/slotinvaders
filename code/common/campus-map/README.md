# `@slotinvaders/campus-map`

A WebGL view of the Endress+Hauser Reinach campus, rendered as a floating
hex island — saturated colours, a checker lawn, and the E+H roofs in berry.
One component, one look, no style switcher.

## Install into a consuming app

The package has no `node_modules` of its own; it exports source files that are
compiled by the consumer's bundler. The consumer must install the peer deps and
map the import.

```jsonc
// package.json
{
  "dependencies": {
    "@react-three/drei": "^10.7.0",
    "@react-three/fiber": "^9.8.0",
    "three": "^0.186.0",
    "three-stdlib": "^2.36.0"
  }
}
```

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@slotinvaders/campus-map": ["../common/campus-map/src/index.ts"]
    }
  }
}
```

Then copy `assets/campus.glb` to the consumer's static-asset directory (for
Next.js, `public/campus.glb`). The GLB is ~2.4 MB.

## Use

```tsx
'use client';
import { SlotInvadersCampusMap } from '@slotinvaders/campus-map';

export function MapPanel() {
  return <SlotInvadersCampusMap style={{ height: 420 }} />;
}
```

In Next.js, keep the import client-side only — `three` cannot be rendered on
the server. Either put `"use client"` at the top of the file that uses it, or
load it via `next/dynamic` with `ssr: false`.

### Props

| prop        | type                | default         | notes                                                 |
| ----------- | ------------------- | --------------- | ----------------------------------------------------- |
| `glbUrl`    | `string`            | `/campus.glb`   | URL the browser fetches the baked campus from         |
| `style`     | `React.CSSProperties` | —             | inline style for the wrapper; pass `height` to size   |
| `className` | `string`            | —               | class for the wrapper                                 |
| `markers`   | `CampusMarker[]`    | —               | pins over campus positions (`x` east, `y` north, m); `variant: 'user'` draws a "you are here" dot |
| `selectedMarkerId` | `string \| null` | —           | highlighted pin; the camera glides to it on change    |
| `onMarkerSelect` | `(id) => void` | —               | called when a pin is tapped                           |
| `recenterKey` | `number`          | —               | change it to glide back to the initial view           |

Pins are plain DOM over the canvas: `MarkerProjector` (inside the Canvas)
writes each pin's screen position every frame, so no React re-render per frame.

The stand positions are exported as `STANDS`. Import them from
`@slotinvaders/campus-map/data` to avoid pulling three.js into non-3D code
(e.g. tests).

## How it works

### The scene

- **Buildings** come from a baked GLB, one mesh per structure, placed in the
  real Swiss metre grid. On load, each mesh is walked once: faces pointing
  broadly up become roofs, everything else is a wall, so the roof berry pops
  without splitting the geometry.
- **Endress+Hauser recognition** compares each building's centre against three
  anchor points and the two property-zone rectangles stored in `campus.json`.
  Anything matching gets the brand blue walls / darker blue roofs; everything
  else gets cream walls with berry roofs.
- **The island** is a hex `cylinderGeometry(radius, radius*0.99, …, 6)` with a
  tapering soil band and a conical base — a floating slab you could pick up.
  The grass cap carries a canvas-generated checker texture.
- **Pavement, parking, woodland and roads** are flat polygons laid onto the
  island, each clipped to the hex so nothing hangs over the edge.
- **Trees** are placed procedurally with a seeded RNG along the main roads and
  scattered through the open areas, skipping any point too close to a road or
  inside a property zone.

### Camera and lighting

Perspective camera at `fov: 36`, framed to the campus extent plus padding, with
`OrbitControls` for drag-to-orbit and scroll-to-zoom. Polar angle is clamped so
you can't flip under the island.

Three lights: a hemisphere light for sky/ground tint, a strong directional sun
casting shadows (1024² shadow map — 2048² caused WebGL context loss on Pixel 10's
PowerVR GPU), and a soft rim light from the back in the brand blue. No post
processing — the saturation comes from the materials.

### Files

```
src/
├── SlotInvadersCampusMap.tsx  the public component (Canvas + Scene)
├── Scene.tsx                  lights, buildings, island, camera rig
├── Buildings.tsx              GLB loader, roof-vs-wall shading, E+H paint
├── Island.tsx                 hex ground, checker grass, roads, trees
├── Markers.tsx                DOM pins over the canvas + per-frame projector
├── geometry.ts                flat polygon + ribbon helpers; disc clipping
├── campus-data.ts             typed re-export of campus.json (incl. STANDS)
├── campus.json                roads, areas, property zones (~48 KB)
├── style.ts                   every colour and camera number
└── index.ts                   public exports
assets/
└── campus.glb                 baked building massing (~2.4 MB)
```

### Coordinates

Metres from the centre of the two Endress+Hauser property zones. `+x` is east,
`+y` is north in `campus.json`; in the three.js scene this maps to `(x, _, -y)`
so that `+z` points south (the three.js default). Everything in `style.ts` and
the GLB uses this frame.

## Changing how it looks

Every colour, light and camera direction lives in `src/style.ts`. The ground
texture is generated inline in `Island.tsx` from `STYLE.grass` /
`STYLE.grassAlt` — swap those two and the lawn changes.

The building colouring runs once in `Buildings.tsx` on mount. If you tweak
`STYLE.wall`/`STYLE.roof`/`STYLE.ehWall`/`STYLE.ehRoof` and want the change to
apply without a reload, add `[STYLE.wall, …]` to the `useLayoutEffect` deps.
