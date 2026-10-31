import { AREA_POSITIONS } from "./area-positions";
import type { StandStatus } from "./stands-api";

export type OccupancyLevel = "free" | "busy" | "almost-full" | "full";

/** One parking area: all of its stands added up. */
export interface ParkingSpot {
  /** area id, e.g. "flow-main" */
  id: string;
  /** area name, e.g. "Flow Main" */
  name: string;
  capacity: number;
  occupied: number;
  free: number;
  /** true if any stand of the area is stale */
  stale: boolean;
  /** latest report of any stand in the area, or null if none ever reported */
  updatedAt: string | null;
  /** campus metres, +x east / +y north; null if the area isn't placed on the map */
  position: [number, number] | null;
  distanceM: number | null;
}

/** Stand-in for the user's position until device location is wired in: the main entrance. */
export const MOCK_USER_POSITION: [number, number] = [40, 0];

const WALKING_M_PER_MIN = 80;

export function distance([ax, ay]: [number, number], [bx, by]: [number, number]): number {
  return Math.hypot(ax - bx, ay - by);
}

type AreaTotals = Omit<ParkingSpot, "position" | "distanceM">;

const latest = (a: string | null, b: string | null) => (a === null || (b !== null && b > a) ? b : a);

/**
 * Adds the stands up per area. Free slots are summed per stand, not taken as
 * capacity minus occupied: a bike over capacity in one stand doesn't fill another.
 */
export function groupByArea(stands: StandStatus[]): AreaTotals[] {
  const areas = new Map<string, AreaTotals>();
  for (const s of stands) {
    const a = areas.get(s.areaId);
    if (!a) {
      areas.set(s.areaId, {
        id: s.areaId,
        name: s.areaName,
        capacity: s.maxOccupancy,
        occupied: s.currentOccupancy,
        free: s.free,
        stale: s.stale,
        updatedAt: s.updatedAt,
      });
      continue;
    }
    a.capacity += s.maxOccupancy;
    a.occupied += s.currentOccupancy;
    a.free += s.free;
    a.stale ||= s.stale;
    a.updatedAt = latest(a.updatedAt, s.updatedAt);
  }
  return [...areas.values()];
}

/** Live stands as map spots, one per area, nearest first; areas without a map position go last. */
export function toParkingSpots(
  stands: StandStatus[],
  from: [number, number] = MOCK_USER_POSITION,
  positions: Record<string, [number, number]> = AREA_POSITIONS,
): ParkingSpot[] {
  return groupByArea(stands)
    .map((area) => {
      const position = positions[area.id] ?? null;
      return {
        ...area,
        position,
        distanceM: position ? Math.round(distance(from, position)) : null,
      };
    })
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity) || a.name.localeCompare(b.name));
}

export function hasData(spot: Pick<ParkingSpot, "updatedAt">): boolean {
  return spot.updatedAt !== null;
}

/** Free slots over the areas that have reported at least once, or null if none has. */
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

/** How busy an area feels, in words: "All free" … "Full". Finer than the colour levels. */
export function occupancyLabel(percent: number): string {
  if (percent >= 100) return "Full";
  if (percent >= 85) return "Almost full";
  if (percent >= 60) return "Busy";
  if (percent >= 30) return "A bit busy";
  if (percent > 0) return "Mostly free";
  return "All free";
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
