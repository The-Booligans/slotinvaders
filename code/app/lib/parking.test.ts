import { describe, expect, it } from "vitest";
import type { CampusStand } from "@slotinvaders/campus-map/data";
import {
  distance,
  formatDistance,
  kindLabel,
  nearbySpots,
  occupancyLevel,
  occupancyPercent,
  walkingMinutes,
} from "./parking";

const stand = (id: string, x: number, y: number, capacity = 10): CampusStand => ({
  id,
  kind: "covered",
  label: id,
  capacity,
  x,
  y,
});

describe("nearbySpots", () => {
  it("sorts stands by distance from the given position", () => {
    const spots = nearbySpots([0, 0], [stand("far", 300, 400), stand("near", 3, 4)]);
    expect(spots.map((s) => s.id)).toEqual(["near", "far"]);
    expect(spots.map((s) => s.distanceM)).toEqual([5, 500]);
  });

  it("keeps free slots between 0 and capacity", () => {
    for (const s of nearbySpots()) {
      expect(s.free).toBeGreaterThanOrEqual(0);
      expect(s.free).toBeLessThanOrEqual(s.capacity);
    }
  });

  it("uses every campus stand by default", () => {
    expect(nearbySpots().length).toBeGreaterThan(0);
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

  it("labels stand kinds", () => {
    expect(kindLabel("garage")).toBe("Garage");
  });

  it("measures straight-line distance", () => {
    expect(distance([0, 0], [6, 8])).toBe(10);
  });
});
