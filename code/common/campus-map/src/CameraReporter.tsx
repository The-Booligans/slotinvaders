import { useFrame, useThree } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

/** What the HUD reads back out of the live scene. */
export interface CameraInfo {
  /** Normalized direction from target to camera — plug this straight into STYLE.camera.dir */
  dir: [number, number, number];
  /** The orbit target in scene metres */
  target: [number, number, number];
  /** Current distance from target to camera */
  distance: number;
}

const tmp = new THREE.Vector3();

interface Props {
  /** Mutable ref the parent polls at 10 Hz to update the DOM overlay */
  into: MutableRefObject<CameraInfo | null>;
}

/**
 * Writes the current camera direction, target and distance into a ref every
 * frame. Lives inside the Canvas; the DOM HUD outside polls the ref.
 */
export function CameraReporter({ into }: Props) {
  const { camera, controls } = useThree() as unknown as {
    camera: THREE.Camera;
    controls: OrbitControlsImpl | null;
  };

  useFrame(() => {
    const target = controls?.target ?? new THREE.Vector3();
    tmp.copy(camera.position).sub(target);
    const distance = tmp.length();
    if (distance === 0) return;
    tmp.multiplyScalar(1 / distance);
    into.current = {
      dir: [+tmp.x.toFixed(3), +tmp.y.toFixed(3), +tmp.z.toFixed(3)],
      target: [+target.x.toFixed(1), +target.y.toFixed(1), +target.z.toFixed(1)],
      distance: +distance.toFixed(1),
    };
  });

  return null;
}
