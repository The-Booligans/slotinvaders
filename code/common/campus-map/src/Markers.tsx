import { useFrame, useThree } from '@react-three/fiber';
import type { CSSProperties } from 'react';
import * as THREE from 'three';

/** A DOM pin floating over a campus position. Coordinates as in campus.json. */
export interface CampusMarker {
  id: string;
  /** metres, +x east */
  x: number;
  /** metres, +y north */
  y: number;
  /** short text inside the pin, e.g. "12" free slots */
  badge?: string;
  /** shown next to the pin when selected */
  label?: string;
  /** pin colour; any CSS colour */
  color?: string;
  /** `user` draws a "you are here" dot instead of a pin */
  variant?: 'pin' | 'user';
}

/** DOM nodes of the rendered pins, keyed by marker id; the projector moves them. */
export type MarkerNodes = Map<string, HTMLElement>;

interface MarkerOverlayProps {
  markers: CampusMarker[];
  nodes: MarkerNodes;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const PIN_HEIGHT = 14;

/** Plain DOM pins over the canvas. Positions are written by `MarkerProjector`. */
export function MarkerOverlay({ markers, nodes, selectedId, onSelect }: MarkerOverlayProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {markers.map((m) => {
        const selected = m.id === selectedId;
        return (
          <div
            key={m.id}
            ref={(el) => {
              if (el) nodes.set(m.id, el);
              else nodes.delete(m.id);
            }}
            // hidden until the first projected frame places it
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              display: 'none',
              zIndex: selected ? 2 : m.variant === 'user' ? 0 : 1,
            }}
          >
            {m.variant === 'user' ? (
              <UserDot />
            ) : (
              <Pin marker={m} selected={selected} onSelect={onSelect} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const tmp = new THREE.Vector3();

/** Lives inside the Canvas: projects each marker to screen space every frame. */
export function MarkerProjector({ markers, nodes }: { markers: CampusMarker[]; nodes: MarkerNodes }) {
  const { camera, size } = useThree();
  useFrame(() => {
    for (const m of markers) {
      const el = nodes.get(m.id);
      if (!el) continue;
      tmp.set(m.x, m.variant === 'user' ? 2 : PIN_HEIGHT, -m.y).project(camera);
      const behind = tmp.z > 1;
      // toggle display, not visibility, so a hidden parent still hides the pins
      el.style.display = behind ? 'none' : '';
      if (behind) continue;
      const px = ((tmp.x + 1) / 2) * size.width;
      const py = ((1 - tmp.y) / 2) * size.height;
      el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    }
  });
  return null;
}

function Pin({
  marker,
  selected,
  onSelect,
}: {
  marker: CampusMarker;
  selected: boolean;
  onSelect?: (id: string) => void;
}) {
  const color = marker.color ?? '#2B7EB5';
  const size = selected ? 40 : 32;

  const head: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50% 50% 50% 0',
    transform: 'rotate(-45deg)',
    background: color,
    border: '3px solid #fff',
    boxShadow: selected
      ? `0 0 0 4px ${color}55, 0 6px 14px rgba(0,0,0,.35)`
      : '0 4px 10px rgba(0,0,0,.3)',
    display: 'grid',
    placeItems: 'center',
    transition: 'all 160ms ease-out',
  };

  return (
    <button
      type="button"
      aria-label={marker.label ?? marker.id}
      aria-pressed={selected}
      onClick={() => onSelect?.(marker.id)}
      style={{
        pointerEvents: 'auto',
        position: 'absolute',
        left: 0,
        bottom: 0,
        transform: 'translate(-50%, 0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: 0,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        font: '600 13px/1 system-ui, sans-serif',
      }}
    >
      {selected && marker.label && (
        <span
          style={{
            whiteSpace: 'nowrap',
            padding: '4px 8px',
            borderRadius: 999,
            background: 'rgba(15,23,42,.88)',
            color: '#fff',
            fontSize: 12,
          }}
        >
          {marker.label}
        </span>
      )}
      <span style={head}>
        <span style={{ transform: 'rotate(45deg)', color: '#fff' }}>{marker.badge}</span>
      </span>
    </button>
  );
}

function UserDot() {
  return (
    <span
      aria-label="Your position"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 18,
        height: 18,
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: '#2563EB',
        border: '3px solid #fff',
        boxShadow: '0 0 0 8px rgba(37,99,235,.25), 0 2px 6px rgba(0,0,0,.3)',
      }}
    />
  );
}
