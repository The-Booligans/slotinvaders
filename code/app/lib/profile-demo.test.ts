import { describe, expect, it } from "vitest";
import {
  averageDaysPerWeek,
  co2SavedKg,
  DEMO_PROFILE,
  leaderboardRank,
  topPercent,
} from "./profile-demo";

describe("averageDaysPerWeek", () => {
  it("averages and rounds to one decimal", () => {
    expect(averageDaysPerWeek([3, 4, 4])).toBe(3.7);
  });

  it("is 0 without weeks", () => {
    expect(averageDaysPerWeek([])).toBe(0);
  });
});

describe("leaderboardRank", () => {
  it("ranks the current user by rides", () => {
    expect(
      leaderboardRank([
        { name: "a", rides: 5, isYou: true },
        { name: "b", rides: 9 },
        { name: "c", rides: 1 },
      ]),
    ).toBe(2);
  });

  it("is null when the user is not listed", () => {
    expect(leaderboardRank([{ name: "a", rides: 5 }])).toBeNull();
  });
});

describe("topPercent", () => {
  it("rounds up to a whole percent", () => {
    expect(topPercent(5, 312)).toBe(2);
  });

  it("never goes below 1 %", () => {
    expect(topPercent(1, 1000)).toBe(1);
  });

  it("handles no riders", () => {
    expect(topPercent(1, 0)).toBe(100);
  });
});

describe("co2SavedKg", () => {
  it("uses 120 g per km", () => {
    expect(co2SavedKg(10, 5)).toBe(6);
  });
});

describe("DEMO_PROFILE", () => {
  it("lists the user on the leaderboard", () => {
    expect(leaderboardRank(DEMO_PROFILE.leaderboard)).toBe(5);
  });

  it("ranks the Booligans team around the user", () => {
    const names = DEMO_PROFILE.leaderboard.filter((e) => !e.isYou).map((e) => e.name);
    expect(names).toHaveLength(7);
    expect(names).toContain("Artur Semenenko");
  });

  it("has at most 5 bike days per work week", () => {
    expect(DEMO_PROFILE.weeklyBikeDays.every((d) => d >= 0 && d <= 5)).toBe(true);
  });
});
