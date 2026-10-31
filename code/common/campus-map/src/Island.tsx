import { useMemo } from 'react';
import * as THREE from 'three';
import { AREAS, BOUNDS, CENTRE, ROADS, ZONES } from './campus-data';
import { STYLE } from './style';
import { clipRoadsToDisc, flatPolygons, roadRibbons } from './geometry';

/**
 * The ground layer: a floating hex island with grass checker, pavement cap,
 * roads, parking patches and scattered trees. Buildings sit on top of this.
 */

const RADIUS = STYLE.island.radius;

function makeChecker(a: string, b: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = a;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = b;
  g.fillRect(0, 0, 32, 32);
  g.fillRect(32, 32, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(70, 70);
  t.magFilter = THREE.NearestFilter;
  return t;
}

function Tree({ x, z, s }: { x: number; z: number; s: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 1.7, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.38, 3.4, 6]} />
        <meshStandardMaterial color={STYLE.treeTrunk} roughness={1} />
      </mesh>
      <mesh position={[0, 5.2, 0]} castShadow>
        <sphereGeometry args={[2.8, 9, 7]} />
        <meshStandardMaterial color={STYLE.treeTop} roughness={0.95} />
      </mesh>
      <mesh position={[1.3, 4.1, 0.7]} castShadow>
        <sphereGeometry args={[1.8, 8, 6]} />
        <meshStandardMaterial color={STYLE.treeTop} roughness={0.95} />
      </mesh>
    </group>
  );
}

export function Island() {
  const [cx, cz] = CENTRE;

  const checker = useMemo(() => makeChecker(STYLE.grass, STYLE.grassAlt), []);

  const roads = useMemo(() => clipRoadsToDisc(ROADS, cx, cz, RADIUS * 0.88), [cx, cz]);
  const major = useMemo(
    () => roadRibbons(roads.filter((r) => !r.minor), 0.6),
    [roads],
  );
  const minor = useMemo(
    () => roadRibbons(roads.filter((r) => r.minor), 0.45),
    [roads],
  );

  const onTile = (ring: [number, number][]) => {
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const ax = (Math.min(...xs) + Math.max(...xs)) / 2;
    const ay = (Math.min(...ys) + Math.max(...ys)) / 2;
    return Math.hypot(ax - cx, -ay - cz) < RADIUS * 0.8;
  };
  const parking = useMemo(
    () => flatPolygons(
      AREAS.filter((a) => a.kind === 'parking' && onTile(a.ring)),
      0.25,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const wood = useMemo(
    () => flatPolygons(
      AREAS.filter((a) => a.kind !== 'parking' && onTile(a.ring)),
      0.2,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const trees = useMemo(() => {
    let h = 20261030;
    const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
    const out: [number, number, number][] = [];
    const clear = (x: number, y: number) => {
      if (Math.hypot(x - cx, -y - cz) > RADIUS * 0.93) return false;
      if (ROADS.some((r) => r.pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < r.w / 2 + 4.5)))
        return false;
      return !ZONES.some((z) => {
        const [x0, y0, x1, y1] = z.box;
        return x > x0 - 20 && x < x1 + 20 && y > y0 - 20 && y < y1 + 20;
      });
    };

    for (const r of ROADS) {
      if (r.minor) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [x1, y1] = r.pts[i];
        const [x2, y2] = r.pts[i + 1];
        const len = Math.hypot(x2 - x1, y2 - y1);
        const n = Math.floor(len / 26);
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          const px = x1 + (x2 - x1) * t;
          const py = y1 + (y2 - y1) * t;
          const nx = -(y2 - y1) / len;
          const ny = (x2 - x1) / len;
          const side = rnd() > 0.5 ? 1 : -1;
          const off = r.w / 2 + 4 + rnd() * 3;
          const x = px + nx * off * side;
          const y = py + ny * off * side;
          if (!clear(x, y)) continue;
          out.push([x, -y, 0.8 + rnd() * 0.5]);
        }
      }
    }
    const pad = 70;
    for (let i = 0; i < 70; i++) {
      const x = BOUNDS.minx - pad + rnd() * (BOUNDS.maxx - BOUNDS.minx + pad * 2);
      const y = BOUNDS.miny - pad + rnd() * (BOUNDS.maxy - BOUNDS.miny + pad * 2);
      if (!clear(x, y)) continue;
      out.push([x, -y, 0.7 + rnd() * 0.7]);
    }
    return out;
  }, [cx, cz]);

  return (
    <>
      {/* hex island: grass cap, soil taper, pointed base — reads as a floating slab */}
      <group position={[cx, 0, cz]}>
        <mesh position={[0, -5, 0]} receiveShadow>
          <cylinderGeometry args={[RADIUS, RADIUS * 0.99, 10, 6]} />
          <meshStandardMaterial map={checker} roughness={1} />
        </mesh>
        <mesh position={[0, -46, 0]} castShadow>
          <cylinderGeometry args={[RADIUS * 0.99, RADIUS * 0.52, 72, 6]} />
          <meshStandardMaterial color={STYLE.island.side} roughness={1} flatShading />
        </mesh>
        <mesh position={[0, -108, 0]}>
          <coneGeometry args={[RADIUS * 0.52, 56, 6]} />
          <meshStandardMaterial color={STYLE.island.base} roughness={1} flatShading />
        </mesh>
      </group>

      {/* pavement cap over the built-up part so buildings don't sit on grass */}
      <mesh position={[cx, 0.01, cz]} receiveShadow>
        <cylinderGeometry args={[RADIUS * 0.74, RADIUS * 0.74, 0.3, 6]} />
        <meshStandardMaterial color={STYLE.pavement} roughness={1} flatShading />
      </mesh>

      {wood && (
        <mesh geometry={wood} receiveShadow>
          <meshStandardMaterial color={STYLE.treeTop} roughness={1} />
        </mesh>
      )}
      {parking && (
        <mesh geometry={parking} receiveShadow>
          <meshStandardMaterial color={STYLE.parking} roughness={1} />
        </mesh>
      )}
      {minor && (
        <mesh geometry={minor} receiveShadow>
          <meshStandardMaterial color={STYLE.roadMinor} roughness={1} />
        </mesh>
      )}
      {major && (
        <mesh geometry={major} receiveShadow>
          <meshStandardMaterial color={STYLE.road} roughness={1} />
        </mesh>
      )}

      {trees.map(([x, z, s], i) => (
        <Tree key={i} x={x} z={z} s={s} />
      ))}
    </>
  );
}
