import { describe, expect, it } from "vitest";
import {
  distance,
  formatAge,
  formatDistance,
  NO_DATA_COLOR,
  LEVEL_COLOR,
  occupancyLevel,
  occupancyPercent,
  spotColor,
  standLabel,
  toParkingSpots,
  totalFree,
  walkingMinutes,
} from "./parking";
import { STAND_POSITIONS } from "./stand-positions";
import type { StandStatus } from "./stands-api";

const status = (id: string, patch: Partial<StandStatus> = {}): StandStatus => ({
  id,
  name: `Area ${id}, Stand 1`,
  areaId: id,
  areaName: `Area ${id}`,
  currentOccupancy: 5,
  maxOccupancy: 20,
  free: 15,
  stale: false,
  updatedAt: "2026-10-31T14:48:30.925Z",
  ...patch,
});

describe("toParkingSpots", () => {
  const positions: Record<string, [number, number]> = { near: [3, 4], far: [300, 400] };

  it("maps the API fields and sorts by distance, unplaced stands last", () => {
    const spots = toParkingSpots([status("far"), status("lost"), status("near")], [0, 0], positions);
    expect(spots.map((s) => s.id)).toEqual(["near", "far", "lost"]);
    expect(spots.map((s) => s.distanceM)).toEqual([5, 500, null]);
    expect(spots[0]).toMatchObject({
      name: "Area near",
      standLabel: "Stand 1",
      capacity: 20,
      occupied: 5,
      free: 15,
      position: [3, 4],
    });
    expect(spots[2].position).toBeNull();
  });

  it("places every stand the backend currently has", () => {
    const ids = ["flow-garage-north-1", "flow-garage-south-1", "flow-main-1", "flow-se-1", "flow-sw-1", "sternenhof-1"];
    expect(Object.keys(STAND_POSITIONS).sort()).toEqual(ids);
  });
});

describe("standLabel", () => {
  it("drops the area name from the stand name", () => {
    expect(standLabel("Veloparking Flowtec, Stand 1", "Veloparking Flowtec")).toBe("Stand 1");
    expect(standLabel("Odd name", "Veloparking Flowtec")).toBe("Odd name");
  });
});

describe("totalFree", () => {
  it("only counts stands that have reported", () => {
    const spots = toParkingSpots([status("a", { free: 7 }), status("b", { free: 20, updatedAt: null })], [0, 0], {});
    expect(totalFree(spots)).toBe(7);
    expect(totalFree(spots.slice(1))).toBeNull();
  });
});

describe("spotColor", () => {
  it("is grey without data, else by occupancy", () => {
    expect(spotColor({ capacity: 20, free: 20, updatedAt: null })).toBe(NO_DATA_COLOR);
    expect(spotColor({ capacity: 20, free: 0, updatedAt: "2026-10-31T00:00:00Z" })).toBe(LEVEL_COLOR.full);
  });
});

describe("occupancyPercent", () => {
  it("is the share of taken slots", () => {
    expect(occupancyPercent({ capacity: 20, free: 5 })).toBe(75);
  });

  it("treats a stand without capacity as full", () => {
    expect(occupancyPercent({ capacity: 0, free: 0 })).toBe(100);
  });
});

describe("occupancyLevel", () => {
  it.each([
    [0, "free"],
    [59, "free"],
    [60, "busy"],
    [85, "almost-full"],
    [100, "full"],
  ] as const)("%i%% is %s", (percent, level) => {
    expect(occupancyLevel(percent)).toBe(level);
  });
});

describe("formatting", () => {
  it("formats metres and kilometres", () => {
    expect(formatDistance(120.4)).toBe("120 m");
    expect(formatDistance(1530)).toBe("1.5 km");
  });

  it("rounds walking time to at least one minute", () => {
    expect(walkingMinutes(10)).toBe(1);
    expect(walkingMinutes(400)).toBe(5);
  });

  it("measures straight-line distance", () => {
    expect(distance([0, 0], [6, 8])).toBe(10);
  });

  it.each([
    ["2026-10-31T14:48:30Z", "just now"],
    ["2026-10-31T14:44:00Z", "4 min ago"],
    ["2026-10-31T13:02:00Z", "1 h ago"],
    ["2026-10-28T14:00:00Z", "3 d ago"],
    ["2026-10-31T14:49:00Z", "just now"],
  ])("ages %s as %s", (then, label) => {
    expect(formatAge(then, "2026-10-31T14:48:35Z")).toBe(label);
  });
});
