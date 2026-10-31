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
    expect(screen.getByText(/no image uploaded/)).toBeDefined();
  });

  it("renders the image and metadata when provided", () => {
    render(
      <DeviceImage
        summary={{
          ...base,
          lastImage: {
            deviceId: "cam-01",
            receivedAt: new Date().toISOString(),
            seq: 123,
            deviceCount: 9,
            url: "https://example.test/frame.jpg",
            mimeType: "image/jpeg",
          },
        }}
      />,
    );
    const img = screen.getByAltText("Last frame from cam-01") as HTMLImageElement;
    expect(img.src).toBe("https://example.test/frame.jpg");
    expect(screen.getByText("#123")).toBeDefined();
    expect(screen.getByText("9")).toBeDefined();
    const download = screen.getByLabelText("Download frame #123 from cam-01") as HTMLAnchorElement;
    expect(download.href).toBe("https://example.test/frame.jpg");
    expect(download.getAttribute("download")).toBe("cam-01-123.jpg");
  });

  it("renders a stale badge when stale is true", () => {
    render(<DeviceImage summary={{ ...base, stale: true }} />);
    expect(screen.getByText("stale")).toBeDefined();
  });

  it("names an SVG download with the .svg extension", () => {
    render(
      <DeviceImage
        summary={{
          ...base,
          lastImage: {
            deviceId: "cam-01",
            receivedAt: new Date().toISOString(),
            seq: 7,
            url: "https://example.test/frame.svg",
            mimeType: "image/svg+xml",
          },
        }}
      />,
    );
    const download = screen.getByLabelText("Download frame #7 from cam-01") as HTMLAnchorElement;
    expect(download.getAttribute("download")).toBe("cam-01-7.svg");
  });
});
