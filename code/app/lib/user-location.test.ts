import { describe, expect, it, vi } from "vitest";
import { AREA_POSITIONS } from "./area-positions";
import { distance } from "./parking";
import { isOnMap, toCampus, watchUserLocation, type LocationState } from "./user-location";

describe("toCampus", () => {
  it("puts the flow-se GPS fix on the flow-se rack", () => {
    const [x, y] = toCampus(47.486849685407265, 7.5999524596896215);
    expect(x).toBeCloseTo(AREA_POSITIONS["flow-se"][0], 6);
    expect(y).toBeCloseTo(AREA_POSITIONS["flow-se"][1], 6);
  });

  it("maps 0.001° north to ~111 m and 0.001° east to ~75 m", () => {
    const [x0, y0] = toCampus(47.4868, 7.5999);
    const [x1, y1] = toCampus(47.4878, 7.6009);
    expect(y1 - y0).toBeCloseTo(111.3, 1);
    expect(x1 - x0).toBeCloseTo(75.2, 1);
  });

  it("measures a real walk: about 100 m from a point 0.0009° north of flow-se", () => {
    const from = toCampus(47.486849685407265 + 0.0009, 7.5999524596896215);
    expect(distance(from, AREA_POSITIONS["flow-se"])).toBeCloseTo(100, 0);
  });
});

describe("isOnMap", () => {
  it("accepts campus points and rejects far-away ones", () => {
    expect(isOnMap(AREA_POSITIONS["flow-main"])).toBe(true);
    expect(isOnMap(toCampus(47.3769, 8.5417))).toBe(false); // Zürich
  });
});

function fakeGeolocation() {
  const watch: { success?: PositionCallback; error?: PositionErrorCallback } = {};
  const geolocation = {
    watchPosition: vi.fn((s: PositionCallback, e: PositionErrorCallback) => {
      watch.success = s;
      watch.error = e;
      return 7;
    }),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  } as unknown as Geolocation;
  const fix = (latitude: number, longitude: number) =>
    watch.success?.({ coords: { latitude, longitude } } as GeolocationPosition);
  const fail = (code: number) => watch.error?.({ code } as GeolocationPositionError);
  return { geolocation, fix, fail };
}

function watch(geolocation?: Geolocation) {
  const states: LocationState[] = [];
  const stop = watchUserLocation((s) => states.push(s), geolocation);
  return { states, stop };
}

describe("watchUserLocation", () => {
  it("reports unavailable when the device has no geolocation", () => {
    const { states } = watch(undefined);
    expect(states).toEqual([{ status: "unavailable" }]);
  });

  it("reports locating, then campus positions", () => {
    const geo = fakeGeolocation();
    const { states } = watch(geo.geolocation);
    geo.fix(47.486849685407265, 7.5999524596896215);
    expect(states[0]).toEqual({ status: "locating" });
    expect(states[1].status).toBe("ok");
    const [x, y] = (states[1] as { position: [number, number] }).position;
    expect([Math.round(x * 10) / 10, Math.round(y * 10) / 10]).toEqual(AREA_POSITIONS["flow-se"]);
  });

  it("reports denied when the user rejects the permission", () => {
    const geo = fakeGeolocation();
    const { states } = watch(geo.geolocation);
    geo.fail(1);
    expect(states.at(-1)).toEqual({ status: "denied" });
  });

  it("reports unavailable when no fix comes, but keeps a fix through a lost signal", () => {
    const geo = fakeGeolocation();
    const first = watch(geo.geolocation);
    geo.fail(3); // timeout
    expect(first.states.at(-1)).toEqual({ status: "unavailable" });

    const geo2 = fakeGeolocation();
    const second = watch(geo2.geolocation);
    geo2.fix(47.4868, 7.5999);
    geo2.fail(2); // position unavailable
    expect(second.states.at(-1)?.status).toBe("ok");
  });

  it("stops watching", () => {
    const geo = fakeGeolocation();
    watch(geo.geolocation).stop();
    expect(geo.geolocation.clearWatch).toHaveBeenCalledWith(7);
  });
});
