'use client';

import { Canvas } from '@react-three/fiber';
import type { CSSProperties } from 'react';
import { Scene } from './Scene';

export interface SlotInvadersCampusMapProps {
  /** URL to the campus.glb — defaults to a sibling at the site root. */
  glbUrl?: string;
  /** Metres to shift the orbit target so the island reads off-centre. */
  offset?: [number, number];
  /** Inline style for the outer wrapper; pass height to size the canvas. */
  style?: CSSProperties;
  className?: string;
}

/**
 * A WebGL view of the Endress+Hauser Reinach campus, rendered as a floating
 * hex island — saturated colours, a checker lawn, and the brand roofs in
 * berry. The whole thing fits a parent box; drag to orbit, scroll to zoom.
 */
export function SlotInvadersCampusMap({
  glbUrl = '/campus.glb',
  offset,
  style,
  className,
}: SlotInvadersCampusMapProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', ...style }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 36, near: 1, far: 4000 }}
        gl={{ antialias: true }}
      >
        <Scene glbUrl={glbUrl} offset={offset} />
      </Canvas>
    </div>
  );
}
