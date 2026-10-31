import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ParkingSpot } from "@/lib/parking";
import { RackCard } from "./rack-card";

const spot = (id: string): ParkingSpot => ({
  id,
  name: `Area ${id}`,
  capacity: 20,
  occupied: 5,
  free: 15,
  stale: false,
  updatedAt: "2026-10-31T14:48:00Z",
  position: [0, 0],
  distanceM: 160,
});

const render = (id: string, onShowPhoto?: () => void) =>
  renderToStaticMarkup(
    <RackCard spot={spot(id)} at="2026-10-31T14:50:00Z" onClick={() => {}} onShowPhoto={onShowPhoto} />,
  );

describe("RackCard photo button", () => {
  it("shows for a rack with a photo when a handler is given", () => {
    expect(render("flow-main", () => {})).toContain("Show photo of Area flow-main");
  });

  it("is hidden without a handler", () => {
    expect(render("flow-main")).not.toContain("Show photo of");
  });

  it("is hidden for a rack without a photo", () => {
    expect(render("unknown", () => {})).not.toContain("Show photo of");
  });
});
