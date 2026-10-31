import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

const snapshot = {
  at: "2026-10-30T07:42:11Z",
  devices: [
    {
      device: { id: "cam-01", stand: "fsw-1", hardware: "esp32-cam", mode: "device" },
      lastImage: null,
      lastSeenAt: null,
      stale: false,
    },
  ],
};

function mockFetch(body: unknown, { ok = true, status = 200 } = {}) {
  const fn = vi.fn(
    async (_input: string, _init?: RequestInit) =>
      ({ ok, status, json: async () => body }) as Response,
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("api", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and parses the debug snapshot", async () => {
    const fetchMock = mockFetch(snapshot);
    const result = await api.debugSnapshot();
    expect(result.devices[0].device.id).toBe("cam-01");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/debug\/devices$/);
  });

  it("passes the limit as a query param on deviceLogs", async () => {
    const fetchMock = mockFetch({ deviceId: "cam-01", entries: [] });
    await api.deviceLogs("cam-01", 50);
    expect(fetchMock.mock.calls[0][0]).toMatch(
      /\/api\/v1\/debug\/devices\/cam-01\/logs\?limit=50$/,
    );
  });

  it("url-encodes the device id", async () => {
    const fetchMock = mockFetch({ deviceId: "cam/01", entries: [] });
    await api.deviceLogs("cam/01");
    expect(fetchMock.mock.calls[0][0]).toContain("cam%2F01");
  });

  it("throws on non-ok responses", async () => {
    mockFetch({}, { ok: false, status: 503 });
    await expect(api.debugSnapshot()).rejects.toThrow(/503/);
  });

  it("throws when the response fails schema validation", async () => {
    mockFetch({ at: "x", devices: "not-an-array" });
    await expect(api.debugSnapshot()).rejects.toThrow();
  });
});
