import { z } from "zod";

export const DeviceMode = z.enum(["device", "cloud"]);
export type DeviceMode = z.infer<typeof DeviceMode>;

export const Device = z.object({
  id: z.string(),
  stand: z.string(),
  hardware: z.string(),
  mode: DeviceMode,
});
export type Device = z.infer<typeof Device>;

export const Area = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["covered", "inside", "open"]),
});
export type Area = z.infer<typeof Area>;

export const Stand = z.object({
  id: z.string(),
  area: z.string(),
  name: z.string().optional(),
  slots: z.number().int().min(1),
});
export type Stand = z.infer<typeof Stand>;

export const PublicConfig = z.object({
  version: z.literal(1),
  site: z.object({ id: z.string(), name: z.string(), timezone: z.string() }),
  areas: z.array(Area),
  stands: z.array(Stand),
  devices: z.array(Device),
});
export type PublicConfig = z.infer<typeof PublicConfig>;

export const LogLevel = z.enum(["debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevel>;

export const LogEntry = z.object({
  at: z.string(),
  deviceId: z.string(),
  level: LogLevel,
  source: z.enum(["device", "cloud", "api"]).default("api"),
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
});
export type LogEntry = z.infer<typeof LogEntry>;

export const DebugImage = z.object({
  deviceId: z.string(),
  receivedAt: z.string(),
  seq: z.number().int().nonnegative(),
  occupied: z.number().int().nonnegative().optional(),
  deviceCount: z.number().int().nonnegative().optional(),
  meanConfidence: z.number().min(0).max(1).optional(),
  url: z.string(),
  mimeType: z.string().default("image/jpeg"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type DebugImage = z.infer<typeof DebugImage>;

export const DebugDeviceSummary = z.object({
  device: Device,
  lastImage: DebugImage.nullable(),
  lastSeenAt: z.string().nullable(),
  stale: z.boolean(),
});
export type DebugDeviceSummary = z.infer<typeof DebugDeviceSummary>;

export const DebugSnapshot = z.object({
  at: z.string(),
  devices: z.array(DebugDeviceSummary),
});
export type DebugSnapshot = z.infer<typeof DebugSnapshot>;

export const DeviceLogs = z.object({
  deviceId: z.string(),
  entries: z.array(LogEntry),
});
export type DeviceLogs = z.infer<typeof DeviceLogs>;
