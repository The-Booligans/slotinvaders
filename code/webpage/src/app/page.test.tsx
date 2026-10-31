import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Page from "./page";

const liveStand = (id: string, areaName: string, max: number, free: number) => ({
  id,
  name: `${areaName}, Stand 1`,
  areaId: id.replace(/-1$/, ""),
  areaName,
  currentOccupancy: max - free,
  maxOccupancy: max,
  free,
  stale: false,
  updatedAt: "2026-10-31T19:00:00.000Z",
});

function stubFetch(body?: unknown) {
  const fetch = vi.fn((_url: string) =>
    body === undefined
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ ok: true, json: () => Promise.resolve(body) }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("Landing page", () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the hero headline", () => {
    render(<Page />);
    expect(
      screen.getByRole("heading", { level: 1, name: /make finding a velo spot easy/i }),
    ).toBeDefined();
  });

  it("lists the 6 catalog areas with their slots before live data arrives", () => {
    render(<Page />);
    const areas = [
      { name: "Flow Main", slots: "40 slots" },
      { name: "Sternenhof", slots: "30 slots" },
      { name: "Flow Garage South", slots: "30 slots" },
      { name: "Flow South West", slots: "20 slots" },
      { name: "Flow South East", slots: "10 slots" },
      { name: "Flow Garage North", slots: "20 slots" },
    ];
    for (const area of areas) {
      expect(screen.getByText(area.name)).toBeDefined();
    }
    expect(screen.getAllByText("40 slots")).toHaveLength(1);
    expect(screen.getAllByText("30 slots")).toHaveLength(2);
    expect(screen.getAllByText("20 slots")).toHaveLength(2);
    expect(screen.getAllByText("10 slots")).toHaveLength(1);
    expect(screen.getAllByText("No data")).toHaveLength(6);
  });

  it("shows live counts from GET /api/v1/stands", async () => {
    const fetch = stubFetch({
      at: "2026-10-31T19:00:05.000Z",
      stands: [
        liveStand("flow-main-1", "Flow Main", 40, 12),
        liveStand("flow-se-1", "Flow South East", 10, 0),
        liveStand("flow-sw-1", "Flow South West", 20, 2),
      ],
    });
    render(<Page />);
    expect(await screen.findByText("12 / 40 free")).toBeDefined();
    expect(screen.getByText("0 / 10")).toBeDefined();
    expect(screen.getByText("Full")).toBeDefined();
    expect(screen.getByText("2 / 20 free")).toBeDefined();
    expect(screen.getByText("• Low")).toBeDefined();
    expect(String(fetch.mock.calls[0]?.[0])).toMatch(/\/api\/v1\/stands$/);
  });

  it("has a live counts section with every stand", () => {
    render(<Page />);
    expect(
      screen.getByRole("heading", { level: 2, name: /every stand on the campus/i }),
    ).toBeDefined();
  });

  it("renders the three feature cards", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 3, name: /just the info/i })).toBeDefined();
    expect(screen.getByRole("heading", { level: 3, name: /remembers your bike/i })).toBeDefined();
    expect(screen.getByRole("heading", { level: 3, name: /rank up/i })).toBeDefined();
  });

  it("renders the device, architecture, privacy and team sections", () => {
    render(<Page />);
    expect(
      screen.getByRole("heading", { level: 2, name: /lidar or on-device yolo/i }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: /ten sensors/i })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: /no faces, no plates/i })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: /the booligans/i })).toBeDefined();
  });

  it("lists every team member", () => {
    render(<Page />);
    for (const name of [
      "Dobrawa Kiefer",
      "Nila Mönig",
      "Artur Semenenko",
      "Luca Rullo",
      "Samuel Rink",
      "Valentino Rusconi",
      "David Übelacker",
    ]) {
      expect(screen.getByText(name)).toBeDefined();
    }
  });

  it("links to the source repository", () => {
    render(<Page />);
    const repoLinks = screen.getAllByRole("link", { name: /github/i });
    expect(repoLinks[0].getAttribute("href")).toBe("https://github.com/The-Booligans/slotinvaders");
  });
});
