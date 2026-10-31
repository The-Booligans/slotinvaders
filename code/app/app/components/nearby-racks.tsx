"use client";

import { useEffect, useRef } from "react";
import type { LiveStatus } from "@/lib/live-stands";
import {
  formatAge,
  formatDistance,
  hasData,
  occupancyPercent,
  spotColor,
  walkingMinutes,
  type ParkingSpot,
} from "@/lib/parking";
import { BikeIcon, WalkIcon } from "./icons";

interface NearbyRacksProps {
  spots: ParkingSpot[];
  /** server time of the data, for "updated 2 min ago" */
  at: string | null;
  status: LiveStatus;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// wait for scrolling to settle before picking the centred card
const SCROLL_SETTLE_MS = 120;

export function NearbyRacks({ spots, at, status, selectedId, onSelect }: NearbyRacksProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const card = listRef.current?.querySelector<HTMLElement>(`[data-id="${selectedId}"]`);
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedId]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const handleScroll = () => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const id = centredCardId(listRef.current);
      if (id && id !== selectedId) onSelect(id);
    }, SCROLL_SETTLE_MS);
  };

  return (
    <section aria-label="Nearby racks" className="pointer-events-none">
      <h2 className="mx-auto mb-2 w-fit rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur">
        Nearby racks
      </h2>
      {spots.length === 0 && (
        <p className="mx-auto mb-3 w-fit rounded-full bg-white/90 px-3 py-1 text-xs text-slate-600 shadow-sm">
          {status === "offline" ? "Can’t reach the server, retrying…" : "Waiting for live data…"}
        </p>
      )}
      <ul
        ref={listRef}
        onScroll={handleScroll}
        className="pointer-events-auto flex snap-x snap-mandatory gap-3 overflow-x-auto px-[12.5%] pb-3 [scrollbar-width:none]"
      >
        {spots.map((spot) => (
          <li key={spot.id} data-id={spot.id} className="w-3/4 max-w-xs shrink-0 snap-center">
            <RackCard
              spot={spot}
              at={at}
              selected={spot.id === selectedId}
              onClick={() => onSelect(spot.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function centredCardId(list: HTMLUListElement | null): string | undefined {
  if (!list) return undefined;
  const centre = list.getBoundingClientRect().left + list.clientWidth / 2;
  let best: { id?: string; gap: number } = { gap: Infinity };
  for (const el of list.querySelectorAll<HTMLElement>("[data-id]")) {
    const r = el.getBoundingClientRect();
    const gap = Math.abs(r.left + r.width / 2 - centre);
    if (gap < best.gap) best = { id: el.dataset.id, gap };
  }
  return best.id;
}

function RackCard({
  spot,
  at,
  selected,
  onClick,
}: {
  spot: ParkingSpot;
  at: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  const reported = hasData(spot);
  const percent = reported ? occupancyPercent(spot) : 0;
  const color = spotColor(spot);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-2xl bg-white p-4 text-left shadow-lg ring-1 transition-all ${
        selected ? "scale-100 ring-2 ring-[#2B7EB5]" : "scale-95 ring-black/5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{spot.name}</h3>
          <p className="truncate text-xs text-slate-500">
            {spot.standLabel} · {spot.capacity} slots
          </p>
        </div>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          <BikeIcon className="size-5" />
        </span>
      </div>

      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>
          {reported ? `${percent}%` : "–"}
        </span>
        <span className="text-sm font-medium text-slate-600">
          {reported ? `busy · ${spot.occupied} bikes` : "no data yet"}
        </span>
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
        <span className="font-medium tabular-nums text-slate-900">
          {!reported ? `${spot.capacity} slots` : spot.free === 0 ? "No free slots" : `${spot.free} free`}
        </span>
        {spot.distanceM === null ? (
          <span>Not on the map yet</span>
        ) : (
          <span className="flex items-center gap-1">
            <WalkIcon className="size-3.5" />
            {formatDistance(spot.distanceM)} · {walkingMinutes(spot.distanceM)} min
          </span>
        )}
      </div>

      <Freshness spot={spot} at={at} />
    </button>
  );
}

function Freshness({ spot, at }: { spot: ParkingSpot; at: string | null }) {
  const age = spot.updatedAt && at ? formatAge(spot.updatedAt, at) : null;
  const [text, tone] = !spot.updatedAt
    ? ["No sensor data yet", "text-slate-400"]
    : spot.stale
      ? [`Some sensors offline · updated ${age}`, "text-amber-600"]
      : [`Updated ${age}`, "text-emerald-600"];
  return <p className={`mt-2 truncate text-[11px] font-medium ${tone}`}>{text}</p>;
}
