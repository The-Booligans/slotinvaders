"use client";

import { useEffect, useRef } from "react";
import type { LiveStatus } from "@/lib/live-stands";
import type { ParkingSpot } from "@/lib/parking";
import { RackCard } from "./rack-card";

interface NearbyRacksProps {
  spots: ParkingSpot[];
  /** server time of the data, for "updated 2 min ago" */
  at: string | null;
  status: LiveStatus;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onShowPhoto: (id: string) => void;
}

// wait for scrolling to settle before picking the centred card
const SCROLL_SETTLE_MS = 120;

export function NearbyRacks({ spots, at, status, selectedId, onSelect, onShowPhoto }: NearbyRacksProps) {
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
      <h2 className="mx-auto mb-1 w-fit rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur">
        Nearby racks
      </h2>
      {spots.length === 0 && (
        <p className="mx-auto mb-2 w-fit rounded-full bg-white/90 px-3 py-1 text-xs text-slate-600 shadow-sm">
          {status === "offline" ? "Can’t reach the server, retrying…" : "Waiting for live data…"}
        </p>
      )}
      <ul
        ref={listRef}
        onScroll={handleScroll}
        // half the viewport minus half a card, so the first/last card can reach the centre
        // pt-1 keeps the selected card's ring from being clipped: overflow-x forces overflow-y to clip too
        className="pointer-events-auto flex snap-x snap-mandatory gap-3 overflow-x-auto px-[max(12.5%,calc(50%_-_10rem))] pt-1 pb-3 [scrollbar-width:none]"
      >
        {spots.map((spot) => (
          <li key={spot.id} data-id={spot.id} className="w-3/4 max-w-xs shrink-0 snap-center">
            <RackCard
              spot={spot}
              at={at}
              selected={spot.id === selectedId}
              onClick={() => onSelect(spot.id)}
              onShowPhoto={() => onShowPhoto(spot.id)}
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
