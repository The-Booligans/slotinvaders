import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DeviceImage } from "./device-image";
import type { DebugDeviceSummary } from "@/lib/schemas";

const base: DebugDeviceSummary = {
  device: { id: "cam-01", stand: "fsw-1", hardware: "esp32-cam", mode: "device" },
  lastImage: null,
  lastSeenAt: null,
  stale: false,
};

afterEach(cleanup);

describe("DeviceImage", () => {
  it("shows the device id and hardware", () => {
    render(<DeviceImage summary={base} />);
    expect(screen.getByText("cam-01")).toBeDefined();
    expect(screen.getByText(/esp32-cam/)).toBeDefined();
  });

  it("renders a placeholder when there is no image", () => {
    render(<DeviceImage summary={base} />);
    expect(screen.getByText(/device-mode: no image uploaded/)).toBeDefined();
  });

  it("renders the image and metadata when provided", () => {
    render(
      <DeviceImage
        summary={{
          ...base,
          device: { ...base.device, mode: "cloud" },
          lastImage: {
            deviceId: "cam-01",
            receivedAt: new Date().toISOString(),
            seq: 123,
            occupied: 8,
            deviceCount: 9,
            meanConfidence: 0.87,
            url: "https://example.test/frame.jpg",
            mimeType: "image/jpeg",
          },
        }}
      />,
    );
    const img = screen.getByAltText("Last frame from cam-01") as HTMLImageElement;
    expect(img.src).toBe("https://example.test/frame.jpg");
    expect(screen.getByText("#123")).toBeDefined();
    expect(screen.getByText("87.0%")).toBeDefined();
  });

  it("renders a stale badge when stale is true", () => {
    render(<DeviceImage summary={{ ...base, stale: true }} />);
    expect(screen.getByText("stale")).toBeDefined();
  });
});
