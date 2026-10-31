'use client';

import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Scene } from './Scene';
import type { CameraInfo } from './CameraReporter';

export interface SlotInvadersCampusMapProps {
  /** URL to the campus.glb — defaults to a sibling at the site root. */
  glbUrl?: string;
  /** Metres to shift the orbit target so the island reads off-centre. */
  offset?: [number, number];
  /** Show a HUD with the live camera numbers — orbit the map, then paste the
   *  `dir` / `target` values into `style.ts` to lock in the view. */
  debug?: boolean;
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
  debug = false,
  style,
  className,
}: SlotInvadersCampusMapProps) {
  const infoRef = useRef<CameraInfo | null>(null);
  const [info, setInfo] = useState<CameraInfo | null>(null);

  useEffect(() => {
    if (!debug) return;
    const id = setInterval(() => {
      if (infoRef.current) setInfo({ ...infoRef.current });
    }, 100);
    return () => clearInterval(id);
  }, [debug]);

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 36, near: 1, far: 4000 }}
        gl={{ antialias: true }}
      >
        <Scene glbUrl={glbUrl} offset={offset} debugRef={debug ? infoRef : undefined} />
      </Canvas>
      {debug && info && <CameraHud info={info} />}
    </div>
  );
}

function CameraHud({ info }: { info: CameraInfo }) {
  const d = info.dir;
  const t = info.target;
  const snippet = `dir: [${d[0]}, ${d[1]}, ${d[2]}]`;

  const copy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(snippet).catch(() => {});
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        padding: '10px 12px',
        background: 'rgba(0, 0, 0, 0.78)',
        color: '#fff',
        font: '12px/1.4 ui-monospace, Menlo, Consolas, monospace',
        borderRadius: 6,
        pointerEvents: 'auto',
        zIndex: 10,
        minWidth: 220,
      }}
    >
      <div>
        <strong style={{ color: '#5CC2F2' }}>dir</strong>: [
        {d[0]}, {d[1]}, {d[2]}]
      </div>
      <div>
        <strong style={{ color: '#5CC2F2' }}>target</strong>: [
        {t[0]}, {t[1]}, {t[2]}]
      </div>
      <div>
        <strong style={{ color: '#5CC2F2' }}>distance</strong>: {info.distance}
      </div>
      <button
        type="button"
        onClick={copy}
        style={{
          marginTop: 8,
          padding: '4px 8px',
          background: '#5CC2F2',
          color: '#000',
          border: 'none',
          borderRadius: 4,
          font: 'inherit',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        copy dir
      </button>
    </div>
  );
}
