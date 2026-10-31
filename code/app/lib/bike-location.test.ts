import { describe, expect, it } from "vitest";
import {
  CAMPUS_BEACONS,
  LEFT_CAMPUS_AFTER_MS,
  emptyTrip,
  findBeacon,
  normalizeMac,
  tick,
  type TripState,
} from "./bike-location";

const SE = CAMPUS_BEACONS.find((b) => b.standId === "flow-se-1")!;
const SW = CAMPUS_BEACONS.find((b) => b.standId === "flow-sw-1")!;

describe("normalizeMac", () => {
  it("strips separators and uppercases", () => {
    expect(normalizeMac("80:ec:cc:d2:bb:45")).toBe("80ECCCD2BB45");
    expect(normalizeMac("80-EC-CC-D2-BB-45")).toBe("80ECCCD2BB45");
  });
});

describe("findBeacon", () => {
  it("matches regardless of casing or separators", () => {
    expect(findBeacon("80:EC:CC:D2:BB:45")?.standId).toBe("flow-se-1");
    expect(findBeacon("80eccc d2 b73a")?.standId).toBe("flow-sw-1");
  });

  it("returns null for an unknown MAC", () => {
    expect(findBeacon("000000000000")).toBeNull();
  });
});

describe("tick", () => {
  it("ignores empty scans before the trip has started", () => {
    const r = tick(emptyTrip(), 1000, null);
    expect(r.trip).toEqual(emptyTrip());
    expect(r.parked).toBeNull();
  });

  it("starts a trip on the first beacon", () => {
    const r = tick(emptyTrip(), 1000, SE.mac);
    expect(r.trip.startedAt).toBe(1000);
    expect(r.trip.lastSeenAt).toBe(1000);
    expect(r.trip.lastStandId).toBe("flow-se-1");
    expect(r.trip.dwellByStand).toEqual({});
    expect(r.parked).toBeNull();
  });

  it("accumulates dwell at the last-seen stand between ticks", () => {
    let trip: TripState = emptyTrip();
    trip = tick(trip, 0, SE.mac).trip;
    trip = tick(trip, 10_000, SE.mac).trip;
    trip = tick(trip, 25_000, SE.mac).trip;
    expect(trip.dwellByStand).toEqual({ "flow-se-1": 25_000 });
  });

  it("splits dwell between stands as the user moves", () => {
    let trip: TripState = emptyTrip();
    trip = tick(trip, 0, SE.mac).trip;
    trip = tick(trip, 10_000, SE.mac).trip; // 10s at SE
    trip = tick(trip, 15_000, SW.mac).trip; // +5s credited to SE
    trip = tick(trip, 25_000, SW.mac).trip; // +10s credited to SW
    expect(trip.dwellByStand).toEqual({ "flow-se-1": 15_000, "flow-sw-1": 10_000 });
  });

  it("holds the trip open while silent gaps are shorter than the exit threshold", () => {
    let trip: TripState = emptyTrip();
    trip = tick(trip, 0, SE.mac).trip;
    trip = tick(trip, LEFT_CAMPUS_AFTER_MS - 1, null).trip;
    expect(trip.startedAt).toBe(0);
    expect(trip.lastSeenAt).toBe(0);
  });

  it("ends the trip after the exit threshold and reports the longest-dwell stand", () => {
    let trip: TripState = emptyTrip();
    trip = tick(trip, 0, SE.mac).trip;
    trip = tick(trip, 30_000, SE.mac).trip; // 30s at SE
    trip = tick(trip, 40_000, SW.mac).trip; // 10s added to SE on handoff
    trip = tick(trip, 60_000, SW.mac).trip; // 20s added to SW
    const end = 60_000 + LEFT_CAMPUS_AFTER_MS;
    const r = tick(trip, end, null);
    expect(r.parked?.beacon.standId).toBe("flow-se-1"); // SE: 40s + credit for the final silent window
    expect(r.trip).toEqual(emptyTrip());
  });

  it("picks the stand with the longest dwell, not the most recent", () => {
    let trip: TripState = emptyTrip();
    trip = tick(trip, 0, SW.mac).trip;
    trip = tick(trip, 120_000, SW.mac).trip; // 120s at SW
    trip = tick(trip, 125_000, SE.mac).trip; // +5s SW, now at SE
    // Only one more SE sample, then user leaves.
    trip = tick(trip, 130_000, SE.mac).trip;
    const r = tick(trip, 130_000 + LEFT_CAMPUS_AFTER_MS, null);
    expect(r.parked?.beacon.standId).toBe("flow-sw-1");
  });

  it("falls back to the single-sighting beacon when there is no dwell to compare", () => {
    // The silent exit window is the user leaving, not sitting at the rack,
    // so a one-ping trip has 0 ms of dwell. We still report that beacon as
    // where the bike is — it is the only candidate we have.
    let trip: TripState = emptyTrip();
    trip = tick(trip, 0, SE.mac).trip;
    const r = tick(trip, LEFT_CAMPUS_AFTER_MS, null);
    expect(r.parked?.beacon.standId).toBe("flow-se-1");
    expect(r.parked?.dwellMs).toBe(0);
  });

  it("ignores unknown beacons", () => {
    const r = tick(emptyTrip(), 1000, "AA:BB:CC:DD:EE:FF");
    expect(r.trip).toEqual(emptyTrip());
    expect(r.parked).toBeNull();
  });
});
