"use client";

import { useEffect, useState } from "react";

/** One row per stand, the body of GET /api/v1/stands. */
export type StandStatus = {
  id: string;
  name: string;
  areaId: string;
  areaName: string;
  currentOccupancy: number;
  maxOccupancy: number;
  free: number;
  stale: boolean;
  updatedAt: string | null;
};

type Status = "ok" | "low" | "full" | "none";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://func-velostands-37sp3n5axfjna.azurewebsites.net";

// The six stands in the catalog (code/backend/velo-stands-cosmos/stands.yaml),
// shown until the first live answer arrives. Keep in sync with that file.
function catalogStand(id: string, areaId: string, areaName: string, slots: number): StandStatus {
  return {
    id,
    name: `${areaName}, Stand 1`,
    areaId,
    areaName,
    currentOccupancy: 0,
    maxOccupancy: slots,
    free: slots,
    stale: true,
    updatedAt: null,
  };
}

// The six stands in the catalog (code/backend/velo-stands-cosmos/stands.yaml),
// shown until the first live answer arrives. Keep in sync with that file.
export const CATALOG_STANDS: StandStatus[] = [
  catalogStand("flow-main-1", "flow-main", "Flow Main", 40),
  catalogStand("sternenhof-1", "sternenhof", "Sternenhof", 30),
  catalogStand("flow-garage-south-1", "flow-garage-south", "Flow Garage South", 30),
  catalogStand("flow-sw-1", "flow-sw", "Flow South West", 20),
  catalogStand("flow-se-1", "flow-se", "Flow South East", 10),
  catalogStand("flow-garage-north-1", "flow-garage-north", "Flow Garage North", 20),
];

/** "full" at 0 free, "low" from 85 % busy, "none" while no sensor has reported. */
export function statusOf(stand: StandStatus): Status {
  if (stand.updatedAt === null) return "none";
  if (stand.free <= 0) return "full";
  return stand.free / stand.maxOccupancy <= 0.15 ? "low" : "ok";
}

function isStand(v: unknown): v is StandStatus {
  const s = v as StandStatus;
  return (
    typeof s?.id === "string" &&
    typeof s.areaName === "string" &&
    typeof s.maxOccupancy === "number" &&
    typeof s.free === "number"
  );
}

async function fetchStands(signal: AbortSignal): Promise<StandStatus[] | null> {
  const res = await fetch(`${API_URL}/api/v1/stands`, { signal });
  if (!res.ok) return null;
  const body = (await res.json()) as { stands?: unknown };
  return Array.isArray(body.stands) && body.stands.every(isStand) ? body.stands : null;
}

function AreaRow({ stand }: { stand: StandStatus }) {
  const status = statusOf(stand);
  const total = stand.maxOccupancy;
  const occupied = Math.max(0, total - stand.free);
  const pct = status === "none" ? 0 : Math.round((occupied / total) * 100);
  const barClass =
    status === "full"
      ? "area-row__bar area-row__bar--red"
      : status === "low"
        ? "area-row__bar area-row__bar--amber"
        : "area-row__bar";
  const chipClass = {
    full: "chip chip--full",
    low: "chip chip--low",
    ok: "chip chip--ok",
    none: "chip",
  }[status];
  const chipLabel = { full: "Full", low: "• Low", ok: "• OK", none: "No data" }[status];
  const countLabel =
    status === "none"
      ? `${total} slots`
      : status === "full"
        ? `${stand.free} / ${total}`
        : `${stand.free} / ${total} free`;

  return (
    <div className="area-row">
      <div className="area-row__icon">
        <svg aria-hidden="true">
          <use href="#bike" />
        </svg>
      </div>
      <div className="area-row__main">
        <div className="area-row__name">
          {stand.areaName}
          <span className="area-row__count">{countLabel}</span>
        </div>
        <div className={barClass}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="area-row__status">
        <span className={chipClass}>{chipLabel}</span>
      </div>
    </div>
  );
}

export function StandList() {
  const [stands, setStands] = useState<StandStatus[]>(CATALOG_STANDS);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = () =>
      fetchStands(ctrl.signal)
        .then((live) => live && live.length > 0 && setStands(live))
        .catch(() => {}); // keep the last data; the next poll tries again
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      ctrl.abort();
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="panel" aria-label="Live stand list">
      <div className="panel-body">
        {stands.map((stand) => (
          <AreaRow key={stand.id} stand={stand} />
        ))}
      </div>
    </div>
  );
}
