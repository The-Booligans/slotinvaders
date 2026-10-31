// Remember where the user parked their bike using iBeacons on each stand.
//
// Every stand has (or will have) a BLE iBeacon. The app scans for them while
// the user is on campus and tracks how long we see each one. When the user
// leaves campus — no beacon seen for `LEFT_CAMPUS_AFTER_MS` — the stand with
// the longest dwell this trip wins and is stored as the parked location.
// Readings keep arriving while on campus; the stored location is only
// rewritten once the trip ends.

export interface BeaconConfig {
  /** 12-char uppercase hex MAC, matches `stands[].beacon` in stands.yaml. */
  mac: string;
  standId: string;
  areaId: string;
  standName: string;
  areaName: string;
}

/** The two stands wired up with beacons for the hackathon rollout. */
export const CAMPUS_BEACONS: BeaconConfig[] = [
  {
    mac: "80ECCCD2BB45",
    standId: "flow-se-1",
    areaId: "flow-se",
    standName: "Flow South East, Stand 1",
    areaName: "Flow South East",
  },
  {
    mac: "80ECCCD2B73A",
    standId: "flow-sw-1",
    areaId: "flow-sw",
    standName: "Flow South West, Stand 1",
    areaName: "Flow South West",
  },
];

/** Keep BLE identifiers robust against hex casing and separators (`AA:BB:…`). */
export function normalizeMac(mac: string): string {
  return mac.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
}

export function findBeacon(mac: string): BeaconConfig | null {
  const n = normalizeMac(mac);
  return CAMPUS_BEACONS.find((b) => normalizeMac(b.mac) === n) ?? null;
}

/** No beacon seen for this long → the trip is over and we commit a result. */
export const LEFT_CAMPUS_AFTER_MS = 5 * 60 * 1000;

export interface TripState {
  /** When the current campus visit started, or null when off-campus. */
  startedAt: number | null;
  /** Last beacon-seen timestamp — the clock we expire against. */
  lastSeenAt: number | null;
  /** Which stand's beacon was last seen (used to attribute dwell between scans). */
  lastStandId: string | null;
  /** Total ms spent near each stand's beacon this trip. */
  dwellByStand: Record<string, number>;
}

export function emptyTrip(): TripState {
  return { startedAt: null, lastSeenAt: null, lastStandId: null, dwellByStand: {} };
}

export interface Parked {
  beacon: BeaconConfig;
  at: number;
  dwellMs: number;
}

export interface TickResult {
  trip: TripState;
  /** Set when the trip just ended; the stand with the longest dwell wins. */
  parked: Parked | null;
}

/**
 * Advance the trip with a scanner tick.
 *
 * - `seenMac` is the MAC of a beacon seen in this tick, or null for an empty
 *   scan. Only the first known MAC per tick is passed in; multiple beacons in
 *   the same tick are handled by calling tick again.
 * - `now` is the current time in ms.
 */
export function tick(trip: TripState, now: number, seenMac: string | null): TickResult {
  const beacon = seenMac ? findBeacon(seenMac) : null;

  if (beacon) {
    const dwellByStand = { ...trip.dwellByStand };
    // Credit the gap since the last beacon tick to whichever stand we were
    // last near. First beacon of a trip has nothing to credit yet.
    if (trip.lastSeenAt != null && trip.lastStandId) {
      const delta = Math.max(0, now - trip.lastSeenAt);
      dwellByStand[trip.lastStandId] = (dwellByStand[trip.lastStandId] ?? 0) + delta;
    }
    return {
      trip: {
        startedAt: trip.startedAt ?? now,
        lastSeenAt: now,
        lastStandId: beacon.standId,
        dwellByStand,
      },
      parked: null,
    };
  }

  // No beacon this tick: are we past the campus-exit threshold?
  if (trip.lastSeenAt != null && now - trip.lastSeenAt >= LEFT_CAMPUS_AFTER_MS) {
    // Only time *between* beacon sightings counts as dwell. The silent exit
    // window is the user leaving, not sitting at the last rack, so crediting
    // it would unfairly favour whichever beacon was seen last.
    let winner: BeaconConfig | null = null;
    let longest = 0;
    for (const [standId, dwell] of Object.entries(trip.dwellByStand)) {
      if (dwell > longest) {
        longest = dwell;
        winner = CAMPUS_BEACONS.find((b) => b.standId === standId) ?? null;
      }
    }
    // Fallback: a trip with a single beacon sighting has no dwell yet, but
    // the user still parked there — report the only candidate we have.
    if (!winner && trip.lastStandId) {
      winner = CAMPUS_BEACONS.find((b) => b.standId === trip.lastStandId) ?? null;
    }
    return {
      trip: emptyTrip(),
      parked: winner ? { beacon: winner, at: now, dwellMs: longest } : null,
    };
  }

  return { trip, parked: null };
}
