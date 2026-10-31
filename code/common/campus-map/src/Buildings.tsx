import { useLayoutEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ZONES } from './campus-data';
import { EH_ANCHORS, STYLE } from './style';

/**
 * Buildings come from a baked GLB (one Swiss campus, every roof and wall).
 * We traverse the scene, decide which pieces belong to Endress+Hauser, and
 * paint walls vs. roofs by face-normal — so the roof berry pops without
 * splitting the geometry.
 */

function isEh(cx: number, cz: number): boolean {
  if (EH_ANCHORS.some(([x, z]) => Math.hypot(cx - x, cz - z) < 25)) return true;
  return ZONES.some((zone) => {
    const [x0, y0, x1, y1] = zone.box;
    return cx >= x0 - 6 && cx <= x1 + 6 && -cz >= y0 - 6 && -cz <= y1 + 6;
  });
}

function colourByNormal(geo: THREE.BufferGeometry, wall: THREE.Color, roof: THREE.Color) {
  const normal = geo.attributes.normal;
  const col = new Float32Array(normal.count * 3);
  for (let i = 0; i < normal.count; i++) {
    // faces pointing up become roofs; everything else is a wall
    const c = normal.getY(i) > 0.55 ? roof : wall;
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export function Buildings({ glbUrl }: { glbUrl: string }) {
  const gltf = useGLTF(glbUrl);

  const meshes = useMemo(() => {
    const out: { mesh: THREE.Mesh; eh: boolean }[] = [];
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!;
      out.push({ mesh, eh: isEh((bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2) });
    });
    return out;
  }, [gltf]);

  useLayoutEffect(() => {
    const wall = new THREE.Color(STYLE.wall);
    const roof = new THREE.Color(STYLE.roof);
    const ehWall = new THREE.Color(STYLE.ehWall);
    const ehRoof = new THREE.Color(STYLE.ehRoof);

    meshes.forEach(({ mesh, eh }) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      colourByNormal(mesh.geometry, eh ? ehWall : wall, eh ? ehRoof : roof);
      mesh.material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
      });
    });
  }, [meshes]);

  return <primitive object={gltf.scene} />;
}

// pre-fetch via a static call — safe to invoke at module load, drei caches by URL
export const preloadBuildings = (url: string) => useGLTF.preload(url);
