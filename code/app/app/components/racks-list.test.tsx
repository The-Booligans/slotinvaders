import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ParkingSpot } from "@/lib/parking";
import { RacksList } from "./racks-list";

const spot = (id: string, patch: Partial<ParkingSpot> = {}): ParkingSpot => ({
  id,
  name: `Area ${id}`,
  capacity: 20,
  occupied: 5,
  free: 15,
  stale: false,
  updatedAt: "2026-10-31T14:48:00Z",
  position: [0, 0],
  distanceM: 160,
  ...patch,
});

const render = (spots: ParkingSpot[], status: "live" | "offline" = "live") =>
  renderToStaticMarkup(
    <RacksList spots={spots} at="2026-10-31T14:50:00Z" status={status} onSelect={() => {}} />,
  );

describe("RacksList", () => {
  it("lists every rack in the given order with its count", () => {
    const html = render([spot("a"), spot("b")]);
    expect(html).toContain("All racks · 2");
    expect(html.indexOf("Area a")).toBeLessThan(html.indexOf("Area b"));
  });

  it("shows the same details as the map cards", () => {
    const html = render([spot("a")]);
    expect(html).toContain("25%");
    expect(html).toContain("Mostly free");
    expect(html).toContain("15 free");
    expect(html).toContain("2 min");
    expect(html).toContain("Updated 2 min ago");
  });

  it("renders cards at full size, without carousel selection state", () => {
    const html = render([spot("a")]);
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("scale-95");
  });

  it("shows a waiting hint before data arrives", () => {
    expect(render([])).toContain("Waiting for live data…");
    expect(render([], "offline")).toContain("Can’t reach the server, retrying…");
  });
});
