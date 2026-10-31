"use client";

import { useEffect, useRef } from "react";
import type { LiveStatus } from "@/lib/live-stands";
import type { ParkingSpot } from "@/lib/parking";
import { RackCard } from "./rack-card";
import { RackDetails } from "./rack-details";

interface RacksListProps {
  spots: ParkingSpot[];
  /** server time of the data, for "updated 2 min ago" */
  at: string | null;
  status: LiveStatus;
  /** the entry whose photo panel is open */
  expandedId: string | null;
  onToggle: (id: string) => void;
  onShowOnMap: (id: string) => void;
}

export function RacksList({ spots, at, status, expandedId, onToggle, onShowOnMap }: RacksListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // entries open from the map's photo button, so bring them into view
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-id="${expandedId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [expandedId]);

  return (
    <section aria-label="All racks" className="h-full overflow-y-auto bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          All racks{spots.length > 0 && ` · ${spots.length}`}
        </h2>
        {spots.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-black/5">
            {status === "offline" ? "Can’t reach the server, retrying…" : "Waiting for live data…"}
          </p>
        ) : (
          <ul ref={listRef} className="flex flex-col gap-3">
            {spots.map((spot) => (
              <li key={spot.id} data-id={spot.id}>
                <RackCard
                  spot={spot}
                  at={at}
                  expanded={spot.id === expandedId}
                  onClick={() => onToggle(spot.id)}
                />
                {spot.id === expandedId && (
                  <RackDetails
                    id={spot.id}
                    name={spot.name}
                    onShowOnMap={spot.position ? () => onShowOnMap(spot.id) : null}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
