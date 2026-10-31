import { BOUNDS } from "@slotinvaders/campus-map/data";
import { AREA_POSITIONS } from "./area-positions";

/**
 * GPS fix of the flow-se rack. The campus grid is metres around an arbitrary
 * centre, so this one known point ties it to lat/lon.
 */
const ANCHOR = { lat: 47.486849685407265, lon: 7.5999524596896215, at: AREA_POSITIONS["flow-se"] };

const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((ANCHOR.lat * Math.PI) / 180);

/** WGS84 to campus metres (+x east, +y north). Flat-earth is exact enough over a campus. */
export function toCampus(lat: number, lon: number): [number, number] {
  return [
    ANCHOR.at[0] + (lon - ANCHOR.lon) * M_PER_DEG_LON,
    ANCHOR.at[1] + (lat - ANCHOR.lat) * M_PER_DEG_LAT,
  ];
}

/** Whether a campus point lies on the map island, i.e. whether a "you" dot makes sense. */
export function isOnMap([x, y]: [number, number]): boolean {
  return x >= BOUNDS.minx && x <= BOUNDS.maxx && y >= BOUNDS.miny && y <= BOUNDS.maxy;
}

export type LocationState =
  | { status: "locating" }
  | { status: "ok"; position: [number, number] }
  /** the user said no */
  | { status: "denied" }
  /** no geolocation API (e.g. a desktop browser over http) or no fix possible */
  | { status: "unavailable" };

// GeolocationPositionError codes; the class doesn't exist outside browsers
const PERMISSION_DENIED = 1;

/** Follows the device position. Returns a function that stops watching. */
export function watchUserLocation(
  onChange: (state: LocationState) => void,
  geolocation: Geolocation | undefined = globalThis.navigator?.geolocation,
): () => void {
  if (!geolocation) {
    onChange({ status: "unavailable" });
    return () => {};
  }
  onChange({ status: "locating" });
  let hasFix = false;
  const id = geolocation.watchPosition(
    ({ coords }) => {
      hasFix = true;
      onChange({ status: "ok", position: toCampus(coords.latitude, coords.longitude) });
    },
    (err) => {
      if (err.code === PERMISSION_DENIED) onChange({ status: "denied" });
      // a lost signal after a fix keeps the last known position
      else if (!hasFix) onChange({ status: "unavailable" });
    },
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
  );
  return () => geolocation.clearWatch(id);
}
