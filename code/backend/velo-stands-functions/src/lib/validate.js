"use strict";

// Checks the JSON body of POST /api/v1/readings.
//
//   { "occupied": 9, "seq": 1842, "measuredAt": "2026-10-31T07:42:10Z", "fw": "0.3.1", "rssi": -61 }
//
// occupied and seq are required. Unknown fields are refused, so the body can
// never carry anything else (images go through /images, which never stores them).

const ALLOWED_FIELDS = new Set(["occupied", "seq", "measuredAt", "fw", "rssi"]);

/**
 * @param {unknown} body   parsed JSON
 * @param {number} slots   capacity of the device's stand
 * @returns {{ ok: true, value: {occupied:number, seq:number, measuredAt?:string, fw?:string, rssi?:number} } | { ok: false, errors: string[] }}
 */
function validateReading(body, slots) {
  const errors = [];
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }

  for (const field of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(field)) errors.push(`unknown field "${field}"`);
  }

  const { occupied, seq, measuredAt, fw, rssi } = body;

  if (!Number.isInteger(occupied)) errors.push("occupied must be a whole number");
  else if (occupied < 0) errors.push("occupied can't be negative");
  else if (occupied > slots) errors.push(`occupied (${occupied}) is more than the stand's ${slots} slots`);

  if (!Number.isSafeInteger(seq) || seq < 0) errors.push("seq must be a whole number of 0 or more");

  if (measuredAt !== undefined) {
    if (typeof measuredAt !== "string" || Number.isNaN(Date.parse(measuredAt))) {
      errors.push("measuredAt must be an ISO 8601 date and time");
    }
  }
  if (fw !== undefined && (typeof fw !== "string" || fw.length > 40)) {
    errors.push("fw must be a text of at most 40 characters");
  }
  if (rssi !== undefined && (!Number.isInteger(rssi) || rssi < -150 || rssi > 0)) {
    errors.push("rssi must be a whole number between -150 and 0");
  }

  if (errors.length) return { ok: false, errors };

  const value = { occupied, seq };
  if (measuredAt !== undefined) value.measuredAt = new Date(measuredAt).toISOString();
  if (fw !== undefined) value.fw = fw;
  if (rssi !== undefined) value.rssi = rssi;
  return { ok: true, value };
}

module.exports = { validateReading, ALLOWED_FIELDS };
