"use client";

import { useEffect, useRef, useState } from "react";
import { emptyTrip, tick, type TripState } from "@/lib/bike-location";
import { readParked, writeParked, type ParkedView } from "@/lib/bike-location-storage";
import { startBeaconScanner } from "@/lib/beacon-scanner";

/** How often we check whether the silent window has pushed us past the exit. */
const SETTLE_INTERVAL_MS = 15_000;

export interface BikeLocationState {
  parked: ParkedView | null;
  /** True while we're scanning (regardless of whether a beacon is in range). */
  scanning: boolean;
  /** The last BLE/permission error surfaced by the scanner. */
  error: string | null;
}

export function useBikeLocation(): BikeLocationState {
  const [parked, setParked] = useState<ParkedView | null>(() => readParked());
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tripRef = useRef<TripState>(emptyTrip());

  useEffect(() => {
    let cancelled = false;
    let settle: ReturnType<typeof setInterval> | null = null;
    let cleanup: (() => Promise<void>) | null = null;

    const apply = (mac: string | null) => {
      const r = tick(tripRef.current, Date.now(), mac);
      tripRef.current = r.trip;
      if (r.parked) {
        writeParked(r.parked);
        setParked(readParked());
      }
    };

    (async () => {
      const handle = await startBeaconScanner({
        onBeacon: (mac) => {
          if (cancelled) return;
          apply(mac);
        },
        onError: (msg) => {
          if (cancelled) return;
          setError(msg);
          setScanning(false);
        },
      });
      if (cancelled) {
        await handle.stop();
        return;
      }
      cleanup = handle.stop;
      setScanning(true);
      settle = setInterval(() => apply(null), SETTLE_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (settle) clearInterval(settle);
      void cleanup?.();
    };
  }, []);

  return { parked, scanning, error };
}
