import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AreaPatch, Road } from './campus-data';

/** Flat ground polygons for parking aprons and woodland patches. */
export function flatPolygons(areas: AreaPatch[], y: number): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  for (const a of areas) {
    if (a.ring.length < 3) continue;
    const shape = new THREE.Shape();
    a.ring.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)));
    shape.closePath();
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    parts.push(g);
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  merged?.computeVertexNormals();
  return merged;
}

/** Roads as flat ribbons along their centrelines, laid onto the pavement. */
export function roadRibbons(roads: Road[], y: number): THREE.BufferGeometry | null {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];

  for (const r of roads) {
    const hw = r.w / 2;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, y1] = r.pts[i];
      const [x2, y2] = r.pts[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) continue;
      const px = (-dy / len) * hw;
      const py = (dx / len) * hw;
      // nudge the ends slightly so segments overlap at joints
      const ex = (dx / len) * hw * 0.55;
      const ey = (dy / len) * hw * 0.55;

      const quad: [number, number][] = [
        [x1 + px - ex, y1 + py - ey],
        [x1 - px - ex, y1 - py - ey],
        [x2 - px + ex, y2 - py + ey],
        [x2 + px + ex, y2 + py + ey],
      ];
      for (const tri of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        for (const idx of tri) {
          pos.push(quad[idx][0], y, -quad[idx][1]);
          nor.push(0, 1, 0);
          uv.push(0, 0);
        }
      }
    }
  }

  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Clip a road network to a disc; keeps contiguous runs so segments don't rejoin across gaps. */
export function clipRoadsToDisc(roads: Road[], cx: number, cz: number, r: number): Road[] {
  const out: Road[] = [];
  for (const road of roads) {
    const inside = road.pts.map(([x, y]) => Math.hypot(x - cx, -y - cz) <= r);
    if (!inside.some(Boolean)) continue;
    if (inside.every(Boolean)) {
      out.push(road);
      continue;
    }
    let run: [number, number][] = [];
    road.pts.forEach((p, i) => {
      if (inside[i]) {
        if (!run.length && i > 0) run.push(road.pts[i - 1]);
        run.push(p);
      } else if (run.length) {
        run.push(p);
        if (run.length >= 2) out.push({ ...road, pts: run });
        run = [];
      }
    });
    if (run.length >= 2) out.push({ ...road, pts: run });
  }
  return out;
}
