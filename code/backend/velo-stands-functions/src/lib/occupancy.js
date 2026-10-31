"use strict";

/**
 * Adds up a stand from the latest count of every device assigned to it.
 *
 *   free = max(0, slots - sum of the devices' counts)
 *
 * Clamped at 0 because two devices can both see a bike on their shared edge.
 * A device that never reported counts as 0 and is listed under `missing`.
 * A device whose last report is older than staleAfterSeconds is listed under `stale`.
 *
 * @param {object} args
 * @param {number} args.slots
 * @param {string[]} args.deviceIds        devices currently assigned to the stand
 * @param {Record<string, {occupied:number, at:string}>} args.devices  latest state per device
 * @param {Date} args.now
 * @param {number} args.staleAfterSeconds
 */
function computeStand({ slots, deviceIds, devices, now, staleAfterSeconds }) {
  const parts = [];
  const missing = [];
  const stale = [];
  let occupied = 0;

  for (const deviceId of deviceIds) {
    const latest = devices[deviceId];
    if (!latest) {
      missing.push(deviceId);
      parts.push({ deviceId, occupied: null });
      continue;
    }
    occupied += latest.occupied;
    parts.push({ deviceId, occupied: latest.occupied });
    const ageSeconds = (now.getTime() - Date.parse(latest.at)) / 1000;
    if (ageSeconds > staleAfterSeconds) stale.push(deviceId);
  }

  return {
    slots,
    occupied,
    free: Math.max(0, slots - occupied),
    overCapacity: occupied > slots,
    parts,
    missing,
    stale,
  };
}

/** "thor=9 + probe=12 (never reported)" for the log. */
function describeParts(parts) {
  return parts
    .map((p) => (p.occupied === null ? `${p.deviceId}=0 (never reported)` : `${p.deviceId}=${p.occupied}`))
    .join(" + ");
}

module.exports = { computeStand, describeParts };
