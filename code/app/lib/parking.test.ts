import { describe, expect, it } from "vitest";
import {
  distance,
  formatAge,
  formatDistance,
  groupByArea,
  NO_DATA_COLOR,
  LEVEL_COLOR,
  occupancyLabel,
  occupancyLevel,
  occupancyPercent,
  spotColor,
  toParkingSpots,
  totalFree,
  walkingMinutes,
} from "./parking";
import { AREA_POSITIONS } from "./area-positions";
import type { StandStatus } from "./stands-api";

const status = (id: string, patch: Partial<StandStatus> = {}): StandStatus => ({
  id: `${id}-1`,
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

  it("maps the API fields and sorts by distance, unplaced areas last", () => {
    const spots = toParkingSpots([status("far"), status("lost"), status("near")], [0, 0], positions);
    expect(spots.map((s) => s.id)).toEqual(["near", "far", "lost"]);
    expect(spots.map((s) => s.distanceM)).toEqual([5, 500, null]);
    expect(spots[0]).toEqual({
      id: "near",
      name: "Area near",
      capacity: 20,
      occupied: 5,
      free: 15,
      stale: false,
      updatedAt: "2026-10-31T14:48:30.925Z",
      position: [3, 4],
      distanceM: 5,
    });
    expect(spots[2].position).toBeNull();
  });

  it("has no distances and sorts by name without a user position", () => {
    const spots = toParkingSpots([status("far"), status("lost"), status("near")], null, positions);
    expect(spots.map((s) => s.id)).toEqual(["far", "lost", "near"]);
    expect(spots.map((s) => s.distanceM)).toEqual([null, null, null]);
    expect(spots[0].position).toEqual([300, 400]);
  });

  it("places every area the backend currently has", () => {
    const ids = ["flow-garage-north", "flow-garage-south", "flow-main", "flow-se", "flow-sw", "sternenhof"];
    expect(Object.keys(AREA_POSITIONS).sort()).toEqual(ids);
  });
});

describe("groupByArea", () => {
  it("adds up all stands of an area into one spot", () => {
    const [area, ...rest] = groupByArea([
      status("a", { id: "a-1", currentOccupancy: 25, maxOccupancy: 20, free: 0, updatedAt: "2026-10-31T10:00:00Z" }),
      status("a", { id: "a-2", currentOccupancy: 4, maxOccupancy: 30, free: 26, stale: true, updatedAt: null }),
      status("a", { id: "a-3", currentOccupancy: 1, maxOccupancy: 10, free: 9, updatedAt: "2026-10-31T11:00:00Z" }),
    ]);
    expect(rest).toEqual([]);
    // free is summed per stand: the 5 bikes over capacity in a-1 don't take slots in a-2
    expect(area).toEqual({
      id: "a",
      name: "Area a",
      capacity: 60,
      occupied: 30,
      free: 35,
      stale: true,
      updatedAt: "2026-10-31T11:00:00Z",
    });
  });

  it("keeps areas apart and has no data until a stand reports", () => {
    const areas = groupByArea([status("a", { updatedAt: null }), status("b"), status("a", { updatedAt: null })]);
    expect(areas.map((a) => [a.id, a.updatedAt])).toEqual([
      ["a", null],
      ["b", "2026-10-31T14:48:30.925Z"],
    ]);
  });
});

describe("totalFree", () => {
  it("only counts areas that have reported", () => {
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

describe("occupancyLabel", () => {
  it.each([
    [0, "All free"],
    [1, "Mostly free"],
    [29, "Mostly free"],
    [30, "A bit busy"],
    [60, "Busy"],
    [85, "Almost full"],
    [100, "Full"],
    [125, "Full"],
  ] as const)("%i%% reads %s", (percent, label) => {
    expect(occupancyLabel(percent)).toBe(label);
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
