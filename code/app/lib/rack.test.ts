import { describe, expect, it } from "vitest";
import { busyLevel, fetchRack, occupancy } from "./rack";

describe("occupancy", () => {
  it("returns rounded percent", () => {
    expect(occupancy({ totalSlots: 40, occupiedSlots: 29 })).toBe(73);
  });

  it("clamps to 0..100", () => {
    expect(occupancy({ totalSlots: 10, occupiedSlots: 15 })).toBe(100);
    expect(occupancy({ totalSlots: 10, occupiedSlots: -2 })).toBe(0);
  });

  it("handles zero slots", () => {
    expect(occupancy({ totalSlots: 0, occupiedSlots: 0 })).toBe(0);
  });
});

describe("busyLevel", () => {
  it.each([
    [0, "quiet"],
    [39, "quiet"],
    [40, "moderate"],
    [74, "moderate"],
    [75, "busy"],
    [99, "busy"],
    [100, "full"],
  ] as const)("%i%% is %s", (percent, level) => {
    expect(busyLevel(percent)).toBe(level);
  });
});

describe("fetchRack", () => {
  it("returns a consistent mock rack", async () => {
    const rack = await fetchRack();
    expect(rack.address).toMatch(/Basel/);
    expect(rack.occupiedSlots).toBeLessThanOrEqual(rack.totalSlots);
  });
});
