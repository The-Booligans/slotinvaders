import raw from './campus.json';

/**
 * Campus coordinates: metres from the centre of the two Endress+Hauser zones,
 * +x east and +y north. Buildings come from the baked GLB; roads, areas and
 * zones live here as polyline/polygon data for the ground layer.
 */

export interface Zone {
  id: string;
  box: [number, number, number, number];
}

export interface Road {
  pts: [number, number][];
  w: number;
  minor: boolean;
}

export interface AreaPatch {
  ring: [number, number][];
  kind: 'parking' | 'wood' | 'green';
}

export interface CampusStand {
  id: string;
  kind: 'covered' | 'garage' | 'open';
  label: string;
  capacity: number;
  /** metres, +x east */
  x: number;
  /** metres, +y north */
  y: number;
}

interface CampusData {
  stands: CampusStand[];
  bounds: { minx: number; maxx: number; miny: number; maxy: number };
  zones: Zone[];
  roads: Road[];
  areas?: AreaPatch[];
}

const data = raw as unknown as CampusData;

export const BOUNDS = data.bounds;
export const ZONES = data.zones;
export const ROADS = data.roads;
export const AREAS: AreaPatch[] = data.areas ?? [];
export const STANDS: CampusStand[] = data.stands;

export const CENTRE: [number, number] = [
  (BOUNDS.minx + BOUNDS.maxx) / 2,
  -(BOUNDS.miny + BOUNDS.maxy) / 2,
];
