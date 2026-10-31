// Live stand status pushed by the backend over Web PubSub.
// Same body as GET /api/v1/stands, plus `type`. See code/backend/velo-stands-functions/README.md.

export interface StandStatus {
  id: string;
  name: string;
  areaId: string;
  areaName: string;
  /** bikes counted now; can exceed maxOccupancy when two sensors see one bike */
  currentOccupancy: number;
  maxOccupancy: number;
  free: number;
  /** a sensor of the stand never reported or has been quiet for > 5 min */
  stale: boolean;
  /** latest sensor report, ISO 8601, or null if none ever reported */
  updatedAt: string | null;
}

export interface StandsMessage {
  type: "stands";
  at: string;
  stands: StandStatus[];
}

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://func-velostands-37sp3n5axfjna.azurewebsites.net";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";

function isStandStatus(v: unknown): v is StandStatus {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    isStr(s.id) &&
    isStr(s.name) &&
    isStr(s.areaId) &&
    isStr(s.areaName) &&
    isNum(s.currentOccupancy) &&
    isNum(s.maxOccupancy) &&
    isNum(s.free) &&
    typeof s.stale === "boolean" &&
    (s.updatedAt === null || isStr(s.updatedAt))
  );
}

/** The message, or null if it isn't a well-formed stands message. */
export function parseStandsMessage(raw: string): StandsMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.type !== "stands" || !isStr(m.at) || !Array.isArray(m.stands)) return null;
  if (!m.stands.every(isStandStatus)) return null;
  return { type: "stands", at: m.at, stands: m.stands };
}
