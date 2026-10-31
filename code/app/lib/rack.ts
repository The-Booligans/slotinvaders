export type Rack = {
  id: string;
  name: string;
  address: string;
  totalSlots: number;
  occupiedSlots: number;
  updatedAt: string;
};

export type BusyLevel = "quiet" | "moderate" | "busy" | "full";

// TODO: replace with GET /v1/state once the API is available.
export async function fetchRack(): Promise<Rack> {
  return {
    id: "memox-basel-sbb",
    name: "Bike rack near Memox",
    address: "Centralbahnplatz, 4051 Basel (SBB)",
    totalSlots: 40,
    occupiedSlots: 29,
    updatedAt: new Date().toISOString(),
  };
}

export function occupancy(rack: Pick<Rack, "totalSlots" | "occupiedSlots">): number {
  if (rack.totalSlots <= 0) return 0;
  const ratio = rack.occupiedSlots / rack.totalSlots;
  return Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
}

export function busyLevel(percent: number): BusyLevel {
  if (percent >= 100) return "full";
  if (percent >= 75) return "busy";
  if (percent >= 40) return "moderate";
  return "quiet";
}
