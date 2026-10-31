import { STAND_POSITIONS } from "./stand-positions";
import type { StandStatus } from "./stands-api";

export type OccupancyLevel = "free" | "busy" | "almost-full" | "full";

export interface ParkingSpot {
  id: string;
  /** area name, e.g. "Veloparking Flowtec" */
  name: string;
  /** what's left of the stand name, e.g. "Stand 1" */
  standLabel: string;
  capacity: number;
  occupied: number;
  free: number;
  stale: boolean;
  updatedAt: string | null;
  /** campus metres, +x east / +y north; null if the stand isn't placed on the map */
  position: [number, number] | null;
  distanceM: number | null;
}

/** Stand-in for the user's position until device location is wired in: the main entrance. */
export const MOCK_USER_POSITION: [number, number] = [40, 0];

const WALKING_M_PER_MIN = 80;

export function distance([ax, ay]: [number, number], [bx, by]: [number, number]): number {
  return Math.hypot(ax - bx, ay - by);
}

/** "Veloparking Flowtec, Stand 1" in area "Veloparking Flowtec" -> "Stand 1". */
export function standLabel(name: string, areaName: string): string {
  const prefix = `${areaName}, `;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

/** Live stands as map spots, nearest first; stands without a map position go last. */
export function toParkingSpots(
  stands: StandStatus[],
  from: [number, number] = MOCK_USER_POSITION,
  positions: Record<string, [number, number]> = STAND_POSITIONS,
): ParkingSpot[] {
  return stands
    .map((s) => {
      const position = positions[s.id] ?? null;
      return {
        id: s.id,
        name: s.areaName,
        standLabel: standLabel(s.name, s.areaName),
        capacity: s.maxOccupancy,
        occupied: s.currentOccupancy,
        free: s.free,
        stale: s.stale,
        updatedAt: s.updatedAt,
        position,
        distanceM: position ? Math.round(distance(from, position)) : null,
      };
    })
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity) || a.name.localeCompare(b.name));
}

export function hasData(spot: Pick<ParkingSpot, "updatedAt">): boolean {
  return spot.updatedAt !== null;
}

/** Free slots over the stands that have reported at least once, or null if none has. */
export function totalFree(spots: ParkingSpot[]): number | null {
  const reporting = spots.filter(hasData);
  return reporting.length ? reporting.reduce((sum, s) => sum + s.free, 0) : null;
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

/** Pin colour for a stand that never reported. */
export const NO_DATA_COLOR = "#94a3b8";

export function spotColor(spot: Pick<ParkingSpot, "capacity" | "free" | "updatedAt">): string {
  return hasData(spot) ? LEVEL_COLOR[occupancyLevel(occupancyPercent(spot))] : NO_DATA_COLOR;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function walkingMinutes(m: number): number {
  return Math.max(1, Math.round(m / WALKING_M_PER_MIN));
}

/** "just now", "5 min ago", "2 h ago", "3 d ago": age of `then` at server time `now`. */
export function formatAge(then: string, now: string): string {
  const seconds = Math.max(0, (Date.parse(now) - Date.parse(then)) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}
