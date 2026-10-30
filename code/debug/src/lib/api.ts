import {
  DebugSnapshot,
  DeviceLogs,
  PublicConfig,
  type DebugSnapshot as DebugSnapshotT,
  type DeviceLogs as DeviceLogsT,
  type PublicConfig as PublicConfigT,
} from "./schemas";

const BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "http://localhost:7071";

async function getJson<T>(path: string, parser: (data: unknown) => T): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return parser(await res.json());
}

export const api = {
  config: () => getJson<PublicConfigT>("/api/v1/config", (d) => PublicConfig.parse(d)),

  debugSnapshot: () =>
    getJson<DebugSnapshotT>("/api/v1/debug/devices", (d) => DebugSnapshot.parse(d)),

  deviceLogs: (deviceId: string, limit = 200) =>
    getJson<DeviceLogsT>(
      `/api/v1/debug/devices/${encodeURIComponent(deviceId)}/logs?limit=${limit}`,
      (d) => DeviceLogs.parse(d),
    ),
};
