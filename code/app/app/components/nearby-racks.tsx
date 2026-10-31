"use client";

import { useEffect, useRef } from "react";
import {
  LEVEL_COLOR,
  formatDistance,
  kindLabel,
  occupancyLevel,
  occupancyPercent,
  walkingMinutes,
  type ParkingSpot,
} from "@/lib/parking";
import { BikeIcon, WalkIcon } from "./icons";

interface NearbyRacksProps {
  spots: ParkingSpot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// wait for scrolling to settle before picking the centred card
const SCROLL_SETTLE_MS = 120;

export function NearbyRacks({ spots, selectedId, onSelect }: NearbyRacksProps) {
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
      <ul
        ref={listRef}
        onScroll={handleScroll}
        className="pointer-events-auto flex snap-x snap-mandatory gap-3 overflow-x-auto px-[12.5%] pb-3 [scrollbar-width:none]"
      >
        {spots.map((spot) => (
          <li key={spot.id} data-id={spot.id} className="w-3/4 max-w-xs shrink-0 snap-center">
            <RackCard
              spot={spot}
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
  selected,
  onClick,
}: {
  spot: ParkingSpot;
  selected: boolean;
  onClick: () => void;
}) {
  const percent = occupancyPercent(spot);
  const color = LEVEL_COLOR[occupancyLevel(percent)];

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
          <p className="text-xs text-slate-500">
            {kindLabel(spot.kind)} · {spot.capacity} slots
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
          {percent}%
        </span>
        <span className="text-sm font-medium text-slate-600">busy</span>
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
          {spot.free === 0 ? "No free slots" : `${spot.free} free`}
        </span>
        <span className="flex items-center gap-1">
          <WalkIcon className="size-3.5" />
          {formatDistance(spot.distanceM)} · {walkingMinutes(spot.distanceM)} min
        </span>
      </div>
    </button>
  );
}
