// Thin, platform-aware wrapper around @capacitor-community/bluetooth-le.
//
// On iOS and Android we scan continuously and surface every known beacon MAC
// via `onBeacon`. On the web and in tests the module shape is identical but
// `start` resolves to a no-op cleanup, so callers don't need to branch.

import { Capacitor } from "@capacitor/core";
import { CAMPUS_BEACONS, findBeacon, normalizeMac } from "./bike-location";

export interface BeaconScannerOptions {
  /** Called for every scan hit that matches a configured beacon. */
  onBeacon: (mac: string) => void;
  /** Called when the scanner cannot run — permissions, bluetooth off, etc. */
  onError?: (message: string) => void;
}

export interface BeaconScannerHandle {
  stop: () => Promise<void>;
}

const NOOP: BeaconScannerHandle = { stop: async () => {} };

export async function startBeaconScanner(opts: BeaconScannerOptions): Promise<BeaconScannerHandle> {
  if (!Capacitor.isNativePlatform()) return NOOP;

  // Lazy-import so the web build doesn't pull in the native plugin JS.
  const { BleClient } = await import("@capacitor-community/bluetooth-le");
  try {
    await BleClient.initialize({ androidNeverForLocation: true });
  } catch (e) {
    opts.onError?.(e instanceof Error ? e.message : "Bluetooth init failed");
    return NOOP;
  }

  const macs = new Set(CAMPUS_BEACONS.map((b) => normalizeMac(b.mac)));
  try {
    await BleClient.requestLEScan({ allowDuplicates: true }, (result) => {
      // deviceId is a MAC on Android and a UUID on iOS; both work as a lookup
      // key because findBeacon normalises hex and iOS's CoreBluetooth UUID is
      // stable per device.
      const id = result.device?.deviceId ?? "";
      if (!id) return;
      const match = findBeacon(id);
      if (match && macs.has(normalizeMac(match.mac))) opts.onBeacon(match.mac);
    });
  } catch (e) {
    opts.onError?.(e instanceof Error ? e.message : "Bluetooth scan refused");
    return NOOP;
  }

  return {
    stop: async () => {
      try {
        await BleClient.stopLEScan();
      } catch {
        // Harmless on teardown.
      }
    },
  };
}
