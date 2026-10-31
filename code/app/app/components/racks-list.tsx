import type { LiveStatus } from "@/lib/live-stands";
import type { ParkingSpot } from "@/lib/parking";
import { RackCard } from "./rack-card";

interface RacksListProps {
  spots: ParkingSpot[];
  /** server time of the data, for "updated 2 min ago" */
  at: string | null;
  status: LiveStatus;
  onSelect: (id: string) => void;
}

export function RacksList({ spots, at, status, onSelect }: RacksListProps) {
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
          <ul className="flex flex-col gap-3">
            {spots.map((spot) => (
              <li key={spot.id}>
                <RackCard spot={spot} at={at} onClick={() => onSelect(spot.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
