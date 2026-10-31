import type { Parked } from "./bike-location";
import { findBeacon } from "./bike-location";

const KEY = "slotinvaders.parkedBike.v1";

/** Durable "where I parked" record. Only the MAC is stored; the config stays
 *  the single source of truth so stand renames don't require a migration. */
export interface StoredParked {
  mac: string;
  at: number;
  dwellMs: number;
}

export interface ParkedView {
  mac: string;
  standId: string;
  standName: string;
  areaId: string;
  areaName: string;
  at: number;
  dwellMs: number;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Private-mode or disabled storage; nothing we can do but skip.
    return null;
  }
}

export function readParked(): ParkedView | null {
  const raw = storage()?.getItem(KEY);
  if (!raw) return null;
  let parsed: StoredParked;
  try {
    parsed = JSON.parse(raw) as StoredParked;
  } catch {
    return null;
  }
  const beacon = findBeacon(parsed.mac);
  if (!beacon) return null;
  return {
    mac: parsed.mac,
    standId: beacon.standId,
    standName: beacon.standName,
    areaId: beacon.areaId,
    areaName: beacon.areaName,
    at: parsed.at,
    dwellMs: parsed.dwellMs,
  };
}

export function writeParked(parked: Parked): void {
  const s = storage();
  if (!s) return;
  const payload: StoredParked = {
    mac: parked.beacon.mac,
    at: parked.at,
    dwellMs: parked.dwellMs,
  };
  try {
    s.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or disabled; we drop the write silently.
  }
}

export function clearParked(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(KEY);
  } catch {
    // Ignore storage errors.
  }
}
