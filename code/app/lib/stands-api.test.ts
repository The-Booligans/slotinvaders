import { describe, expect, it } from "vitest";
import { parseStandsMessage } from "./stands-api";

// a real message from the backend, 2026-10-31
const sample = {
  type: "stands",
  at: "2026-10-31T14:48:35.910Z",
  stands: [
    { id: "cmr-ost-1", name: "Christoph Merian-Ring – Ost, Stand 1", areaId: "cmr-ost", areaName: "Christoph Merian-Ring – Ost", currentOccupancy: 0, maxOccupancy: 20, free: 20, stale: true, updatedAt: null },
    { id: "kaegen-hof-1", name: "Kägenstrasse 2 – Hof, Stand 1", areaId: "kaegen-hof", areaName: "Kägenstrasse 2 – Hof", currentOccupancy: 8, maxOccupancy: 40, free: 32, stale: true, updatedAt: "2026-10-31T14:48:30.925Z" },
  ],
};

describe("parseStandsMessage", () => {
  it("accepts a stands message", () => {
    expect(parseStandsMessage(JSON.stringify(sample))).toEqual(sample);
  });

  it.each([
    ["not json", "{"],
    ["another type", JSON.stringify({ ...sample, type: "area" })],
    ["a broken stand", JSON.stringify({ ...sample, stands: [{ ...sample.stands[0], free: "20" }] })],
    ["null", "null"],
  ])("rejects %s", (_, raw) => {
    expect(parseStandsMessage(raw)).toBeNull();
  });
});
