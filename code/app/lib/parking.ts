import { STANDS, type CampusStand } from "@slotinvaders/campus-map/data";

// Mock data until the live API and device location exist.

export type OccupancyLevel = "free" | "busy" | "almost-full" | "full";

export interface ParkingSpot {
  id: string;
  name: string;
  kind: CampusStand["kind"];
  capacity: number;
  free: number;
  /** campus metres, +x east / +y north */
  x: number;
  y: number;
  distanceM: number;
}

/** Stand-in for the user's position: the main entrance between the two E+H zones. */
export const MOCK_USER_POSITION: [number, number] = [40, 0];

// fixed so the demo looks the same on every load
const MOCK_OCCUPANCY: Record<string, number> = {
  sternenhof: 0.42,
  "flow-main": 0.75,
  "flow-garage-south": 0.93,
  "flow-south-west": 1,
  "flow-south-east": 0.3,
  "flow-garage-north": 0.6,
};
const DEFAULT_OCCUPANCY = 0.5;

const WALKING_M_PER_MIN = 80;

export function distance([ax, ay]: [number, number], [bx, by]: [number, number]): number {
  return Math.hypot(ax - bx, ay - by);
}

export function nearbySpots(
  from: [number, number] = MOCK_USER_POSITION,
  stands: CampusStand[] = STANDS,
): ParkingSpot[] {
  return stands
    .map((s) => {
      const occupied = Math.round(s.capacity * (MOCK_OCCUPANCY[s.id] ?? DEFAULT_OCCUPANCY));
      return {
        id: s.id,
        name: s.label,
        kind: s.kind,
        capacity: s.capacity,
        free: Math.max(0, s.capacity - occupied),
        x: s.x,
        y: s.y,
        distanceM: Math.round(distance(from, [s.x, s.y])),
      };
    })
    .sort((a, b) => a.distanceM - b.distanceM);
}

export function occupancyPercent({ capacity, free }: Pick<ParkingSpot, "capacity" | "free">) {
  if (capacity <= 0) return 100;
  return Math.round(((capacity - free) / capacity) * 100);
}

export function occupancyLevel(percent: number): OccupancyLevel {
  if (percent >= 100) return "full";
  if (percent >= 85) return "almost-full";
  if (percent >= 60) return "busy";
  return "free";
}

export const LEVEL_COLOR: Record<OccupancyLevel, string> = {
  free: "#16a34a",
  busy: "#d97706",
  "almost-full": "#ea580c",
  full: "#dc2626",
};

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function walkingMinutes(m: number): number {
  return Math.max(1, Math.round(m / WALKING_M_PER_MIN));
}

export function kindLabel(kind: CampusStand["kind"]): string {
  return { covered: "Covered", garage: "Garage", open: "Open air" }[kind];
}
