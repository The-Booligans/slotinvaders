import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DebugView } from "./debug-view";

const snapshot = {
  at: new Date().toISOString(),
  devices: [
    {
      device: { id: "cam-01", stand: "fsw-1", hardware: "esp32-cam", mode: "device" },
      lastImage: null,
      lastSeenAt: null,
      stale: false,
    },
  ],
};

function stubFetch(impl: (url: string) => Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => impl(url)),
  );
}

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe("DebugView", () => {
  it("renders the heading and device count after fetching the snapshot", async () => {
    stubFetch(async () => okResponse(snapshot));
    render(<DebugView />);
    await waitFor(() => {
      expect(screen.getByText(/Velo Stands · ESP32 debug/)).toBeDefined();
      expect(screen.getByText(/All devices \(1\)/)).toBeDefined();
    });
  });

  it("shows the offline error when the API fails", async () => {
    stubFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }) as Response);
    render(<DebugView />);
    await waitFor(() => {
      expect(screen.getByText(/Cannot reach the API/)).toBeDefined();
    });
  });
});
