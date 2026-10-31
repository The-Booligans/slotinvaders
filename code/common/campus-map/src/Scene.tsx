import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { BOUNDS, CENTRE } from './campus-data';
import { STYLE } from './style';
import { Buildings } from './Buildings';
import { Island } from './Island';

/**
 * Everything that lives inside the Canvas: lights, the sky dome, the island
 * ground, the buildings and the orbit camera rig.
 */

// frame the floating island, not the full bounds — tighter and symmetric
const EXTENT = {
  w: STYLE.island.radius * 2,
  d: STYLE.island.radius * 2,
};

function Rig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const aspect = size.width / size.height;
  const target = useMemo(() => new THREE.Vector3(CENTRE[0], 0, CENTRE[1]), []);

  useEffect(() => {
    // distance that fits the island into frame on both axes (pick the tighter)
    const halfFov = (STYLE.camera.fov * Math.PI) / 360;
    const vDist = EXTENT.d / 2 / Math.tan(halfFov);
    const hDist = EXTENT.w / 2 / (aspect * Math.tan(halfFov));
    const dist = Math.max(vDist, hDist) * STYLE.camera.fit;
    const [dx, dy, dz] = STYLE.camera.dir;
    const len = Math.hypot(dx, dy, dz);
    camera.position.set(
      target.x + (dx / len) * dist,
      (dy / len) * dist,
      target.z + (dz / len) * dist,
    );
    (camera as THREE.PerspectiveCamera).fov = STYLE.camera.fov;
    camera.updateProjectionMatrix();
    controls.current?.target.copy(target);
    controls.current?.update();
  }, [camera, aspect, target]);

  useFrame(() => controls.current?.update());

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={120}
      maxDistance={2200}
      maxPolarAngle={STYLE.camera.maxPolar}
      target={target}
    />
  );
}

export function Scene({ glbUrl }: { glbUrl: string }) {
  return (
    <>
      <color attach="background" args={[STYLE.sky]} />
      <Sky sunPosition={[120, 90, 60]} turbidity={3} rayleigh={0.4} />

      <hemisphereLight args={STYLE.hemi} />
      <ambientLight intensity={STYLE.ambient} />
      <directionalLight
        position={STYLE.sun.pos}
        intensity={STYLE.sun.intensity}
        color={STYLE.sun.colour}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-320}
        shadow-camera-right={320}
        shadow-camera-top={320}
        shadow-camera-bottom={-320}
        shadow-camera-near={1}
        shadow-camera-far={900}
        shadow-bias={-0.0006}
      />
      <directionalLight
        position={STYLE.rim.pos}
        intensity={STYLE.rim.intensity}
        color={STYLE.rim.colour}
      />

      <Island />

      <Suspense fallback={null}>
        <Buildings glbUrl={glbUrl} />
      </Suspense>

      <Rig />
    </>
  );
}
