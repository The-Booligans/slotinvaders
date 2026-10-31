import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CENTRE } from './campus-data';
import { STYLE } from './style';
import { Buildings } from './Buildings';
import { Island } from './Island';
import { CameraReporter, type CameraInfo } from './CameraReporter';
import { MarkerProjector, type CampusMarker, type MarkerNodes } from './Markers';

/**
 * Everything that lives inside the Canvas: lights, the island ground, the
 * buildings and the orbit camera rig. The sky is a flat background colour —
 * no atmospheric scattering, which washed the horizon toward white.
 */

// frame the floating island, not the full bounds — tighter and symmetric
const EXTENT = {
  w: STYLE.island.radius * 2,
  d: STYLE.island.radius * 2,
};

interface RigProps {
  /** Visual nudge of the island inside the viewport, in scene metres at the
   *  target depth. Positive X moves the island left; negative X moves it right.
   *  Implemented via `camera.setViewOffset`, so the orbit pivot stays on the
   *  island centre. */
  offset?: [number, number];
  /** campus point (x east, y north) to glide to; null keeps the current view */
  focus?: [number, number] | null;
  /** change this value to glide back to the initial framing */
  recenterKey?: number;
}

// how far the camera sits from a focused marker
const FOCUS_DISTANCE = 420;

function homePosition(target: THREE.Vector3, aspect: number) {
  // distance that fits the island into frame on both axes (pick the tighter)
  const halfFov = (STYLE.camera.fov * Math.PI) / 360;
  const vDist = EXTENT.d / 2 / Math.tan(halfFov);
  const hDist = EXTENT.w / 2 / (aspect * Math.tan(halfFov));
  const dist = Math.max(vDist, hDist) * STYLE.camera.fit;
  const [dx, dy, dz] = STYLE.camera.dir;
  const len = Math.hypot(dx, dy, dz);
  return new THREE.Vector3(
    target.x + (dx / len) * dist,
    (dy / len) * dist,
    target.z + (dz / len) * dist,
  );
}

function Rig({ offset = [0, 0], focus, recenterKey }: RigProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const glide = useRef<{ target: THREE.Vector3; position: THREE.Vector3 } | null>(null);
  const { camera, size } = useThree();
  const aspect = size.width / size.height;
  const [ox, oz] = offset;
  const target = useMemo(
    () => new THREE.Vector3(CENTRE[0], 0, CENTRE[1]),
    [],
  );

  useEffect(() => {
    camera.position.copy(homePosition(target, aspect));
    const perspCam = camera as THREE.PerspectiveCamera;
    perspCam.fov = STYLE.camera.fov;
    if (ox !== 0 || oz !== 0) {
      // metres at the target depth → pixels in the current viewport
      const dist = camera.position.distanceTo(target);
      const halfFov = (STYLE.camera.fov * Math.PI) / 360;
      const pxPerMetre = size.height / (2 * dist * Math.tan(halfFov));
      perspCam.setViewOffset(
        size.width,
        size.height,
        ox * pxPerMetre,
        -oz * pxPerMetre,
        size.width,
        size.height,
      );
    } else {
      perspCam.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    controls.current?.target.copy(target);
    controls.current?.update();
  }, [camera, aspect, target, ox, oz, size.width, size.height]);

  const isFirstRecenter = useRef(true);
  useEffect(() => {
    if (isFirstRecenter.current) {
      isFirstRecenter.current = false;
      return;
    }
    glide.current = { target: target.clone(), position: homePosition(target, aspect) };
    // aspect is read, not tracked: resizing must not trigger a glide
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  const fx = focus?.[0];
  const fy = focus?.[1];
  useEffect(() => {
    if (fx === undefined || fy === undefined || !controls.current) return;
    const goal = new THREE.Vector3(fx, 0, -fy);
    // keep the current viewing angle, just move closer to the marker
    const dir = camera.position.clone().sub(controls.current.target).normalize();
    glide.current = { target: goal, position: goal.clone().addScaledVector(dir, FOCUS_DISTANCE) };
  }, [fx, fy, camera]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    // the user grabbed the map: stop any glide in progress
    const stop = () => (glide.current = null);
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, []);

  useFrame((_, delta) => {
    const g = glide.current;
    const c = controls.current;
    if (g && c) {
      const t = 1 - Math.exp(-delta * 5);
      c.target.lerp(g.target, t);
      camera.position.lerp(g.position, t);
      if (camera.position.distanceTo(g.position) < 0.5) glide.current = null;
    }
    c?.update();
  });

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

export interface SceneProps {
  glbUrl: string;
  /** metres to shift the orbit target; use to compose the island off-centre */
  offset?: [number, number];
  /** when set, every frame writes the current camera dir/target/distance into it */
  debugRef?: MutableRefObject<CameraInfo | null>;
  markers?: CampusMarker[];
  /** DOM pins rendered outside the canvas, positioned from here */
  markerNodes?: MarkerNodes;
  selectedMarkerId?: string | null;
  recenterKey?: number;
}

export function Scene({
  glbUrl,
  offset,
  debugRef,
  markers,
  markerNodes,
  selectedMarkerId,
  recenterKey,
}: SceneProps) {
  const selected = markers?.find((m) => m.id === selectedMarkerId);
  const focus: [number, number] | null = selected ? [selected.x, selected.y] : null;

  return (
    <>
      <color attach="background" args={[STYLE.sky]} />

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

      {markers && markerNodes && <MarkerProjector markers={markers} nodes={markerNodes} />}

      <Rig offset={offset} focus={focus} recenterKey={recenterKey} />

      {debugRef && <CameraReporter into={debugRef} />}
    </>
  );
}
