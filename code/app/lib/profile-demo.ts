// Mock data for the Profile tab preview. Nothing here is real or tracked.

export type LeaderboardEntry = { name: string; rides: number; isYou?: boolean };

export type DemoProfile = {
  name: string;
  memberSince: string;
  totalRides: number;
  kmPerRide: number;
  streakDays: number;
  /** Days ridden to work in each of the last weeks, oldest first. */
  weeklyBikeDays: number[];
  registeredRiders: number;
  leaderboard: LeaderboardEntry[];
  badges: { label: string; emoji: string; earned: boolean }[];
};

export const DEMO_PROFILE: DemoProfile = {
  name: "Alex Rider",
  memberSince: "March 2026",
  totalRides: 142,
  kmPerRide: 4.2,
  streakDays: 9,
  weeklyBikeDays: [3, 4, 2, 5, 4, 3, 4, 5],
  registeredRiders: 312,
  leaderboard: [
    { name: "Sam K.", rides: 201 },
    { name: "Mia L.", rides: 188 },
    { name: "Jonas B.", rides: 171 },
    { name: "Lea W.", rides: 150 },
    { name: "Alex R.", rides: 142, isYou: true },
  ],
  badges: [
    { label: "First ride", emoji: "🚲", earned: true },
    { label: "Early bird", emoji: "🌅", earned: true },
    { label: "Rain rider", emoji: "🌧️", earned: true },
    { label: "100 rides", emoji: "💯", earned: true },
    { label: "Full week", emoji: "📅", earned: false },
  ],
};

export function averageDaysPerWeek(weeks: number[]): number {
  if (weeks.length === 0) return 0;
  const sum = weeks.reduce((total, days) => total + days, 0);
  return Math.round((sum / weeks.length) * 10) / 10;
}

export function leaderboardRank(entries: LeaderboardEntry[]): number | null {
  const sorted = [...entries].sort((a, b) => b.rides - a.rides);
  const index = sorted.findIndex((entry) => entry.isYou);
  return index === -1 ? null : index + 1;
}

/** "Top N %" among all registered riders, at least 1. */
export function topPercent(rank: number, total: number): number {
  if (total <= 0) return 100;
  return Math.max(1, Math.ceil((rank / total) * 100));
}

// ~120 g CO₂ per km for an average car trip that the ride replaced.
export function co2SavedKg(rides: number, kmPerRide: number): number {
  return Math.round(rides * kmPerRide * 0.12);
}
