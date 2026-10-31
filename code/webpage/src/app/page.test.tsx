import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Page from "./page";

describe("Landing page", () => {
  it("renders the hero headline", () => {
    render(<Page />);
    expect(
      screen.getByRole("heading", { level: 1, name: /make finding a velo spot easy/i }),
    ).toBeDefined();
  });

  it("renders all 6 parking areas with their counts", () => {
    render(<Page />);
    const areas = [
      { name: "Haupteingang", count: "12 / 20 free" },
      { name: /Reinach-S[uü]d/i, count: "7 / 15 free" },
      { name: "Reinach-Nord", count: "3 / 18 free" },
      { name: "Werkseingang", count: "0 / 12" },
      { name: "Besucher", count: "9 / 10 free" },
      { name: "Kantine", count: "4 / 8 free" },
    ];
    for (const area of areas) {
      expect(screen.getByText(area.name)).toBeDefined();
      expect(screen.getByText(area.count)).toBeDefined();
    }
  });

  it("marks Werkseingang as full", () => {
    render(<Page />);
    expect(screen.getByText("Full")).toBeDefined();
  });

  it("shows the Map tab as coming soon", () => {
    render(<Page />);
    expect(screen.getByText(/coming soon/i)).toBeDefined();
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
      screen.getByRole("heading", { level: 2, name: /esp32, solar-powered, lorawan/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { level: 2, name: /six sensors/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { level: 2, name: /no faces, no plates/i }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: /the booligans/i })).toBeDefined();
  });

  it("lists every team member", () => {
    render(<Page />);
    for (const name of [
      "Dobrawa Kiefer",
      "Nila M.",
      "Artur Semenko",
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
