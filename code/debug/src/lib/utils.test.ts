import { describe, expect, it } from "vitest";
import { cn, formatTimestamp, relativeTime } from "./utils";

describe("cn", () => {
  it("merges class names and dedupes tailwind conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe("text-sm font-bold");
  });
});

describe("formatTimestamp", () => {
  it("returns a locale-formatted string for a valid ISO date", () => {
    const out = formatTimestamp("2026-10-30T12:34:56Z");
    expect(out).toMatch(/\d/);
    expect(out).not.toBe("2026-10-30T12:34:56Z");
  });

  it("returns the input unchanged when it is not a date", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-10-30T12:00:00Z");

  it.each([
    [0, "just now"],
    [3, "just now"],
    [30, "30s ago"],
    [60 * 5, "5m ago"],
    [3600 * 3, "3h ago"],
    [86400 * 2, "2d ago"],
  ])("formats %i seconds ago as %s", (secondsAgo, expected) => {
    const past = new Date(now.getTime() - secondsAgo * 1000).toISOString();
    expect(relativeTime(past, now)).toBe(expected);
  });

  it("returns the input unchanged for an invalid date", () => {
    expect(relativeTime("nope", now)).toBe("nope");
  });
});
