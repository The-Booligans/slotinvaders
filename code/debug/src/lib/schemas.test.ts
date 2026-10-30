import { describe, expect, it } from "vitest";
import {
  DebugImage,
  DebugSnapshot,
  Device,
  DeviceLogs,
  LogEntry,
  PublicConfig,
} from "./schemas";

describe("Device", () => {
  it("accepts a valid device", () => {
    expect(() =>
      Device.parse({ id: "cam-01", stand: "fsw-1", hardware: "esp32-cam", mode: "device" }),
    ).not.toThrow();
  });

  it("rejects an unknown mode", () => {
    expect(() =>
      Device.parse({ id: "cam-01", stand: "fsw-1", hardware: "esp32-cam", mode: "fog" }),
    ).toThrow();
  });
});

describe("LogEntry", () => {
  it("defaults source to 'api'", () => {
    const parsed = LogEntry.parse({
      at: "2026-10-30T07:42:10Z",
      deviceId: "cam-01",
      level: "info",
      message: "boot complete",
    });
    expect(parsed.source).toBe("api");
  });

  it("accepts context as a free-form record", () => {
    const parsed = LogEntry.parse({
      at: "2026-10-30T07:42:10Z",
      deviceId: "cam-01",
      level: "error",
      message: "nope",
      context: { code: 500, reason: "cosmos" },
    });
    expect(parsed.context).toEqual({ code: 500, reason: "cosmos" });
  });
});

describe("DebugImage", () => {
  it("defaults mimeType to image/jpeg", () => {
    const parsed = DebugImage.parse({
      deviceId: "cam-02",
      receivedAt: "2026-10-30T07:42:10Z",
      seq: 42,
      url: "https://example.test/frame.jpg",
    });
    expect(parsed.mimeType).toBe("image/jpeg");
  });

  it("rejects seq below zero", () => {
    expect(() =>
      DebugImage.parse({
        deviceId: "cam-02",
        receivedAt: "2026-10-30T07:42:10Z",
        seq: -1,
        url: "x",
      }),
    ).toThrow();
  });
});

describe("DebugSnapshot", () => {
  it("round-trips a minimal snapshot", () => {
    const parsed = DebugSnapshot.parse({
      at: "2026-10-30T07:42:11Z",
      devices: [
        {
          device: { id: "cam-01", stand: "fsw-1", hardware: "esp32-cam", mode: "device" },
          lastImage: null,
          lastSeenAt: null,
          stale: true,
        },
      ],
    });
    expect(parsed.devices).toHaveLength(1);
    expect(parsed.devices[0].lastImage).toBeNull();
  });
});

describe("DeviceLogs", () => {
  it("accepts an empty entries list", () => {
    expect(DeviceLogs.parse({ deviceId: "cam-01", entries: [] }).entries).toEqual([]);
  });
});

describe("PublicConfig", () => {
  it("accepts the example from the architecture", () => {
    const config = {
      version: 1,
      site: { id: "reinach", name: "Endress+Hauser Reinach", timezone: "Europe/Zurich" },
      areas: [{ id: "flow-sw", name: "Flow South West", kind: "covered" as const }],
      stands: [{ id: "fsw-1", area: "flow-sw", slots: 20 }],
      devices: [
        { id: "cam-01", stand: "fsw-1", hardware: "esp32-cam", mode: "device" as const },
      ],
    };
    expect(() => PublicConfig.parse(config)).not.toThrow();
  });

  it("rejects stand slots below 1", () => {
    expect(() =>
      PublicConfig.parse({
        version: 1,
        site: { id: "s", name: "s", timezone: "UTC" },
        areas: [{ id: "a", name: "A", kind: "open" }],
        stands: [{ id: "s1", area: "a", slots: 0 }],
        devices: [],
      }),
    ).toThrow();
  });
});
