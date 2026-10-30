import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DeviceLogs } from "./device-logs";
import type { LogEntry } from "@/lib/schemas";

const entries: LogEntry[] = [
  {
    at: "2026-10-30T07:42:10Z",
    deviceId: "cam-01",
    level: "info",
    source: "device",
    message: "boot complete",
  },
  {
    at: "2026-10-30T07:42:12Z",
    deviceId: "cam-01",
    level: "error",
    source: "api",
    message: "upload failed",
    context: { status: 500 },
  },
];

afterEach(cleanup);

describe("DeviceLogs", () => {
  it("renders each entry message and level", () => {
    render(<DeviceLogs entries={entries} />);
    expect(screen.getByText(/boot complete/)).toBeDefined();
    expect(screen.getByText(/upload failed/)).toBeDefined();
    expect(screen.getByText("info")).toBeDefined();
    expect(screen.getByText("error")).toBeDefined();
  });

  it("serializes context inline", () => {
    render(<DeviceLogs entries={[entries[1]]} />);
    expect(screen.getByText(/"status":500/)).toBeDefined();
  });

  it("shows an empty state when there are no entries", () => {
    render(<DeviceLogs entries={[]} />);
    expect(screen.getByText(/no log entries/)).toBeDefined();
  });

  it("shows a loading hint instead of the count", () => {
    render(<DeviceLogs entries={[]} loading />);
    expect(screen.getByText(/loading/)).toBeDefined();
  });

  it("renders the error block when error is set", () => {
    render(<DeviceLogs entries={[]} error="boom" />);
    expect(screen.getByText("boom")).toBeDefined();
  });
});
